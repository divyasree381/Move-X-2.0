import { randomUUID } from "node:crypto";
import type Redis from "ioredis";

const CHANNEL_PREFIX = "movex:realtime:";

export type RealtimeWorkerMessage = {
  id: string;
  type: string;
  topic: string;
  payload: unknown;
  createdAt: string;
};

export async function publishRealtime(redis: Redis, topic: string, eventType: string, payload: unknown, id = randomUUID()) {
  const message: RealtimeWorkerMessage = {
    id,
    type: eventType,
    topic,
    payload,
    createdAt: new Date().toISOString(),
  };

  await redis.publish(`${CHANNEL_PREFIX}${topic}`, JSON.stringify(message));
}

export function topicForEvent(eventType: string, payload: Record<string, unknown>, userId?: string): string | null {
  if (typeof payload.topic === "string") {
    return payload.topic;
  }
  if (typeof payload.orderId === "string") {
    return `order:${payload.orderId}`;
  }
  if (typeof payload.rideId === "string") {
    return `ride:${payload.rideId}`;
  }
  if (typeof payload.courierId === "string") {
    return `courier:${payload.courierId}`;
  }
  if (typeof payload.homeServiceId === "string") {
    return `home-service:${payload.homeServiceId}`;
  }
  if (eventType === "partner.approved" && typeof payload.partnerId === "string") {
    return `partner:${payload.partnerId}`;
  }
  return userId ? `user:${userId}` : null;
}