import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma, ServiceType } from "@prisma/client";

import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { AnalyticsQueryDto, FeatureFlagQueryDto, RefreshAnalyticsDto, SearchRebuildDto, UpsertFeatureFlagDto } from "./dto/platform.dto";

type ProjectionAccumulator = {
  ordersCount: number;
  ridesCount: number;
  courierCount: number;
  homeServiceCount: number;
  gmv: Prisma.Decimal;
  partnerIds: Set<string>;
};

const ALL_SCOPE = "ALL";

@Injectable()
export class PlatformService {
  constructor(private readonly prisma: PrismaService) {}

  async analytics(query: AnalyticsQueryDto) {
    const range = this.resolveDateRange(query.from, query.to);
    const rows = await this.prisma.analyticsDailyProjection.findMany({
      where: {
        date: { gte: range.from, lte: range.to },
        ...(query.scope ? { scope: query.scope } : {}),
      },
      orderBy: [{ date: "asc" }, { scope: "asc" }],
    });

    const totals = rows.reduce(
      (summary, row) => ({
        ordersCount: summary.ordersCount + row.ordersCount,
        ridesCount: summary.ridesCount + row.ridesCount,
        courierCount: summary.courierCount + row.courierCount,
        homeServiceCount: summary.homeServiceCount + row.homeServiceCount,
        gmv: summary.gmv.plus(row.gmv),
        activePartners: Math.max(summary.activePartners, row.activePartners),
      }),
      {
        ordersCount: 0,
        ridesCount: 0,
        courierCount: 0,
        homeServiceCount: 0,
        gmv: new Prisma.Decimal(0),
        activePartners: 0,
      },
    );

    return {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      totals: { ...totals, gmv: totals.gmv.toString() },
      rows: rows.map((row) => ({
        id: row.id,
        date: row.date.toISOString().slice(0, 10),
        scope: row.scope,
        ordersCount: row.ordersCount,
        ridesCount: row.ridesCount,
        courierCount: row.courierCount,
        homeServiceCount: row.homeServiceCount,
        gmv: row.gmv.toString(),
        activePartners: row.activePartners,
        refreshedAt: row.refreshedAt.toISOString(),
      })),
    };
  }

  async refreshAnalytics(query: RefreshAnalyticsDto) {
    const range = this.resolveDateRange(query.from, query.to);
    const days = this.daysInRange(range.from, range.to);
    let upserted = 0;

    for (const date of days) {
      const next = new Date(date);
      next.setUTCDate(next.getUTCDate() + 1);
      const scopes = await this.buildDailyProjection(date, next);

      for (const [scope, projection] of scopes) {
        await this.prisma.analyticsDailyProjection.upsert({
          where: { date_scope: { date, scope } },
          update: {
            ordersCount: projection.ordersCount,
            ridesCount: projection.ridesCount,
            courierCount: projection.courierCount,
            homeServiceCount: projection.homeServiceCount,
            gmv: projection.gmv,
            activePartners: projection.partnerIds.size,
            refreshedAt: new Date(),
          },
          create: {
            date,
            scope,
            ordersCount: projection.ordersCount,
            ridesCount: projection.ridesCount,
            courierCount: projection.courierCount,
            homeServiceCount: projection.homeServiceCount,
            gmv: projection.gmv,
            activePartners: projection.partnerIds.size,
            refreshedAt: new Date(),
          },
        });
        upserted += 1;
      }
    }

    return { upserted, from: range.from.toISOString(), to: range.to.toISOString() };
  }

  async listFeatureFlags(query: FeatureFlagQueryDto) {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
    const flags = await this.prisma.featureFlag.findMany({
      where: query.q
        ? {
            OR: [
              { key: { contains: query.q, mode: "insensitive" } },
              { description: { contains: query.q, mode: "insensitive" } },
            ],
          }
        : {},
      orderBy: { key: "asc" },
      take: limit + 1,
      ...(query.cursor ? { cursor: { key: query.cursor }, skip: 1 } : {}),
    });
    const page = flags.slice(0, limit);
    return { items: page.map(this.toFeatureFlag), nextCursor: flags.length > limit ? page.at(-1)?.key : undefined };
  }

  async upsertFeatureFlag(key: string, actor: AuthenticatedUser, body: UpsertFeatureFlagDto) {
    const normalizedKey = key.trim().toLowerCase();

    if (!/^[a-z0-9][a-z0-9._:-]{1,79}$/.test(normalizedKey)) {
      throw new BadRequestException("Feature flag keys must be 2-80 lowercase URL-safe characters");
    }

    const flag = await this.prisma.featureFlag.upsert({
      where: { key: normalizedKey },
      update: {
        description: body.description,
        enabled: body.enabled,
        rollout: body.rollout ?? {},
        updatedById: actor.userId,
      },
      create: {
        key: normalizedKey,
        description: body.description,
        enabled: body.enabled,
        rollout: body.rollout ?? {},
        updatedById: actor.userId,
      },
    });

    return this.toFeatureFlag(flag);
  }

  async requestSearchRebuild(actor: AuthenticatedUser, body: SearchRebuildDto) {
    const event = await this.prisma.outboxEvent.create({
      data: {
        type: "search.rebuild.requested",
        payload: {
          scope: body.scope ?? "stores",
          requestedBy: actor.userId,
        },
      },
    });

    return { accepted: true, eventId: event.id };
  }

