import { Inject, Injectable } from "@nestjs/common";
import { UserRole } from "@prisma/client";

import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";

const STAFF_ROLES = new Set<string>([UserRole.SUPPORT, UserRole.FINANCE, UserRole.ADMIN, UserRole.SUPER_ADMIN]);

@Injectable()
export class RealtimeSubscriptionService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async canSubscribe(user: AuthenticatedUser, topic: string): Promise<boolean> {
    const parsed = this.parseTopic(topic);

    if (!parsed) {
      return false;
    }

    if (STAFF_ROLES.has(user.role)) {
      return true;
    }

    if ((parsed.kind === "user" || parsed.kind === "partner") && parsed.id === user.userId) {
      return true;
    }

    if (parsed.kind === "order") {
      const order = await this.prisma.order.findUnique({
        where: { id: parsed.id },
        select: { customerId: true, deliveryPartnerId: true, store: { select: { ownerId: true } } },
      });

      return Boolean(order && [order.customerId, order.deliveryPartnerId, order.store.ownerId].includes(user.userId));
    }

    if (parsed.kind === "ride") {
      const ride = await this.prisma.ride.findUnique({
        where: { id: parsed.id },
        select: { customerId: true, driverId: true },
      });

      return Boolean(ride && [ride.customerId, ride.driverId].includes(user.userId));
    }

    if (parsed.kind === "courier") {
      const booking = await this.prisma.courierBooking.findUnique({
        where: { id: parsed.id },
        select: { customerId: true, deliveryPartnerId: true },
      });

      return Boolean(booking && [booking.customerId, booking.deliveryPartnerId].includes(user.userId));
    }

    if (parsed.kind === "home-service") {
      const booking = await this.prisma.homeServiceBooking.findUnique({
        where: { id: parsed.id },
        select: { customerId: true, professionalId: true },
      });

      return Boolean(booking && [booking.customerId, booking.professionalId].includes(user.userId));
    }

    return false;
  }

  private parseTopic(topic: string): { kind: string; id: string } | null {
    const [kind, id, ...rest] = topic.split(":");

    if (!kind || !id || rest.length > 0) {
      return null;
    }

    if (!["user", "partner", "order", "ride", "courier", "home-service"].includes(kind)) {
      return null;
    }

    return { kind, id };
  }
}