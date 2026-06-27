import { randomUUID } from "node:crypto";
import { BadRequestException, ForbiddenException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { PaymentStatus } from "@prisma/client";

import { RedisStoreService } from "../../infrastructure/redis/redis-store.service";
import type { SessionRecord } from "../identity/identity.types";
import type { CreatePaymentOrderDto, CreateRefundDto} from "./dto/payments.dto";
import { type PaymentReferenceType } from "./dto/payments.dto";
import { FinanceService } from "./finance.service";
import { PAYMENT_PROVIDER, type PaymentProvider, type PaymentProviderOrder } from "./payment-provider";

type RazorpayWebhookEvent = {
  id?: string;
  event: "payment.captured" | "payment.failed" | "payment.refunded" | string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        amount?: number;
        status?: string;
        notes?: Record<string, string | undefined>;
      };
    };
    refund?: {
      entity?: {
        id?: string;
        payment_id?: string;
        amount?: number;
        notes?: Record<string, string | undefined>;
      };
    };
  };
};

type PaymentOrderResponse = {
  provider: "razorpay";
  order: PaymentProviderOrder;
  referenceType: PaymentReferenceType;
  referenceId: string;
  amount: string;
  amountPaise: number;
  currency: "INR";
};

const IDEMPOTENCY_TTL_MS = Number(process.env.PAYMENT_IDEMPOTENCY_TTL_MS ?? 24 * 60 * 60 * 1000);
const WEBHOOK_PROCESSED_TTL_MS = Number(process.env.PAYMENT_WEBHOOK_PROCESSED_TTL_MS ?? 7 * 24 * 60 * 60 * 1000);
const WEBHOOK_LOCK_TTL_MS = Number(process.env.PAYMENT_WEBHOOK_LOCK_TTL_MS ?? 30_000);

@Injectable()
export class PaymentsService {
  constructor(
    @Inject(FinanceService) private readonly financeService: FinanceService,
    @Inject(RedisStoreService) private readonly redisStore: RedisStoreService,
    @Inject(PAYMENT_PROVIDER) private readonly paymentProvider: PaymentProvider,
  ) {}

  async createPaymentOrder(session: SessionRecord, body: CreatePaymentOrderDto): Promise<PaymentOrderResponse> {
    const cacheKey = `payments:create:${session.user.id}:${body.idempotencyKey}`;
    const cached = await this.redisStore.getJson<PaymentOrderResponse>(cacheKey);

    if (cached) {
      return cached;
    }

    const lockKey = `${cacheKey}:lock`;
    const lockAcquired = await this.redisStore.acquireLock(lockKey, WEBHOOK_LOCK_TTL_MS);

    if (!lockAcquired) {
      const retryCached = await this.redisStore.getJson<PaymentOrderResponse>(cacheKey);

      if (retryCached) {
        return retryCached;
      }

      throw new BadRequestException("Payment order creation is already in progress");
    }

    try {
      const reference = await this.financeService.derivePaymentReference(body.referenceType, body.referenceId);

      if (reference.customerId !== session.user.id) {
        throw new ForbiddenException("Payment reference does not belong to the authenticated user");
      }

      if (reference.paymentStatus === PaymentStatus.PAID) {
        throw new BadRequestException("Reference is already paid");
      }

      const amountPaise = this.decimalToPaise(reference.payableAmount.toString());
      const order = await this.paymentProvider.createOrder({
        amountPaise,
        currency: "INR",
        receipt: `${body.referenceType}:${body.referenceId}`.slice(0, 40),
        notes: {
          referenceType: body.referenceType,
          referenceId: body.referenceId,
          userId: session.user.id,
        },
      });
      const response: PaymentOrderResponse = {
        provider: "razorpay",
        order,
        referenceType: body.referenceType,
        referenceId: body.referenceId,
        amount: reference.payableAmount.toString(),
        amountPaise,
        currency: "INR",
      };

      await this.redisStore.setJson(cacheKey, response, IDEMPOTENCY_TTL_MS);
      return response;
    } finally {
      await this.redisStore.delete(lockKey);
    }
  }

  async processRazorpayWebhook(rawBody: Buffer, signature: string | undefined, parsedBody: unknown) {
    if (!signature || !this.paymentProvider.verifyWebhookSignature(rawBody, signature)) {
      throw new UnauthorizedException("Invalid Razorpay webhook signature");
    }

    return this.processWebhookEvent(parsedBody as RazorpayWebhookEvent);
  }