  private async buildDailyProjection(from: Date, to: Date): Promise<Map<string, ProjectionAccumulator>> {
    const scopes = new Map<string, ProjectionAccumulator>();
    const all = this.scope(scopes, ALL_SCOPE);

    const [orders, rides, couriers, homeServices, activePartnerSessions] = await Promise.all([
      this.prisma.order.findMany({ where: { createdAt: { gte: from, lt: to } }, select: { serviceType: true, total: true, deliveryPartnerId: true } }),
      this.prisma.ride.findMany({ where: { createdAt: { gte: from, lt: to } }, select: { finalFare: true, estimatedFare: true, driverId: true } }),
      this.prisma.courierBooking.findMany({ where: { createdAt: { gte: from, lt: to } }, select: { finalFare: true, estimatedFare: true, deliveryPartnerId: true } }),
      this.prisma.homeServiceBooking.findMany({ where: { createdAt: { gte: from, lt: to } }, select: { finalFare: true, estimatedFare: true, professionalId: true } }),
      this.prisma.partnerOnlineSession.findMany({ where: { startedAt: { lt: to }, OR: [{ endedAt: null }, { endedAt: { gte: from } }] }, select: { userId: true } }),
    ]);

    for (const order of orders) {
      const scoped = this.scope(scopes, order.serviceType);
      scoped.ordersCount += 1;
      scoped.gmv = scoped.gmv.plus(order.total);
      all.ordersCount += 1;
      all.gmv = all.gmv.plus(order.total);
      if (order.deliveryPartnerId) {
        scoped.partnerIds.add(order.deliveryPartnerId);
        all.partnerIds.add(order.deliveryPartnerId);
      }
    }

    for (const ride of rides) {
      const scoped = this.scope(scopes, ServiceType.RIDE);
      const fare = ride.finalFare ?? ride.estimatedFare;
      scoped.ridesCount += 1;
      scoped.gmv = scoped.gmv.plus(fare);
      all.ridesCount += 1;
      all.gmv = all.gmv.plus(fare);
      if (ride.driverId) {
        scoped.partnerIds.add(ride.driverId);
        all.partnerIds.add(ride.driverId);
      }
    }

    for (const courier of couriers) {
      const scoped = this.scope(scopes, ServiceType.COURIER);
      const fare = courier.finalFare ?? courier.estimatedFare;
      scoped.courierCount += 1;
      scoped.gmv = scoped.gmv.plus(fare);
      all.courierCount += 1;
      all.gmv = all.gmv.plus(fare);
      if (courier.deliveryPartnerId) {
        scoped.partnerIds.add(courier.deliveryPartnerId);
        all.partnerIds.add(courier.deliveryPartnerId);
      }
    }

    for (const booking of homeServices) {
      const scoped = this.scope(scopes, ServiceType.HOME_SERVICE);
      const fare = booking.finalFare ?? booking.estimatedFare;
      scoped.homeServiceCount += 1;
      scoped.gmv = scoped.gmv.plus(fare);
      all.homeServiceCount += 1;
      all.gmv = all.gmv.plus(fare);
      if (booking.professionalId) {
        scoped.partnerIds.add(booking.professionalId);
        all.partnerIds.add(booking.professionalId);
      }
    }

    for (const session of activePartnerSessions) {
      all.partnerIds.add(session.userId);
    }

    return scopes;
  }

  private scope(scopes: Map<string, ProjectionAccumulator>, scope: string): ProjectionAccumulator {
    const existing = scopes.get(scope);
    if (existing) {
      return existing;
    }

    const next = {
      ordersCount: 0,
      ridesCount: 0,
      courierCount: 0,
      homeServiceCount: 0,
      gmv: new Prisma.Decimal(0),
      partnerIds: new Set<string>(),
    };
    scopes.set(scope, next);
    return next;
  }

  private resolveDateRange(from?: string, to?: string) {
    const now = new Date();
    const end = to ? this.parseDate(to, "to") : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const start = from ? this.parseDate(from, "from") : new Date(end.getTime() - 13 * 24 * 60 * 60 * 1000);

    if (start > end) {
      throw new BadRequestException("from must be before to");
    }

    return { from: start, to: end };
  }

  private parseDate(value: string, field: string) {
    const parsed = new Date(`${value}T00:00:00.000Z`);

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${field} must be a YYYY-MM-DD date`);
    }

    return parsed;
  }

  private daysInRange(from: Date, to: Date) {
    const days: Date[] = [];
    const cursor = new Date(from);

    while (cursor <= to) {
      days.push(new Date(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return days;
  }

  private toFeatureFlag(flag: { key: string; description: string | null; enabled: boolean; rollout: Prisma.JsonValue; updatedById: string | null; createdAt: Date; updatedAt: Date }) {
    return {
      key: flag.key,
      description: flag.description,
      enabled: flag.enabled,
      rollout: flag.rollout,
      updatedById: flag.updatedById,
      createdAt: flag.createdAt.toISOString(),
      updatedAt: flag.updatedAt.toISOString(),
    };
  }
}
