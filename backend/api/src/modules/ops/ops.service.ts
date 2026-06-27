import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { CouponDiscountType, DisputeStatus, Prisma, ServiceType, SupportTicketPriority, UserRole } from "@prisma/client";

import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import type {
  AuditQueryDto,
  ConfigQueryDto,
  CouponQueryDto,
  CreateTicketDto,
  DisputeActionDto,
  DisputeQueryDto,
  TicketMessageDto,
  TicketQueryDto,
  UpdateTicketDto,
  UpsertConfigDto,
  UpsertCouponDto,
} from "./dto/ops.dto";

type TicketMessage = {
  id: string;
  actorId: string;
  actorRole: string;
  message: string;
  createdAt: string;
};

type DisputeWithDetails = Prisma.DisputeGetPayload<{
  include: {
    supportTicket: true;
    customer: { select: { id: true; name: true; email: true; phoneE164: true; role: true } };
    partner: { select: { id: true; name: true; email: true; phoneE164: true; role: true } };
    actions: true;
  };
}>;

const SECRET_ALGORITHM = "aes-256-gcm";
const SECRET_MASK = "********";

@Injectable()
export class OpsService {
  constructor(private readonly prisma: PrismaService) {}

  async listCoupons(query: CouponQueryDto) {
    const limit = query.limit ?? 25;
    const where: Prisma.CouponWhereInput = {
      ...(query.serviceType ? { serviceType: query.serviceType } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.q ? { OR: [{ code: { contains: query.q, mode: "insensitive" } }, { title: { contains: query.q, mode: "insensitive" } }] } : {}),
    };
    const coupons = await this.prisma.coupon.findMany({
      where: { ...where, ...(query.cursor ? { createdAt: { lt: new Date(query.cursor) } } : {}) },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
    });
    const page = coupons.slice(0, limit);
    return { items: page.map((coupon) => this.serializeCoupon(coupon)), nextCursor: coupons.length > limit ? page.at(-1)?.createdAt.toISOString() : undefined };
  }

  async createCoupon(body: UpsertCouponDto) {
    const coupon = await this.prisma.coupon.create({ data: this.couponData(body) });
    return this.serializeCoupon(coupon);
  }

  async updateCoupon(couponId: string, body: UpsertCouponDto) {
    const coupon = await this.prisma.coupon.update({ where: { id: couponId }, data: this.couponData(body) });
    return this.serializeCoupon(coupon);
  }

  async deactivateCoupon(couponId: string) {
    const coupon = await this.prisma.coupon.update({ where: { id: couponId }, data: { isActive: false } });
    return this.serializeCoupon(coupon);
  }

