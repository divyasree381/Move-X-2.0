import type Redis from "ioredis";
import type { OutboxEvent, Prisma, PrismaClient } from "@prisma/client";

import { contentForEvent, resolveNotificationUser, ResendWorkerEmailProvider, WorkerSmsProviderAdapter } from "./notifications.js";
import { publishRealtime, topicForEvent } from "./realtime.js";
import { setJsonIfNotExists } from "./redis.js";
import { SearchIndexer } from "./search-indexer.js";

type EventPayload = Record<string, unknown>;

const WORKER_LOCK_TTL_MS = Number(process.env.OUTBOX_WORKER_LOCK_TTL_MS ?? 60_000);
const HANDLER_IDEMPOTENCY_TTL_MS = Number(process.env.OUTBOX_HANDLER_IDEMPOTENCY_TTL_MS ?? 7 * 24 * 60 * 60 * 1000);
const OUTBOX_BATCH_SIZE = Number(process.env.OUTBOX_BATCH_SIZE ?? 25);
const OUTBOX_MAX_ATTEMPTS = Number(process.env.OUTBOX_MAX_ATTEMPTS ?? 10);

export class OutboxProcessor {
  private readonly emailProvider = new ResendWorkerEmailProvider();
  private readonly smsProvider = new WorkerSmsProviderAdapter();
  private readonly searchIndexer: SearchIndexer;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
  ) {
    this.searchIndexer = new SearchIndexer(prisma);
  }

  async processBatch(): Promise<number> {
    const events = await this.prisma.outboxEvent.findMany({
      where: {
        processedAt: null,
        attempts: { lt: OUTBOX_MAX_ATTEMPTS },
      },
      orderBy: { createdAt: "asc" },
      take: OUTBOX_BATCH_SIZE,
    });

    let processed = 0;

    for (const event of events) {
      if (await this.processEvent(event)) {
        processed += 1;
      }
    }

    return processed;
  }

  private async processEvent(event: OutboxEvent): Promise<boolean> {
    const lockKey = `outbox:lock:${event.id}`;
    const lockAcquired = await setJsonIfNotExists(this.redis, lockKey, { lockedAt: new Date().toISOString() }, WORKER_LOCK_TTL_MS);

    if (!lockAcquired) {
      return false;
    }

    try {
      await this.prisma.outboxEvent.update({ where: { id: event.id }, data: { attempts: { increment: 1 } } });
      const payload = this.toPayload(event.payload);
      await this.handleNotification(event, payload);
      await this.handleRealtime(event, payload);
      await this.handleSearch(event, payload);
      await this.prisma.outboxEvent.update({ where: { id: event.id }, data: { processedAt: new Date() } });
      return true;
    } catch (error) {
      console.error({ eventId: event.id, eventType: event.type, error }, "Outbox event processing failed");
      return false;
    } finally {
      await this.redis.del(lockKey);
    }
  }

  private async handleNotification(event: OutboxEvent, payload: EventPayload): Promise<void> {
    const doneKey = `outbox:done:${event.id}:notification`;

    if (await this.redis.get(doneKey)) {
      return;
    }

    const user = await resolveNotificationUser(this.prisma, event.type, payload);

    if (!user) {
      await this.redis.set(doneKey, JSON.stringify({ skipped: true }), "PX", HANDLER_IDEMPOTENCY_TTL_MS);
      return;
    }

    const content = contentForEvent(event.type, payload);
    const existing = await this.prisma.notification.findFirst({
      where: {
        userId: user.id,
        payload: {
          path: ["outboxEventId"],
          equals: event.id,
        },
      },
    });

    const notification =
      existing ??
      (await this.prisma.notification.create({
        data: {
          userId: user.id,
          type: content.type,
          title: content.title,
          body: content.body,
          payload: {
            outboxEventId: event.id,
            eventType: event.type,
            eventPayload: payload as Prisma.InputJsonValue,
          },
        },
      }));

    if (user.email) {
      await this.emailProvider.sendEmail({
        to: user.email,
        subject: content.title,
        text: content.body,
        idempotencyKey: `outbox:${event.id}:email`,
      });
    }

    if (user.phoneE164) {
      await this.smsProvider.sendSms({
        phoneE164: user.phoneE164,
        message: content.body,
        idempotencyKey: `outbox:${event.id}:sms`,
      });
    }

    await this.redis.set(
      doneKey,
      JSON.stringify({ notificationId: notification.id, processedAt: new Date().toISOString() }),
      "PX",
      HANDLER_IDEMPOTENCY_TTL_MS,
    );
  }

  private async handleRealtime(event: OutboxEvent, payload: EventPayload): Promise<void> {
    const doneKey = `outbox:done:${event.id}:realtime`;

    if (await this.redis.get(doneKey)) {
      return;
    }

    const userId = this.firstString(payload.userId, payload.customerId, payload.partnerId, payload.driverId, payload.deliveryPartnerId);
    const topic = topicForEvent(event.type, payload, userId ?? undefined);

    if (!topic) {
      await this.redis.set(doneKey, JSON.stringify({ skipped: true }), "PX", HANDLER_IDEMPOTENCY_TTL_MS);
      return;
    }

    await publishRealtime(this.redis, topic, event.type, { outboxEventId: event.id, ...payload }, event.id);
    await this.redis.set(doneKey, JSON.stringify({ topic, processedAt: new Date().toISOString() }), "PX", HANDLER_IDEMPOTENCY_TTL_MS);
  }

  private async handleSearch(event: OutboxEvent, payload: EventPayload): Promise<void> {
    if (event.type !== "search.store.changed" && event.type !== "search.rebuild.requested") {
      return;
    }

    const doneKey = `outbox:done:${event.id}:search`;

    if (await this.redis.get(doneKey)) {
      return;
    }

    if (event.type === "search.store.changed") {
      const storeId = this.firstString(payload.storeId);

      if (!storeId) {
        await this.redis.set(doneKey, JSON.stringify({ skipped: true, reason: "missing_store_id" }), "PX", HANDLER_IDEMPOTENCY_TTL_MS);
        return;
      }

      const result = await this.searchIndexer.syncStore(storeId);
      await this.redis.set(doneKey, JSON.stringify({ ...result, processedAt: new Date().toISOString() }), "PX", HANDLER_IDEMPOTENCY_TTL_MS);
      return;
    }

    const result = await this.searchIndexer.rebuildStores();
    await this.redis.set(doneKey, JSON.stringify({ ...result, processedAt: new Date().toISOString() }), "PX", HANDLER_IDEMPOTENCY_TTL_MS);
  }

  private toPayload(payload: unknown): EventPayload {
    return typeof payload === "object" && payload !== null && !Array.isArray(payload) ? (payload as EventPayload) : {};
  }

  private firstString(...values: unknown[]): string | null {
    for (const value of values) {
      if (typeof value === "string" && value.length > 0) {
        return value;
      }
    }
    return null;
  }
}




