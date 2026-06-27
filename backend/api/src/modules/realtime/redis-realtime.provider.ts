import { Injectable, type OnApplicationShutdown, type OnModuleInit } from "@nestjs/common";
import Redis, { type RedisOptions } from "ioredis";
import { Observable, Subject } from "rxjs";

import type { RealtimeMessage, RealtimeProvider } from "./realtime-provider";

const DEFAULT_REDIS_URL = "redis://localhost:6379";
const CHANNEL_PREFIX = "movex:realtime:";

@Injectable()
export class RedisRealtimeProvider implements RealtimeProvider, OnModuleInit, OnApplicationShutdown {
  private readonly publisher: Redis;
  private readonly subscriber: Redis;
  private readonly subjects = new Map<string, Subject<RealtimeMessage>>();

  constructor() {
    const redisUrl = process.env.REDIS_URL ?? DEFAULT_REDIS_URL;
    this.publisher = new Redis(redisUrl, this.redisOptions());
    this.subscriber = new Redis(redisUrl, this.redisOptions());
    this.publisher.on("error", () => undefined);
    this.subscriber.on("error", () => undefined);
  }

  async onModuleInit(): Promise<void> {
    this.subscriber.on("pmessage", (_pattern, channel, payload) => {
      const topic = channel.slice(CHANNEL_PREFIX.length);
      const subject = this.subjects.get(topic);

      if (!subject) {
        return;
      }

      try {
        subject.next(JSON.parse(payload) as RealtimeMessage);
      } catch {
        // Drop malformed realtime payloads; publisher code owns serialization.
      }
    });

    await this.subscriber.psubscribe(`${CHANNEL_PREFIX}*`);
  }

  async publish(topic: string, message: Omit<RealtimeMessage, "topic" | "createdAt"> & { createdAt?: string }): Promise<void> {
    const payload: RealtimeMessage = {
      ...message,
      topic,
      createdAt: message.createdAt ?? new Date().toISOString(),
    };

    await this.publisher.publish(`${CHANNEL_PREFIX}${topic}`, JSON.stringify(payload));
  }

  stream(topic: string): Observable<RealtimeMessage> {
    let subject = this.subjects.get(topic);

    if (!subject) {
      subject = new Subject<RealtimeMessage>();
      this.subjects.set(topic, subject);
    }

    return subject.asObservable();
  }

  onApplicationShutdown(): void {
    this.publisher.disconnect();
    this.subscriber.disconnect();
    for (const subject of this.subjects.values()) {
      subject.complete();
    }
    this.subjects.clear();
  }

  private redisOptions(): RedisOptions {
    return {
      lazyConnect: false,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: () => null,
      reconnectOnError: () => false,
    };
  }
}