  async listConfig(query: ConfigQueryDto) {
    const limit = query.limit ?? 25;
    const configs = await this.prisma.systemConfig.findMany({
      where: {
        ...(query.q ? { key: { contains: query.q, mode: "insensitive" } } : {}),
        ...(query.cursor ? { updatedAt: { lt: new Date(query.cursor) } } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: limit + 1,
    });
    const page = configs.slice(0, limit);
    return { items: page.map((config) => this.serializeConfig(config)), nextCursor: configs.length > limit ? page.at(-1)?.updatedAt.toISOString() : undefined };
  }

  async upsertConfig(key: string, body: UpsertConfigDto) {
    const value = (body.isSecret ? this.encryptSecret(body.value) : body.value) as Prisma.InputJsonValue;
    const config = await this.prisma.systemConfig.upsert({
      where: { key },
      update: { value, description: body.description, isSecret: body.isSecret ?? false },
      create: { key, value, description: body.description, isSecret: body.isSecret ?? false },
    });
    return this.serializeConfig(config);
  }

  async listTickets(query: TicketQueryDto) {
    const limit = query.limit ?? 25;
    const tickets = await this.prisma.supportTicket.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.priority ? { priority: query.priority } : {}),
        ...(query.referenceType ? { referenceType: query.referenceType } : {}),
        ...(query.referenceId ? { referenceId: query.referenceId } : {}),
        ...(query.cursor ? { createdAt: { lt: new Date(query.cursor) } } : {}),
      },
      include: { user: { select: { id: true, name: true, phoneE164: true, email: true } }, assignedTo: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
    });
    const page = tickets.slice(0, limit);
    return { items: page.map((ticket) => this.serializeTicket(ticket)), nextCursor: tickets.length > limit ? page.at(-1)?.createdAt.toISOString() : undefined };
  }

  async createTicket(actor: AuthenticatedUser, body: CreateTicketDto) {
    await this.ensureReferenceExists(body.referenceType, body.referenceId);
    const now = new Date().toISOString();
    const ticket = await this.prisma.supportTicket.create({
      data: {
        userId: body.userId,
        assignedToId: actor.userId,
        subject: body.subject,
        message: body.message,
        priority: body.priority ?? SupportTicketPriority.MEDIUM,
        referenceType: body.referenceType,
        referenceId: body.referenceId,
        metadata: { messages: [{ id: `msg_${Date.now()}`, actorId: actor.userId, actorRole: actor.role, message: body.message, createdAt: now }] },
      },
      include: { user: { select: { id: true, name: true, phoneE164: true, email: true } }, assignedTo: { select: { id: true, name: true, email: true } } },
    });
    return this.serializeTicket(ticket);
  }

  async getTicket(ticketId: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: { user: { select: { id: true, name: true, phoneE164: true, email: true } }, assignedTo: { select: { id: true, name: true, email: true } } },
    });
    if (!ticket) {
      throw new NotFoundException("Support ticket not found");
    }
    return this.serializeTicket(ticket);
  }

  async updateTicket(ticketId: string, body: UpdateTicketDto) {
    const ticket = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: body.status, priority: body.priority, assignedToId: body.assignedToId },
      include: { user: { select: { id: true, name: true, phoneE164: true, email: true } }, assignedTo: { select: { id: true, name: true, email: true } } },
    });
    return this.serializeTicket(ticket);
  }

  async addTicketMessage(actor: AuthenticatedUser, ticketId: string, body: TicketMessageDto) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      throw new NotFoundException("Support ticket not found");
    }
    const messages = this.ticketMessages(ticket.metadata);
    const nextMessage: TicketMessage = { id: `msg_${Date.now()}`, actorId: actor.userId, actorRole: actor.role, message: body.message, createdAt: new Date().toISOString() };
    const updated = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { metadata: { ...(this.metadataRecord(ticket.metadata)), messages: [...messages, nextMessage] } },
      include: { user: { select: { id: true, name: true, phoneE164: true, email: true } }, assignedTo: { select: { id: true, name: true, email: true } } },
    });
    return this.serializeTicket(updated);
  }
  async listDisputes(query: DisputeQueryDto) {
    const limit = query.limit ?? 25;
    const disputes = await this.prisma.dispute.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.reason ? { reason: query.reason } : {}),
        ...(query.customerId ? { customerId: query.customerId } : {}),
        ...(query.partnerId ? { partnerId: query.partnerId } : {}),
        ...(query.referenceType ? { referenceType: query.referenceType } : {}),
        ...(query.referenceId ? { referenceId: query.referenceId } : {}),
        ...(query.cursor ? { createdAt: { lt: new Date(query.cursor) } } : {}),
      },
      include: this.disputeInclude(),
      orderBy: { createdAt: "desc" },
      take: limit + 1,
    });
    const page = disputes.slice(0, limit);
    return { items: page.map((dispute) => this.serializeDispute(dispute)), nextCursor: disputes.length > limit ? page.at(-1)?.createdAt.toISOString() : undefined };
  }

  async getDispute(disputeId: string) {
    const dispute = await this.prisma.dispute.findUnique({ where: { id: disputeId }, include: this.disputeInclude() });
    if (!dispute) {
      throw new NotFoundException("Dispute not found");
    }
    return this.serializeDispute(dispute);
  }

  async actionDispute(actor: AuthenticatedUser, disputeId: string, body: DisputeActionDto) {
    return this.prisma.$transaction(async (tx) => {
      const dispute = await tx.dispute.findUnique({ where: { id: disputeId } });
      if (!dispute) {
        throw new NotFoundException("Dispute not found");
      }
      if ([DisputeStatus.RESOLVED, DisputeStatus.REJECTED].includes(dispute.status) && body.status && body.status !== dispute.status) {
        throw new BadRequestException("Resolved disputes cannot move to a different state");
      }

      const actionName = (body.action ?? "SUPPORT_ACTION").trim().toUpperCase();
      const nextStatus = body.status ?? (dispute.status === DisputeStatus.OPEN ? DisputeStatus.UNDER_REVIEW : dispute.status);
      const resolution = body.resolution ?? dispute.resolution;
      await tx.disputeAction.create({
        data: {
          disputeId,
          actorId: actor.userId,
          actorRole: actor.role as UserRole,
          action: actionName,
          note: body.note?.trim() || null,
          statusFrom: dispute.status,
          statusTo: nextStatus,
          resolution,
          metadata: { supportTicketId: dispute.supportTicketId, referenceType: dispute.referenceType, referenceId: dispute.referenceId },
        },
      });
      await tx.dispute.update({
        where: { id: disputeId },
        data: {
          status: nextStatus,
          resolution,
          resolvedAt: [DisputeStatus.RESOLVED, DisputeStatus.REJECTED].includes(nextStatus) ? new Date() : dispute.resolvedAt,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          actorRole: actor.role as UserRole,
          action: `DISPUTE_${actionName}`,
          entityType: "Dispute",
          entityId: disputeId,
          metadata: { statusFrom: dispute.status, statusTo: nextStatus, resolution, note: body.note ?? null },
        },
      });
    });

    return this.getDispute(disputeId);
  }

  async resolveDispute(actor: AuthenticatedUser, disputeId: string, body: DisputeActionDto) {
    if (!body.resolution) {
      throw new BadRequestException("Resolution is required");
    }
    return this.actionDispute(actor, disputeId, { ...body, action: body.action ?? "RESOLVED", status: body.status ?? DisputeStatus.RESOLVED });
  }

  async listAuditLogs(query: AuditQueryDto) {
    const limit = query.limit ?? 25;
    const logs = await this.prisma.auditLog.findMany({
      where: {
        ...(query.actorId ? { actorId: query.actorId } : {}),
        ...(query.action ? { action: { contains: query.action, mode: "insensitive" } } : {}),
        ...(query.entityType ? { entityType: query.entityType } : {}),
        ...(query.cursor ? { createdAt: { lt: new Date(query.cursor) } } : {}),
      },
      include: { actor: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
    });
    const page = logs.slice(0, limit);
    return { items: page.map((log) => ({ ...log, createdAt: log.createdAt.toISOString() })), nextCursor: logs.length > limit ? page.at(-1)?.createdAt.toISOString() : undefined };
  }

  private couponData(body: UpsertCouponDto): Prisma.CouponUncheckedCreateInput {
    return {
      code: body.code.trim().toUpperCase(),
      title: body.title,
      description: body.description,
      serviceType: body.serviceType as ServiceType | undefined,
      campaignName: body.campaignName?.trim() || null,
      campaignTag: body.campaignTag?.trim().toUpperCase() || null,
      firstOrderOnly: body.firstOrderOnly ?? false,
      metadata: body.metadata ?? undefined,
      discountType: body.discountType as CouponDiscountType,
      discountValue: new Prisma.Decimal(body.discountValue),
      maxDiscount: body.maxDiscount === undefined ? null : new Prisma.Decimal(body.maxDiscount),
      minOrderValue: body.minOrderValue === undefined ? null : new Prisma.Decimal(body.minOrderValue),
      startsAt: body.startsAt ? new Date(body.startsAt) : null,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      usageLimit: body.usageLimit ?? null,
      perUserLimit: body.perUserLimit ?? null,
      isActive: body.isActive ?? true,
    };
  }

  private async ensureReferenceExists(referenceType?: string, referenceId?: string): Promise<void> {
    if (!referenceType || !referenceId) {
      return;
    }

    if (referenceType === "ORDER") {
      const found = await this.prisma.order.findUnique({ where: { id: referenceId }, select: { id: true } });
      if (!found) {
        throw new NotFoundException("Order not found");
      }
      return;
    }

    if (referenceType === "RIDE") {
      const found = await this.prisma.ride.findUnique({ where: { id: referenceId }, select: { id: true } });
      if (!found) {
        throw new NotFoundException("Ride not found");
      }
      return;
    }

    if (referenceType === "COURIER") {
      const found = await this.prisma.courierBooking.findUnique({ where: { id: referenceId }, select: { id: true } });
      if (!found) {
        throw new NotFoundException("Courier booking not found");
      }
      return;
    }

    if (referenceType === "HOME_SERVICE") {
      const found = await this.prisma.homeServiceBooking.findUnique({ where: { id: referenceId }, select: { id: true } });
      if (!found) {
        throw new NotFoundException("Home-service booking not found");
      }
      return;
    }

    throw new BadRequestException("Unsupported ticket reference type");
  }

  private disputeInclude() {
    return {
      supportTicket: true,
      customer: { select: { id: true, name: true, email: true, phoneE164: true, role: true } },
      partner: { select: { id: true, name: true, email: true, phoneE164: true, role: true } },
      actions: { orderBy: { createdAt: "asc" as const } },
    };
  }

  private serializeDispute(dispute: DisputeWithDetails) {
    return {
      ...dispute,
      createdAt: dispute.createdAt.toISOString(),
      updatedAt: dispute.updatedAt.toISOString(),
      resolvedAt: dispute.resolvedAt?.toISOString() ?? null,
      actions: dispute.actions.map((action) => ({ ...action, createdAt: action.createdAt.toISOString() })),
      supportTicket: { ...dispute.supportTicket, createdAt: dispute.supportTicket.createdAt.toISOString(), updatedAt: dispute.supportTicket.updatedAt.toISOString() },
    };
  }
  private serializeCoupon(coupon: { id: string; code: string; title: string; description: string | null; serviceType: ServiceType | null; campaignName: string | null; campaignTag: string | null; firstOrderOnly: boolean; metadata: Prisma.JsonValue | null; discountType: CouponDiscountType; discountValue: Prisma.Decimal; maxDiscount: Prisma.Decimal | null; minOrderValue: Prisma.Decimal | null; startsAt: Date | null; expiresAt: Date | null; usageLimit: number | null; usageCount: number; perUserLimit: number | null; isActive: boolean; createdAt: Date; updatedAt: Date }) {
    return {
      ...coupon,
      discountValue: coupon.discountValue.toString(),
      maxDiscount: coupon.maxDiscount?.toString() ?? null,
      minOrderValue: coupon.minOrderValue?.toString() ?? null,
      startsAt: coupon.startsAt?.toISOString() ?? null,
      expiresAt: coupon.expiresAt?.toISOString() ?? null,
      createdAt: coupon.createdAt.toISOString(),
      updatedAt: coupon.updatedAt.toISOString(),
    };
  }

  private serializeConfig(config: { key: string; value: Prisma.JsonValue; description: string | null; isSecret: boolean; updatedAt: Date }) {
    return {
      key: config.key,
      value: config.isSecret ? { masked: SECRET_MASK } : config.value,
      description: config.description,
      isSecret: config.isSecret,
      updatedAt: config.updatedAt.toISOString(),
    };
  }

  private serializeTicket(ticket: Prisma.SupportTicketGetPayload<{ include: { user: { select: { id: true; name: true; phoneE164: true; email: true } }; assignedTo: { select: { id: true; name: true; email: true } } } }>) {
    return {
      ...ticket,
      messages: this.ticketMessages(ticket.metadata),
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
    };
  }

  private ticketMessages(metadata: Prisma.JsonValue): TicketMessage[] {
    const record = this.metadataRecord(metadata);
    return Array.isArray(record.messages) ? (record.messages.filter((item) => item && typeof item === "object") as TicketMessage[]) : [];
  }

  private metadataRecord(metadata: Prisma.JsonValue): Record<string, unknown> {
    return metadata && typeof metadata === "object" && !Array.isArray(metadata) ? (metadata as Record<string, unknown>) : {};
  }

  private encryptSecret(value: Record<string, unknown>): Prisma.InputJsonValue {
    const key = this.secretKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv(SECRET_ALGORITHM, key, iv);
    const plaintext = Buffer.from(JSON.stringify(value), "utf8");
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    return { encrypted: true, alg: SECRET_ALGORITHM, iv: iv.toString("base64"), tag: tag.toString("base64"), ciphertext: ciphertext.toString("base64") };
  }

  private secretKey(): Buffer {
    const raw = process.env.CONFIG_SECRET_KEY ?? process.env.SESSION_SECRET ?? "movex-dev-config-secret";
    return createHash("sha256").update(raw).digest();
  }
}