  async mockCapture(body: { referenceType: PaymentReferenceType; referenceId: string; razorpayOrderId: string; razorpayPaymentId?: string }) {
    if (process.env.NODE_ENV === "production") {
      throw new ForbiddenException("Mock capture is disabled in production");
    }

    const reference = await this.financeService.derivePaymentReference(body.referenceType, body.referenceId);
    const amountPaise = this.decimalToPaise(reference.payableAmount.toString());

    return this.processWebhookEvent({
      id: `evt_mock_${body.razorpayPaymentId ?? body.razorpayOrderId}`,
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: body.razorpayPaymentId ?? `pay_mock_${body.razorpayOrderId}`,
            order_id: body.razorpayOrderId,
            amount: amountPaise,
            status: "captured",
            notes: {
              referenceType: body.referenceType,
              referenceId: body.referenceId,
            },
          },
        },
      },
    });
  }

  async createRefund(body: CreateRefundDto) {
    const reference = await this.financeService.derivePaymentReference(body.referenceType, body.referenceId);

    if (reference.paymentStatus !== PaymentStatus.PAID || !reference.providerPaymentId) {
      throw new BadRequestException("Reference does not have a captured provider payment");
    }

    const amountPaise = this.decimalToPaise(reference.payableAmount.toString());
    const refund = await this.paymentProvider.createRefund({
      paymentId: reference.providerPaymentId,
      amountPaise,
      notes: {
        referenceType: body.referenceType,
        referenceId: body.referenceId,
        reason: body.reason ?? "refund requested",
      },
    });

    const ledger = await this.financeService.recordRefund({
      referenceType: body.referenceType,
      referenceId: body.referenceId,
      paymentId: reference.providerPaymentId,
      refundId: refund.id,
      amountPaise: refund.amountPaise,
      reason: body.reason,
    });

    return { refund, ledger };
  }

  private async processWebhookEvent(event: RazorpayWebhookEvent) {
    const eventId = event.id ?? this.fallbackEventId(event);
    const processedKey = `payments:webhook:processed:${eventId}`;
    const existing = await this.redisStore.getJson<{ processedAt: string }>(processedKey);

    if (existing) {
      return { duplicate: true, processedAt: existing.processedAt };
    }

    const lockKey = `payments:webhook:lock:${eventId}`;
    const lockAcquired = await this.redisStore.acquireLock(lockKey, WEBHOOK_LOCK_TTL_MS);

    if (!lockAcquired) {
      return { duplicate: true, status: "processing" };
    }

    try {
      const retryExisting = await this.redisStore.getJson<{ processedAt: string }>(processedKey);

      if (retryExisting) {
        return { duplicate: true, processedAt: retryExisting.processedAt };
      }

      const result = await this.dispatchWebhookEvent(event);
      const processed = { processedAt: new Date().toISOString(), event: event.event };
      await this.redisStore.setJson(processedKey, processed, WEBHOOK_PROCESSED_TTL_MS);
      return { duplicate: false, result };
    } finally {
      await this.redisStore.delete(lockKey);
    }
  }

  private async dispatchWebhookEvent(event: RazorpayWebhookEvent) {
    if (event.event === "payment.captured") {
      const payment = event.payload?.payment?.entity;
      const reference = this.extractReference(payment?.notes);

      if (!payment?.id || !payment.amount || !reference) {
        throw new BadRequestException("Captured webhook is missing payment reference data");
      }

      return this.financeService.markPaymentCaptured({
        referenceType: reference.referenceType,
        referenceId: reference.referenceId,
        providerOrderId: payment.order_id,
        providerPaymentId: payment.id,
        amountPaise: payment.amount,
      });
    }

    if (event.event === "payment.failed") {
      const payment = event.payload?.payment?.entity;
      const reference = this.extractReference(payment?.notes);

      if (!reference) {
        throw new BadRequestException("Failed webhook is missing payment reference data");
      }

      await this.financeService.markPaymentFailed({
        referenceType: reference.referenceType,
        referenceId: reference.referenceId,
        providerOrderId: payment?.order_id,
        providerPaymentId: payment?.id,
      });
      return { status: "failed-recorded" };
    }

    if (event.event === "payment.refunded") {
      const payment = event.payload?.payment?.entity;
      const refund = event.payload?.refund?.entity;
      const reference = this.extractReference(refund?.notes ?? payment?.notes);

      if (!reference || !refund?.id || !refund.payment_id || !refund.amount) {
        throw new BadRequestException("Refund webhook is missing reference data");
      }

      return this.financeService.recordRefund({
        referenceType: reference.referenceType,
        referenceId: reference.referenceId,
        paymentId: refund.payment_id,
        refundId: refund.id,
        amountPaise: refund.amount,
      });
    }

    return { status: "ignored", event: event.event };
  }

  private extractReference(notes?: Record<string, string | undefined>): { referenceType: PaymentReferenceType; referenceId: string } | null {
    const referenceType = notes?.referenceType;
    const referenceId = notes?.referenceId;

    if (!referenceId || !this.isPaymentReferenceType(referenceType)) {
      return null;
    }

    return { referenceType, referenceId };
  }

  private isPaymentReferenceType(value: unknown): value is PaymentReferenceType {
    return ["ORDER", "RIDE", "COURIER", "HOME_SERVICE", "WALLET_TOPUP"].includes(String(value));
  }

  private decimalToPaise(amount: string): number {
    return Math.round(Number(amount) * 100);
  }

  private fallbackEventId(event: RazorpayWebhookEvent): string {
    const paymentId = event.payload?.payment?.entity?.id;
    const refundId = event.payload?.refund?.entity?.id;
    return `${event.event}:${paymentId ?? refundId ?? randomUUID()}`;
  }
}