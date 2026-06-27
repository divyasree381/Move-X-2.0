import { Inject, Injectable } from "@nestjs/common";
import type { Prisma, PrismaClient } from "@prisma/client";

import { PrismaService } from "../../infrastructure/prisma/prisma.service";

export const StandardOutboxEventType = {
  OrderCreated: "order.created",
  OrderStatusChanged: "order.status.changed",
  RideRequested: "ride.requested",
  RideAccepted: "ride.accepted",
  RideStatusChanged: "ride.status.changed",
  CourierRequested: "courier.requested",
  CourierAccepted: "courier.accepted",
  CourierStatusChanged: "courier.status.changed",
  HomeServiceRequested: "home-service.requested",
  HomeServiceAccepted: "home-service.accepted",
  HomeServiceStatusChanged: "home-service.status.changed",
  PaymentCaptured: "payment.captured",
  RefundCreated: "refund.created",
  PayoutCreated: "payout.created",
  PartnerApproved: "partner.approved",
} as const;

export type StandardOutboxEventType = (typeof StandardOutboxEventType)[keyof typeof StandardOutboxEventType];

type OutboxTx = Prisma.TransactionClient | PrismaService | PrismaClient;

export type StandardOutboxPayload = {
  actorId?: string;
  userId?: string;
  customerId?: string;
  partnerId?: string;
  orderId?: string;
  rideId?: string;
  courierId?: string;
  homeServiceId?: string;
  paymentId?: string;
  refundId?: string;
  payoutId?: string;
  title?: string;
  body?: string;
  topic?: string;
  [key: string]: unknown;
};

@Injectable()
export class OutboxService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  publish(type: StandardOutboxEventType, payload: StandardOutboxPayload) {
    return this.publishInTx(this.prisma, type, payload);
  }

  publishInTx(tx: OutboxTx, type: StandardOutboxEventType, payload: StandardOutboxPayload) {
    return tx.outboxEvent.create({
      data: {
        type,
        payload: payload as Prisma.InputJsonValue,
      },
    });
  }

  orderCreated(tx: OutboxTx, payload: StandardOutboxPayload) {
    return this.publishInTx(tx, StandardOutboxEventType.OrderCreated, payload);
  }

  orderStatusChanged(tx: OutboxTx, payload: StandardOutboxPayload) {
    return this.publishInTx(tx, StandardOutboxEventType.OrderStatusChanged, payload);
  }

  rideRequested(tx: OutboxTx, payload: StandardOutboxPayload) {
    return this.publishInTx(tx, StandardOutboxEventType.RideRequested, payload);
  }

  rideAccepted(tx: OutboxTx, payload: StandardOutboxPayload) {
    return this.publishInTx(tx, StandardOutboxEventType.RideAccepted, payload);
  }

  rideStatusChanged(tx: OutboxTx, payload: StandardOutboxPayload) {
    return this.publishInTx(tx, StandardOutboxEventType.RideStatusChanged, payload);
  }


  courierRequested(tx: OutboxTx, payload: StandardOutboxPayload) {
    return this.publishInTx(tx, StandardOutboxEventType.CourierRequested, payload);
  }

  courierAccepted(tx: OutboxTx, payload: StandardOutboxPayload) {
    return this.publishInTx(tx, StandardOutboxEventType.CourierAccepted, payload);
  }

  courierStatusChanged(tx: OutboxTx, payload: StandardOutboxPayload) {
    return this.publishInTx(tx, StandardOutboxEventType.CourierStatusChanged, payload);
  }

  homeServiceRequested(tx: OutboxTx, payload: StandardOutboxPayload) {
    return this.publishInTx(tx, StandardOutboxEventType.HomeServiceRequested, payload);
  }

  homeServiceAccepted(tx: OutboxTx, payload: StandardOutboxPayload) {
    return this.publishInTx(tx, StandardOutboxEventType.HomeServiceAccepted, payload);
  }

  homeServiceStatusChanged(tx: OutboxTx, payload: StandardOutboxPayload) {
    return this.publishInTx(tx, StandardOutboxEventType.HomeServiceStatusChanged, payload);
  }
  paymentCaptured(tx: OutboxTx, payload: StandardOutboxPayload) {
    return this.publishInTx(tx, StandardOutboxEventType.PaymentCaptured, payload);
  }

  refundCreated(tx: OutboxTx, payload: StandardOutboxPayload) {
    return this.publishInTx(tx, StandardOutboxEventType.RefundCreated, payload);
  }

  payoutCreated(tx: OutboxTx, payload: StandardOutboxPayload) {
    return this.publishInTx(tx, StandardOutboxEventType.PayoutCreated, payload);
  }

  partnerApproved(tx: OutboxTx, payload: StandardOutboxPayload) {
    return this.publishInTx(tx, StandardOutboxEventType.PartnerApproved, payload);
  }
}