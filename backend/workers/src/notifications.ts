import type { NotificationType, PrismaClient, User } from "@prisma/client";

export type DeliveryContent = {
  title: string;
  body: string;
  type: NotificationType;
};

export type WorkerEmailProvider = {
  sendEmail(input: { to: string; subject: string; text: string; html?: string; idempotencyKey?: string }): Promise<void>;
};

export type WorkerSmsProvider = {
  sendSms(input: { phoneE164: string; message: string; idempotencyKey?: string }): Promise<void>;
};

export class ResendWorkerEmailProvider implements WorkerEmailProvider {
  async sendEmail(input: { to: string; subject: string; text: string; html?: string; idempotencyKey?: string }): Promise<void> {
    if (process.env.NODE_ENV !== "production" && process.env.EMAIL_PROVIDER === "mock") {
      return;
    }

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.NOTIFICATION_EMAIL_FROM;

    if (!apiKey || !from) {
      return;
    }

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {}),
      },
      body: JSON.stringify({ from, to: input.to, subject: input.subject, text: input.text, html: input.html }),
    });
  }
}

export class WorkerSmsProviderAdapter implements WorkerSmsProvider {
  async sendSms(input: { phoneE164: string; message: string; idempotencyKey?: string }): Promise<void> {
    void input;
    // Real SMS providers will plug in behind the shared SmsProvider adapter; worker keeps mock-safe behavior for MVP.
  }
}

export function contentForEvent(eventType: string, payload: Record<string, unknown>): DeliveryContent {
  const title = typeof payload.title === "string" ? payload.title : titleForEvent(eventType);
  const body = typeof payload.body === "string" ? payload.body : bodyForEvent(eventType);
  return { title, body, type: notificationTypeForEvent(eventType) };
}

export async function resolveNotificationUser(prisma: PrismaClient, eventType: string, payload: Record<string, unknown>): Promise<User | null> {
  const directUserId = firstString(payload.userId, payload.customerId, payload.partnerId, payload.driverId, payload.deliveryPartnerId);

  if (directUserId) {
    return prisma.user.findUnique({ where: { id: directUserId } });
  }

  if (typeof payload.orderId === "string") {
    const order = await prisma.order.findUnique({ where: { id: payload.orderId }, select: { customer: true } });
    return order?.customer ?? null;
  }

  if (typeof payload.rideId === "string") {
    const ride = await prisma.ride.findUnique({ where: { id: payload.rideId }, select: { customer: true } });
    return ride?.customer ?? null;
  }

  if (typeof payload.courierId === "string") {
    const booking = await prisma.courierBooking.findUnique({ where: { id: payload.courierId }, select: { customer: true } });
    return booking?.customer ?? null;
  }

  if (typeof payload.homeServiceId === "string") {
    const booking = await prisma.homeServiceBooking.findUnique({ where: { id: payload.homeServiceId }, select: { customer: true } });
    return booking?.customer ?? null;
  }

  return eventType === "partner.approved" && typeof payload.partnerId === "string"
    ? prisma.user.findUnique({ where: { id: payload.partnerId } })
    : null;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return null;
}

function titleForEvent(eventType: string): string {
  const titles: Record<string, string> = {
    "order.created": "Order created",
    "order.status.changed": "Order updated",
    "ride.requested": "Ride requested",
    "ride.accepted": "Ride accepted",
    "courier.requested": "Courier requested",
    "courier.accepted": "Courier accepted",
    "courier.status.changed": "Courier updated",
    "home-service.requested": "Home service requested",
    "home-service.accepted": "Home service accepted",
    "home-service.status.changed": "Home service updated",
    "payment.captured": "Payment captured",
    "refund.created": "Refund created",
    "payout.created": "Payout created",
    "partner.approved": "Partner approved",
  };
  return titles[eventType] ?? "MoveX update";
}

function bodyForEvent(eventType: string): string {
  const bodies: Record<string, string> = {
    "order.created": "Your order has been created.",
    "order.status.changed": "Your order status changed.",
    "ride.requested": "Your ride request is live.",
    "ride.accepted": "Your ride has been accepted.",
    "courier.requested": "Your courier request is live.",
    "courier.accepted": "Your courier has been accepted.",
    "courier.status.changed": "Your courier status changed.",
    "home-service.requested": "Your home-service booking is scheduled.",
    "home-service.accepted": "A professional accepted your booking.",
    "home-service.status.changed": "Your home-service status changed.",
    "payment.captured": "Your payment has been captured.",
    "refund.created": "A refund has been created.",
    "payout.created": "A payout has been created.",
    "partner.approved": "Your partner profile has been approved.",
  };
  return bodies[eventType] ?? "You have a new MoveX update.";
}

function notificationTypeForEvent(eventType: string): NotificationType {
  if (eventType.includes("payment") || eventType.includes("refund") || eventType.includes("payout")) {
    return "PAYMENT";
  }
  if (eventType.includes("order") || eventType.includes("courier") || eventType.includes("home-service")) {
    return "ORDER";
  }
  if (eventType.includes("ride")) {
    return "RIDE";
  }
  return "SYSTEM";
}