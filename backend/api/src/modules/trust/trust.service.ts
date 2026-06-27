import { Inject, BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { DisputeReason, DisputeReferenceType, Prisma, UserRole } from "@prisma/client";
import { DisputeStatus, SupportTicketPriority } from "@prisma/client";

import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import type { CancellationPolicyQueryDto, OpenDisputeDto, TrustReferenceType } from "./dto/trust.dto";

type ReferenceContext = {
  customerId: string;
  partnerId?: string | null;
  label: string;
};

type PolicyRule = {
  stage: string;
  window: string;
  fee: string;
  refund: string;
  note: string;
};

const POLICY: Record<string, PolicyRule[]> = {
  FOOD: [
    { stage: "Before store accepts", window: "Until the store accepts the order", fee: "No fee", refund: "Full refund to original method or wallet", note: "Stock is restored immediately." },
    { stage: "Preparing", window: "After acceptance and before pickup", fee: "Up to the delivery fee", refund: "Item value refunded when store confirms no preparation loss", note: "Support can waive fees for partner-caused issues." },
    { stage: "After pickup", window: "Once pickup OTP is verified", fee: "Not normally cancellable", refund: "Dispute review required", note: "Use dispute flow for quality, missing item, or delivery problems." },
  ],
  GROCERY: [
    { stage: "Before picker starts", window: "Until partner begins picking", fee: "No fee", refund: "Full refund", note: "Substitution approvals are cancelled too." },
    { stage: "Picking or packed", window: "After picking starts", fee: "Restocking fee may apply", refund: "Refund minus confirmed restocking fee", note: "Perishable items may need support review." },
  ],
  PHARMACY: [
    { stage: "Before pharmacist verification", window: "Until prescription is verified", fee: "No fee", refund: "Full refund", note: "Uploaded prescription files remain available for audit." },
    { stage: "After verification", window: "After pharmacist approves and packs", fee: "Support-reviewed", refund: "Refund depends on medicine return eligibility", note: "Regulated items require manual review." },
  ],
  RIDE: [
    { stage: "Before driver accepts", window: "Until a driver is assigned", fee: "No fee", refund: "Full refund", note: "No partner time has been reserved yet." },
    { stage: "Driver assigned", window: "Before driver arrives", fee: "Small cancellation fee may apply", refund: "Fare minus fee", note: "Fee is waived for stale driver heartbeat or long ETA drift." },
    { stage: "In ride", window: "After start OTP", fee: "Fare for distance/time already used", refund: "Partial refund only", note: "Safety issues should be disputed." },
  ],
  COURIER: [
    { stage: "Before pickup", window: "Until pickup OTP is verified", fee: "No fee before partner travels; small fee after assignment", refund: "Fare minus applicable travel fee", note: "Parcel remains with sender." },
    { stage: "After pickup", window: "After pickup OTP", fee: "Return/delivery cost may apply", refund: "Support-reviewed", note: "Drop OTP or return confirmation is required." },
  ],
  HOME_SERVICE: [
    { stage: "Before professional accepts", window: "Until a professional accepts", fee: "No fee", refund: "Full refund", note: "Slot is released immediately." },
    { stage: "Within scheduled window", window: "After professional starts travel or arrives", fee: "Visit fee may apply", refund: "Service amount minus visit fee", note: "Fee can be waived for late/no-show professionals." },
  ],
};

@Injectable()
export class TrustService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  cancellationPolicy(query: CancellationPolicyQueryDto) {
    const serviceType = query.serviceType ?? "FOOD";
    const rules = POLICY[serviceType] ?? POLICY.FOOD ?? [];
    return {
      serviceType,
      rules: query.stage ? rules.filter((rule) => rule.stage.toLowerCase().includes(query.stage!.toLowerCase())) : rules,
      disclosure: "Cancellation fees are computed server-side from the latest booking state. Support can waive fees when partner, safety, or payment evidence justifies it.",
    };
  }

  async openDispute(actor: AuthenticatedUser, body: OpenDisputeDto) {
    const reference = await this.resolveReference(body.referenceType, body.referenceId);
    if (reference.customerId !== actor.userId) {
      throw new ForbiddenException("Only the customer on the reference can open a dispute");
    }

    return this.prisma.$transaction(async (tx) => {
      const now = new Date().toISOString();
      const ticket = await tx.supportTicket.create({
        data: {
          userId: actor.userId,
          subject: `Dispute: ${body.referenceType} ${body.referenceId}`,
          message: body.customerNote ?? body.summary,
          priority: SupportTicketPriority.HIGH,
          referenceType: body.referenceType,
          referenceId: body.referenceId,
          metadata: {
            dispute: true,
            messages: [{ id: `msg_${Date.now()}`, actorId: actor.userId, actorRole: actor.role as UserRole, message: body.customerNote ?? body.summary, createdAt: now }],
          },
        },
      });

      const dispute = await tx.dispute.create({
        data: {
          supportTicketId: ticket.id,
          customerId: actor.userId,
          partnerId: reference.partnerId ?? null,
          referenceType: body.referenceType as DisputeReferenceType,
          referenceId: body.referenceId,
          reason: body.reason as DisputeReason,
          summary: body.summary,
          customerNote: body.customerNote,
          actions: {
            create: {
              actorId: actor.userId,
              actorRole: actor.role as UserRole,
              action: "OPENED",
              note: body.customerNote ?? body.summary,
              statusTo: DisputeStatus.OPEN,
              metadata: { referenceLabel: reference.label },
            },
          },
        },
        include: { actions: { orderBy: { createdAt: "asc" } }, supportTicket: true },
      });

      return this.serializeDispute(dispute);
    });
  }

  private async resolveReference(referenceType: TrustReferenceType, referenceId: string): Promise<ReferenceContext> {
    if (referenceType === "ORDER") {
      const order = await this.prisma.order.findUnique({ where: { id: referenceId }, select: { id: true, customerId: true, deliveryPartnerId: true, store: { select: { ownerId: true, name: true } } } });
      if (!order) throw new NotFoundException("Order not found");
      return { customerId: order.customerId, partnerId: order.deliveryPartnerId ?? order.store.ownerId, label: order.store.name };
    }
    if (referenceType === "RIDE") {
      const ride = await this.prisma.ride.findUnique({ where: { id: referenceId }, select: { id: true, customerId: true, driverId: true, vehicleType: true } });
      if (!ride) throw new NotFoundException("Ride not found");
      return { customerId: ride.customerId, partnerId: ride.driverId, label: String(ride.vehicleType) };
    }
    if (referenceType === "COURIER") {
      const courier = await this.prisma.courierBooking.findUnique({ where: { id: referenceId }, select: { id: true, customerId: true, deliveryPartnerId: true, packageDescription: true } });
      if (!courier) throw new NotFoundException("Courier booking not found");
      return { customerId: courier.customerId, partnerId: courier.deliveryPartnerId, label: courier.packageDescription };
    }
    if (referenceType === "HOME_SERVICE") {
      const booking = await this.prisma.homeServiceBooking.findUnique({ where: { id: referenceId }, select: { id: true, customerId: true, professionalId: true, serviceCategory: true } });
      if (!booking) throw new NotFoundException("Home-service booking not found");
      return { customerId: booking.customerId, partnerId: booking.professionalId, label: booking.serviceCategory };
    }
    throw new BadRequestException("Unsupported dispute reference type");
  }

  private serializeDispute(dispute: Prisma.DisputeGetPayload<{ include: { actions: true; supportTicket: true } }>) {
    return {
      ...dispute,
      createdAt: dispute.createdAt.toISOString(),
      updatedAt: dispute.updatedAt.toISOString(),
      resolvedAt: dispute.resolvedAt?.toISOString() ?? null,
      actions: dispute.actions.map((action) => ({ ...action, createdAt: action.createdAt.toISOString() })),
      supportTicket: { ...dispute.supportTicket, createdAt: dispute.supportTicket.createdAt.toISOString(), updatedAt: dispute.supportTicket.updatedAt.toISOString() },
    };
  }
}