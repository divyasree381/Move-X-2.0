import { Injectable, type OnApplicationShutdown } from "@nestjs/common";
import Redis from "ioredis";

type MemoryRecord = {
  value: string;
  expiresAt?: number;
};

export type GeoNearbyResult = {
  member: string;
  distanceKm: number;
};

const DEFAULT_REDIS_URL = "redis://localhost:6379";
const REDIS_RETRY_DELAY_MS = 5_000;

@Injectable()
export class RedisStoreService implements OnApplicationShutdown {
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

  async getJson<T>(key: string): Promise<T | null> {
    if (this.shouldTryRedis()) {
      try {
        await this.ensureConnected();
        const value = await this.redis.get(key);
        return value ? (JSON.parse(value) as T) : null;
      } catch {
        this.markRedisUnavailable();
      }
    }

    const value = this.getMemoryValue(key);
    return value ? (JSON.parse(value) as T) : null;
  }

  async setJson(key: string, value: unknown, ttlMs: number): Promise<void> {
    const serialized = JSON.stringify(value);

    if (this.shouldTryRedis()) {
      try {
        await this.ensureConnected();
        await this.redis.psetex(key, ttlMs, serialized);
        return;
      } catch {
        this.markRedisUnavailable();
      }
    }

    this.memoryStore.set(key, { value: serialized, expiresAt: Date.now() + ttlMs });
  }


  async setJsonIfNotExists(key: string, value: unknown, ttlMs: number): Promise<boolean> {
    const serialized = JSON.stringify(value);

    if (this.shouldTryRedis()) {
      try {
        await this.ensureConnected();
        const result = await this.redis.set(key, serialized, "PX", ttlMs, "NX");
        return result === "OK";
      } catch {
        this.markRedisUnavailable();
      }
    }

    const existing = this.getMemoryValue(key);

    if (existing !== null) {
      return false;
    }

    this.memoryStore.set(key, { value: serialized, expiresAt: Date.now() + ttlMs });
    return true;
  }

  async acquireLock(key: string, ttlMs: number): Promise<boolean> {
    return this.setJsonIfNotExists(key, { lockedAt: new Date().toISOString() }, ttlMs);
  }
  async delete(key: string): Promise<void> {
    if (this.shouldTryRedis()) {
      try {
        await this.ensureConnected();
        await this.redis.del(key);
      } catch {
        this.markRedisUnavailable();
      }
    }

    this.memoryStore.delete(key);
  }

  async increment(key: string, ttlMs: number): Promise<number> {
    if (this.shouldTryRedis()) {
      try {
        await this.ensureConnected();
        const count = await this.redis.incr(key);

        if (count === 1) {
          await this.redis.pexpire(key, ttlMs);
        }

        return count;
      } catch {
        this.markRedisUnavailable();
      }
    }

    const now = Date.now();
    const existing = this.memoryStore.get(key);
    const count = existing && (!existing.expiresAt || existing.expiresAt > now) ? Number(existing.value) + 1 : 1;
    this.memoryStore.set(key, { value: String(count), expiresAt: now + ttlMs });
    return count;
  }


  async writeGeoWithHeartbeat(input: {
    geoKey: string;
    heartbeatKey: string;
    member: string;
    lng: number;
    lat: number;
    ttlMs: number;
    payload: unknown;
  }): Promise<void> {
    if (this.shouldTryRedis()) {
      try {
        await this.ensureConnected();
        await this.redis.geoadd(input.geoKey, input.lng, input.lat, input.member);
        await this.redis.psetex(input.heartbeatKey, input.ttlMs, JSON.stringify(input.payload));
        return;
      } catch {
        this.markRedisUnavailable();
      }
    }

    this.memoryStore.set(input.geoKey + ":" + input.member, {
      value: JSON.stringify({ lng: input.lng, lat: input.lat, member: input.member }),
      expiresAt: Date.now() + input.ttlMs,
    });
    this.memoryStore.set(input.heartbeatKey, {
      value: JSON.stringify(input.payload),
      expiresAt: Date.now() + input.ttlMs,
    });
  }

  async geoRadius(input: { geoKey: string; lat: number; lng: number; radiusKm: number; count?: number }): Promise<GeoNearbyResult[]> {
    if (this.shouldTryRedis()) {
      try {
        await this.ensureConnected();
        const result = (await this.redis.call(
          "GEOSEARCH",
          input.geoKey,
          "FROMLONLAT",
          input.lng,
          input.lat,
          "BYRADIUS",
          input.radiusKm,
          "km",
          "ASC",
          "COUNT",
          input.count ?? 25,
          "WITHDIST",
        )) as unknown[];

        return result
          .map((entry) => {
            if (!Array.isArray(entry) || typeof entry[0] !== "string") {
              return null;
            }

            const distanceKm = Number(entry[1]);
            return Number.isFinite(distanceKm) ? { member: entry[0], distanceKm } : null;
          })
          .filter((entry): entry is GeoNearbyResult => entry !== null);
      } catch {
        this.markRedisUnavailable();
      }
    }

    const prefix = `${input.geoKey}:`;
    const now = Date.now();
    const matches: GeoNearbyResult[] = [];

    for (const [key, record] of this.memoryStore.entries()) {
      if (!key.startsWith(prefix) || (record.expiresAt && record.expiresAt <= now)) {
        continue;
      }

      try {
        const value = JSON.parse(record.value) as { member?: unknown; lat?: unknown; lng?: unknown };
        if (typeof value.member !== "string" || typeof value.lat !== "number" || typeof value.lng !== "number") {
          continue;
        }

        const distanceKm = this.haversineKm(input.lat, input.lng, value.lat, value.lng);
        if (distanceKm <= input.radiusKm) {
          matches.push({ member: value.member, distanceKm });
        }
      } catch {
        // Ignore malformed in-memory geo values.
      }
    }

    return matches.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, input.count ?? 25);
  }
  onApplicationShutdown(): void {
    this.disconnectRedis();
    this.memoryStore.clear();
  }

  dumpMemoryForTesting(): Record<string, string> {
    const now = Date.now();
    const snapshot: Record<string, string> = {};

    for (const [key, record] of this.memoryStore.entries()) {
      if (record.expiresAt && record.expiresAt <= now) {
        continue;
      }

      snapshot[key] = record.value;
    }

    return snapshot;
  }

  expireMemoryKeyForTesting(key: string): void {
    const record = this.memoryStore.get(key);

    if (record) {
      record.expiresAt = Date.now() - 1;
    }
  }

  private haversineKm(fromLat: number, fromLng: number, toLat: number, toLng: number): number {
    const earthRadiusKm = 6371;
    const toRadians = (value: number) => (value * Math.PI) / 180;
    const dLat = toRadians(toLat - fromLat);
    const dLng = toRadians(toLng - fromLng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(fromLat)) * Math.cos(toRadians(toLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private getMemoryValue(key: string): string | null {
    const record = this.memoryStore.get(key);

    if (!record) {
      return null;
    }

    if (record.expiresAt && record.expiresAt <= Date.now()) {
      this.memoryStore.delete(key);
      return null;
    }

    return record.value;
  }

  private shouldTryRedis(): boolean {
    return Date.now() >= this.nextRedisRetryAt;
  }

  private markRedisUnavailable(): void {
    this.disconnectRedis();
    this.nextRedisRetryAt = Date.now() + REDIS_RETRY_DELAY_MS;
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
}