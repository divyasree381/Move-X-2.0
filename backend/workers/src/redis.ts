import Redis from "ioredis";

const DEFAULT_REDIS_URL = "redis://localhost:6379";

export function createRedisClient() {
  const redis = new Redis(process.env.REDIS_URL ?? DEFAULT_REDIS_URL, {
    lazyConnect: false,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: () => null,
    reconnectOnError: () => false,
  });
  redis.on("error", () => undefined);
  return redis;
}

export async function setJsonIfNotExists(redis: Redis, key: string, value: unknown, ttlMs: number): Promise<boolean> {
  const result = await redis.set(key, JSON.stringify(value), "PX", ttlMs, "NX");
  return result === "OK";
}