import { Injectable, type OnApplicationShutdown } from "@nestjs/common";
import type { ThrottlerStorage } from "@nestjs/throttler";
import Redis from "ioredis";

type StorageRecord = {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
};

type MemoryRecord = {
  totalHits: number;
  expiresAt: number;
  blockedUntil?: number;
};

const DEFAULT_REDIS_URL = "redis://localhost:6379";
const REDIS_RETRY_DELAY_MS = 5_000;

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage, OnApplicationShutdown {
  private readonly redis: Redis;
  private readonly memoryStore = new Map<string, MemoryRecord>();
  private nextRedisRetryAt = 0;

  constructor() {
    const redisUrl = process.env.REDIS_URL ?? DEFAULT_REDIS_URL;

    this.redis = new Redis(redisUrl, {
      lazyConnect: true,
      connectTimeout: 150,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: () => null,
      reconnectOnError: () => false,
    });
    this.redis.on("error", () => undefined);
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<StorageRecord> {
    if (Date.now() >= this.nextRedisRetryAt) {
      try {
        return await this.incrementRedis(key, ttl, limit, blockDuration, throttlerName);
      } catch {
        this.disconnectRedis();
        this.nextRedisRetryAt = Date.now() + REDIS_RETRY_DELAY_MS;
      }
    }

    return this.incrementMemory(key, ttl, limit, blockDuration, throttlerName);
  }

  onApplicationShutdown(): void {
    this.disconnectRedis();
    this.memoryStore.clear();
  }

  private async incrementRedis(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<StorageRecord> {
    await this.ensureConnected();

    const hitKey = this.getHitKey(key, throttlerName);
    const blockKey = this.getBlockKey(key, throttlerName);
    const currentBlockTtl = await this.redis.pttl(blockKey);

    if (currentBlockTtl > 0) {
      return {
        totalHits: Number((await this.redis.get(hitKey)) ?? 0),
        timeToExpire: Math.max(await this.redis.pttl(hitKey), 0),
        isBlocked: true,
        timeToBlockExpire: currentBlockTtl,
      };
    }

    const totalHits = await this.redis.incr(hitKey);
    let timeToExpire = await this.redis.pttl(hitKey);

    if (timeToExpire < 0) {
      await this.redis.pexpire(hitKey, ttl);
      timeToExpire = ttl;
    }

    if (totalHits > limit) {
      await this.redis.set(blockKey, "1", "PX", blockDuration);
      return {
        totalHits,
        timeToExpire,
        isBlocked: true,
        timeToBlockExpire: blockDuration,
      };
    }

    return {
      totalHits,
      timeToExpire,
      isBlocked: false,
      timeToBlockExpire: 0,
    };
  }

  private incrementMemory(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): StorageRecord {
    const now = Date.now();
    const hitKey = this.getHitKey(key, throttlerName);
    const existing = this.memoryStore.get(hitKey);
    const record = existing && existing.expiresAt > now ? existing : { totalHits: 0, expiresAt: now + ttl };

    if (record.blockedUntil && record.blockedUntil > now) {
      return {
        totalHits: record.totalHits,
        timeToExpire: Math.max(record.expiresAt - now, 0),
        isBlocked: true,
        timeToBlockExpire: record.blockedUntil - now,
      };
    }

    record.totalHits += 1;

    if (record.totalHits > limit) {
      record.blockedUntil = now + blockDuration;
    }

    this.memoryStore.set(hitKey, record);

    return {
      totalHits: record.totalHits,
      timeToExpire: Math.max(record.expiresAt - now, 0),
      isBlocked: Boolean(record.blockedUntil && record.blockedUntil > now),
      timeToBlockExpire: record.blockedUntil ? Math.max(record.blockedUntil - now, 0) : 0,
    };
  }

  private async ensureConnected(): Promise<void> {
    if (this.redis.status === "ready") {
      return;
    }

    await this.redis.connect();
  }

  private disconnectRedis(): void {
    if (this.redis.status !== "end") {
      this.redis.disconnect();
    }
  }

  private getHitKey(key: string, throttlerName: string): string {
    return `throttle:${throttlerName}:${key}`;
  }

  private getBlockKey(key: string, throttlerName: string): string {
    return `throttle:${throttlerName}:${key}:blocked`;
  }
}

