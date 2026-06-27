import { randomBytes } from "node:crypto";
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { CourierStatus, HomeServiceStatus, LedgerEntryType, OrderStatus, PartnerShiftStatus, PayoutStatus, Prisma, RideStatus, UserRole } from "@prisma/client";
import { RedisStoreService } from "../../infrastructure/redis/redis-store.service";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { REALTIME_PROVIDER, type RealtimeProvider } from "../realtime/realtime-provider";
import { IdentityRepository } from "./identity.repository";
import type { PublicUser, SessionRecord } from "./identity.types";
import { SessionService } from "./session/session.service";
import type { AddressDto, UpdateAddressDto } from "./dto/address.dto";
import type { AdminUsersQueryDto } from "./dto/admin-users-query.dto";
import { StubRouteOptimizationProvider } from "../partner-ops/route-optimization.provider";

const APPROVED = "APPROVED";
const LOCATION_TTL_MS = 30_000;
const REFERRAL_REFEREE_CREDIT = new Prisma.Decimal(process.env.REFERRAL_REFEREE_CREDIT ?? "50");
const PARTNER_ROLES = new Set<string>([UserRole.RESTAURANT, UserRole.DELIVERY, UserRole.DRIVER]);
function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfWeek(date: Date): Date {
  const next = startOfDay(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  return next;
}

function secondsBetween(start: Date, end: Date): number {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
}

@Injectable()
export class UsersService {
  constructor(
    @Inject(IdentityRepository) private readonly repository: IdentityRepository,
    @Inject(SessionService) private readonly sessionService: SessionService,
    @Inject(RedisStoreService) private readonly redisStore: RedisStoreService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(REALTIME_PROVIDER) private readonly realtimeProvider: RealtimeProvider,
  ) {}

  async getMe(session: SessionRecord): Promise<PublicUser> {
    const user = await this.repository.findUserById(session.userId);

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return this.sessionService.toPublicUser(user);
  }

  async updateMe(session: SessionRecord, input: { name?: string; email?: string; avatarUrl?: string }): Promise<PublicUser> {
    const user = await this.repository.updateUserProfile(session.userId, input);
    return this.sessionService.toPublicUser(user);
  }
  async getRetentionSummary(session: SessionRecord) {
    const user = await this.ensureReferralCode(session.userId);
    const [entries, referralsMade, referralReceived] = await Promise.all([
      this.prisma.ledgerEntry.findMany({ where: { userId: session.userId, type: { in: [LedgerEntryType.LOYALTY, LedgerEntryType.PROMOTION] } }, select: { type: true, amount: true, description: true } }),
      this.prisma.referral.count({ where: { referrerId: session.userId } }),
      this.prisma.referral.findUnique({ where: { refereeId: session.userId }, select: { code: true, referrerCreditedAt: true, refereeCreditedAt: true } }),
    ]);

    const loyaltyPoints = entries.filter((entry) => entry.type === LedgerEntryType.LOYALTY).reduce((sum, entry) => sum.plus(entry.amount), new Prisma.Decimal(0));
    const referralCredits = entries.filter((entry) => entry.type === LedgerEntryType.PROMOTION && entry.description.toLowerCase().includes("referral")).reduce((sum, entry) => sum.plus(entry.amount), new Prisma.Decimal(0));

    return {
      referralCode: user.referralCode,
      walletBalance: user.walletBalanceCached.toString(),
      loyaltyPoints: loyaltyPoints.toDecimalPlaces(0).toString(),
      referralCredits: referralCredits.toString(),
      referralsMade,
      referralReceived,
    };
  }

  async applyReferral(session: SessionRecord, input: { code: string }) {
    if (session.user.role !== UserRole.CUSTOMER) {
      throw new ForbiddenException("Only customers can apply referral codes");
    }

    const code = input.code.trim().toUpperCase();
    const referrer = await this.prisma.user.findUnique({ where: { referralCode: code }, select: { id: true, role: true } });
    if (!referrer || referrer.id === session.userId) {
      throw new BadRequestException("Referral code is invalid");
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.referral.findUnique({ where: { refereeId: session.userId } });
      if (existing) {
        throw new BadRequestException("A referral has already been applied");
      }

      const referral = await tx.referral.create({ data: { referrerId: referrer.id, refereeId: session.userId, code } });
      await tx.user.update({ where: { id: session.userId }, data: { referredById: referrer.id } });
      await tx.ledgerEntry.create({
        data: {
          userId: session.userId,
          userRole: UserRole.CUSTOMER,
          type: LedgerEntryType.PROMOTION,
          amount: REFERRAL_REFEREE_CREDIT,
          description: `Referral signup credit from ${code}`,
          paymentId: `referral:referee:${referral.id}`,
        },
      });
      await tx.referral.update({ where: { id: referral.id }, data: { refereeCreditedAt: new Date() } });
      const balance = await this.reconcileWalletBalance(tx, session.userId);
      return { referral, balance };
    });

    return { applied: true, referralId: result.referral.id, credit: REFERRAL_REFEREE_CREDIT.toString(), walletBalance: result.balance.toString() };
  }

  async listFavorites(session: SessionRecord, query: { type?: "STORE" | "MENU_ITEM" }) {
    const favorites = await this.prisma.favorite.findMany({
      where: { userId: session.userId, ...(query.type === "STORE" ? { storeId: { not: null } } : query.type === "MENU_ITEM" ? { menuItemId: { not: null } } : {}) },
      include: { store: true, menuItem: { include: { store: true } } },
      orderBy: { createdAt: "desc" },
    });

    return { items: favorites.map((favorite) => this.serializeFavorite(favorite)) };
  }

  async saveFavorite(session: SessionRecord, input: { type: "STORE" | "MENU_ITEM"; targetId: string }) {
    if (input.type === "STORE") {
      const store = await this.prisma.store.findUnique({ where: { id: input.targetId }, select: { id: true } });
      if (!store) {
        throw new NotFoundException("Store not found");
      }
      const existing = await this.prisma.favorite.findFirst({ where: { userId: session.userId, storeId: input.targetId } });
      const favorite = existing ?? (await this.prisma.favorite.create({ data: { userId: session.userId, storeId: input.targetId } }));
      return this.getFavorite(favorite.id);
    }

    const menuItem = await this.prisma.menuItem.findUnique({ where: { id: input.targetId }, select: { id: true } });
    if (!menuItem) {
      throw new NotFoundException("Menu item not found");
    }
    const existing = await this.prisma.favorite.findFirst({ where: { userId: session.userId, menuItemId: input.targetId } });
    const favorite = existing ?? (await this.prisma.favorite.create({ data: { userId: session.userId, menuItemId: input.targetId } }));
    return this.getFavorite(favorite.id);
  }

  async removeFavorite(session: SessionRecord, input: { type: "STORE" | "MENU_ITEM"; targetId: string }): Promise<{ removed: true }> {
    await this.prisma.favorite.deleteMany({ where: { userId: session.userId, ...(input.type === "STORE" ? { storeId: input.targetId } : { menuItemId: input.targetId }) } });
    return { removed: true };
  }

  listAddresses(session: SessionRecord) {
    return this.repository.listAddresses(session.userId);
  }

  createAddress(session: SessionRecord, input: AddressDto) {
    return this.repository.createAddress(session.userId, input);
  }

  async updateAddress(session: SessionRecord, addressId: string, input: UpdateAddressDto) {

    try {
      return await this.repository.updateAddress(session.userId, addressId, input);
    } catch {
      throw new NotFoundException("Address not found");
    }
  }

  async deleteAddress(session: SessionRecord, addressId: string): Promise<{ deleted: true }> {

    try {
      await this.repository.deleteAddress(session.userId, addressId);
    } catch {
      throw new NotFoundException("Address not found");
    }

    return { deleted: true };
  }

  async submitPartnerProfile(session: SessionRecord, input: { name?: string; avatarUrl?: string }): Promise<PublicUser> {
    const user = await this.repository.submitPartnerProfile(session.userId, input);
    return this.sessionService.toPublicUser(user);
  }

  async setOnline(session: SessionRecord, isOnline: boolean): Promise<PublicUser> {
    this.assertApprovedPartner(session);
    const user = await this.repository.setUserOnline(session.userId, isOnline);
    if (isOnline) {
      await this.startOnlineSession(session.userId);
    } else {
      await this.endOnlineSession(session.userId);
    }
    return this.sessionService.toPublicUser(user);
  }

  async writeLocation(session: SessionRecord, input: { lat: number; lng: number; vehicleType?: string }): Promise<{ ok: true }> {
    this.assertApprovedPartner(session);

    const heartbeat = {
      userId: session.userId,
      role: session.user.role,
      vehicleType: input.vehicleType ?? null,
      lat: input.lat,
      lng: input.lng,
      at: new Date().toISOString(),
    };

    await this.redisStore.writeGeoWithHeartbeat({
      geoKey: `geo:partners:${session.user.role.toLowerCase()}`,
      heartbeatKey: `heartbeat:partner:${session.userId}`,
      member: session.userId,
      lat: input.lat,
      lng: input.lng,
      ttlMs: LOCATION_TTL_MS,
      payload: heartbeat,
    });

    if (session.user.role === UserRole.DRIVER && input.vehicleType) {
      await this.redisStore.writeGeoWithHeartbeat({
        geoKey: `geo:drivers:${input.vehicleType}`,
        heartbeatKey: `heartbeat:driver:${session.userId}`,
        member: session.userId,
        lat: input.lat,
        lng: input.lng,
        ttlMs: LOCATION_TTL_MS,
        payload: heartbeat,
      });
    }

    await this.publishPartnerLocationToActiveOrders(session.userId, input.lat, input.lng);
    await this.publishPartnerLocationToActiveCouriers(session.userId, input.lat, input.lng);
    await this.publishPartnerLocationToActiveHomeServices(session.userId, input.lat, input.lng);
    await this.publishDriverLocationToActiveRides(session.userId, input.lat, input.lng);

    return { ok: true };
  }
  async getPartnerOpsSummary(session: SessionRecord, query: { from?: string; to?: string }) {
    this.assertPartnerRole(session);
    const selected = this.resolvePeriod(query.from, query.to);
    const daily = this.resolvePeriod(startOfDay(new Date()).toISOString(), undefined);
    const weekly = this.resolvePeriod(startOfWeek(new Date()).toISOString(), undefined);
    const [selectedSummary, dailySummary, weeklySummary, shifts, routePlan] = await Promise.all([
      this.buildPartnerPeriodSummary(session.userId, selected.start, selected.end),
      this.buildPartnerPeriodSummary(session.userId, daily.start, daily.end),
      this.buildPartnerPeriodSummary(session.userId, weekly.start, weekly.end),
      this.listPartnerShifts(session, { from: selected.start.toISOString(), to: selected.end.toISOString() }),
      this.getPartnerRoutePlan(session, { maxStops: 6, objective: "ETA" }),
    ]);

    return { selected: selectedSummary, daily: dailySummary, weekly: weeklySummary, shifts: shifts.items, routePlan };
  }

  async listPartnerShifts(session: SessionRecord, query: { from?: string; to?: string }) {
    this.assertPartnerRole(session);
    const range = this.resolvePeriod(query.from, query.to);
    const shifts = await this.prisma.partnerShift.findMany({
      where: {
        userId: session.userId,
        startsAt: { lt: range.end },
        endsAt: { gt: range.start },
      },
      orderBy: { startsAt: "asc" },
    });

    return { items: shifts.map((shift) => this.serializeShift(shift)) };
  }

  async createPartnerShift(session: SessionRecord, input: { startsAt: string; endsAt: string; note?: string }) {
    this.assertPartnerRole(session);
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
      throw new BadRequestException("Shift end must be after start");
    }

    const shift = await this.prisma.partnerShift.create({ data: { userId: session.userId, startsAt, endsAt, note: input.note?.trim() || null } });
    return this.serializeShift(shift);
  }

  async cancelPartnerShift(session: SessionRecord, shiftId: string) {
    this.assertPartnerRole(session);
    const existing = await this.prisma.partnerShift.findFirst({ where: { id: shiftId, userId: session.userId } });
    if (!existing) {
      throw new NotFoundException("Shift not found");
    }
    const shift = await this.prisma.partnerShift.update({ where: { id: shiftId }, data: { status: PartnerShiftStatus.CANCELLED } });
    return this.serializeShift(shift);
  }

  async getPartnerRoutePlan(session: SessionRecord, input: { maxStops?: number; objective?: "DISTANCE" | "ETA" | "PAYOUT" }) {
    this.assertPartnerRole(session);
    const provider = new StubRouteOptimizationProvider();
    return provider.planBatch({ partner: { userId: session.userId, role: session.user.role }, maxStops: input.maxStops ?? 6, objective: input.objective ?? "ETA" });
  }

  async listUsers(query: AdminUsersQueryDto) {
    const limit = query.limit ?? 25;
    const result = await this.repository.listUsers({ cursor: query.cursor, limit, role: query.role });

    return {
      items: result.items.map((user) => this.sessionService.toPublicUser(user)),
      nextCursor: result.nextCursor,
    };
  }

  async banUser(userId: string, reason?: string): Promise<PublicUser> {
    const user = await this.repository.setUserBanned(userId, true, reason);
    await this.sessionService.revokeAllForUser(userId);
    return this.sessionService.toPublicUser(user);
  }

  async unbanUser(userId: string): Promise<PublicUser> {
    const user = await this.repository.setUserBanned(userId, false);
    return this.sessionService.toPublicUser(user);
  }

  async listPendingPartners(query: { cursor?: string; limit?: number }) {
    const result = await this.repository.listPendingPartners(query.limit ?? 25, query.cursor);

    return {
      items: result.items.map((user) => this.sessionService.toPublicUser(user)),
      nextCursor: result.nextCursor,
    };
  }

  async reviewPartner(userId: string, input: { approval: "APPROVED" | "REJECTED"; reason?: string }): Promise<PublicUser> {
    if (input.approval === "REJECTED" && !input.reason?.trim()) {
      throw new BadRequestException("Rejection reason is required");
    }

    const user = await this.repository.setPartnerApproval(userId, input.approval, input.reason);
    await this.sessionService.revokeAllForUser(userId);
    return this.sessionService.toPublicUser(user);
  }


  private assertPartnerRole(session: SessionRecord): void {
    if (!PARTNER_ROLES.has(session.user.role)) {
      throw new ForbiddenException("Partner operations are only available to partners");
    }
  }

  private async startOnlineSession(userId: string): Promise<void> {
    const open = await this.prisma.partnerOnlineSession.findFirst({ where: { userId, endedAt: null }, select: { id: true } });
    if (!open) {
      await this.prisma.partnerOnlineSession.create({ data: { userId, source: "partner-shell" } });
    }
  }

  private async endOnlineSession(userId: string): Promise<void> {
    const now = new Date();
    const openSessions = await this.prisma.partnerOnlineSession.findMany({ where: { userId, endedAt: null }, select: { id: true, startedAt: true } });
    await Promise.all(openSessions.map((session) => this.prisma.partnerOnlineSession.update({ where: { id: session.id }, data: { endedAt: now, durationSeconds: secondsBetween(session.startedAt, now) } })));
  }

  private resolvePeriod(from?: string, to?: string): { start: Date; end: Date } {
    const start = from ? new Date(from) : startOfDay(new Date());
    const end = to ? new Date(to) : new Date();
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      throw new BadRequestException("Invalid period");
    }
    return { start, end };
  }

  private async buildPartnerPeriodSummary(userId: string, start: Date, end: Date) {
    const [entries, payouts, onlineSessions] = await Promise.all([
      this.prisma.ledgerEntry.findMany({ where: { userId, createdAt: { gte: start, lt: end } }, orderBy: { createdAt: "asc" } }),
      this.prisma.payout.findMany({ where: { userId, createdAt: { gte: start, lt: end } }, orderBy: { createdAt: "asc" } }),
      this.prisma.partnerOnlineSession.findMany({ where: { userId, startedAt: { lt: end }, OR: [{ endedAt: null }, { endedAt: { gt: start } }] }, orderBy: { startedAt: "asc" } }),
    ]);

    const byType: Record<string, string> = Object.fromEntries(Object.values(LedgerEntryType).map((type) => [type, "0"]));
    let net = new Prisma.Decimal(0);
    let grossCredits = new Prisma.Decimal(0);
    let debits = new Prisma.Decimal(0);
    for (const entry of entries) {
      const signed = this.signedLedgerAmount(entry.type, entry.amount);
      net = net.plus(signed);
      byType[entry.type] = new Prisma.Decimal(byType[entry.type]).plus(entry.amount).toString();
      if (signed.greaterThanOrEqualTo(0)) {
        grossCredits = grossCredits.plus(signed);
      } else {
        debits = debits.plus(signed.abs());
      }
    }

    const unsettled = entries.filter((entry) => !entry.isSettled && [LedgerEntryType.CREDIT, LedgerEntryType.ADJUSTMENT].includes(entry.type)).reduce((sum, entry) => sum.plus(entry.amount), new Prisma.Decimal(0));
    const payoutSummary = this.summarizePayouts(payouts);

    return {
      period: { from: start.toISOString(), to: end.toISOString() },
      ledger: {
        grossCredits: grossCredits.toString(),
        debits: debits.toString(),
        net: net.toString(),
        unsettled: unsettled.toString(),
        byType,
        entryCount: entries.length,
        entryIds: entries.map((entry) => entry.id),
        formula: "sum(CREDIT, REFUND, ADJUSTMENT, PROMOTION) - sum(DEBIT, COMMISSION, PAYOUT); LOYALTY excluded from cash earnings",
      },
      payouts: payoutSummary,
      online: {
        seconds: this.calculateOnlineSeconds(onlineSessions, start, end),
        sessions: onlineSessions.map((session) => ({ id: session.id, startedAt: session.startedAt.toISOString(), endedAt: session.endedAt?.toISOString() ?? null, lastHeartbeatAt: session.lastHeartbeatAt?.toISOString() ?? null })),
      },
    };
  }

  private signedLedgerAmount(type: LedgerEntryType, amount: Prisma.Decimal): Prisma.Decimal {
    if ([LedgerEntryType.CREDIT, LedgerEntryType.REFUND, LedgerEntryType.ADJUSTMENT, LedgerEntryType.PROMOTION].includes(type)) {
      return amount;
    }
    if (type === LedgerEntryType.LOYALTY) {
      return new Prisma.Decimal(0);
    }
    return amount.negated();
  }

  private summarizePayouts(payouts: Array<{ id: string; amount: Prisma.Decimal; status: PayoutStatus; createdAt: Date; updatedAt: Date; reference: string | null }>) {
    const byStatus: Record<string, string> = Object.fromEntries(Object.values(PayoutStatus).map((status) => [status, "0"]));
    let total = new Prisma.Decimal(0);
    for (const payout of payouts) {
      total = total.plus(payout.amount);
      byStatus[payout.status] = new Prisma.Decimal(byStatus[payout.status]).plus(payout.amount).toString();
    }
    return { total: total.toString(), byStatus, items: payouts.map((payout) => ({ id: payout.id, amount: payout.amount.toString(), status: payout.status, reference: payout.reference, createdAt: payout.createdAt.toISOString(), updatedAt: payout.updatedAt.toISOString() })) };
  }

  private calculateOnlineSeconds(sessions: Array<{ startedAt: Date; endedAt: Date | null }>, start: Date, end: Date): number {
    return sessions.reduce((total, session) => {
      const overlapStart = session.startedAt > start ? session.startedAt : start;
      const sessionEnd = session.endedAt ?? new Date();
      const overlapEnd = sessionEnd < end ? sessionEnd : end;
      return total + secondsBetween(overlapStart, overlapEnd);
    }, 0);
  }

  private serializeShift(shift: { id: string; startsAt: Date; endsAt: Date; status: PartnerShiftStatus; note: string | null; createdAt: Date; updatedAt: Date }) {
    return { id: shift.id, startsAt: shift.startsAt.toISOString(), endsAt: shift.endsAt.toISOString(), status: shift.status, note: shift.note, createdAt: shift.createdAt.toISOString(), updatedAt: shift.updatedAt.toISOString() };
  }
  private async getFavorite(favoriteId: string) {
    const favorite = await this.prisma.favorite.findUniqueOrThrow({ where: { id: favoriteId }, include: { store: true, menuItem: { include: { store: true } } } });
    return this.serializeFavorite(favorite);
  }

  private async ensureReferralCode(userId: string): Promise<{ referralCode: string | null; walletBalanceCached: Prisma.Decimal }> {
    const existing = await this.prisma.user.findUnique({ where: { id: userId }, select: { referralCode: true, walletBalanceCached: true } });
    if (!existing) {
      throw new NotFoundException("User not found");
    }
    if (existing.referralCode) {
      return existing;
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const referralCode = `MVX${randomBytes(4).toString("hex").toUpperCase()}`;
      try {
        return await this.prisma.user.update({ where: { id: userId }, data: { referralCode }, select: { referralCode: true, walletBalanceCached: true } });
      } catch {
        continue;
      }
    }

    throw new BadRequestException("Could not allocate a referral code");
  }

  private async reconcileWalletBalance(tx: Prisma.TransactionClient, userId: string): Promise<Prisma.Decimal> {
    const balance = await this.computeWalletBalance(tx, userId);
    await tx.user.update({ where: { id: userId }, data: { walletBalanceCached: balance } });
    return balance;
  }

  private async computeWalletBalance(tx: Prisma.TransactionClient, userId: string): Promise<Prisma.Decimal> {
    const entries = await tx.ledgerEntry.findMany({ where: { userId }, select: { type: true, amount: true } });
    return entries.reduce((balance, entry) => {
      if ([LedgerEntryType.CREDIT, LedgerEntryType.REFUND, LedgerEntryType.ADJUSTMENT, LedgerEntryType.PROMOTION].includes(entry.type)) {
        return balance.plus(entry.amount);
      }
      if (entry.type === LedgerEntryType.LOYALTY) {
        return balance;
      }
      return balance.minus(entry.amount);
    }, new Prisma.Decimal(0));
  }

  private serializeFavorite(favorite: Prisma.FavoriteGetPayload<{ include: { store: true; menuItem: { include: { store: true } } } }>) {
    return {
      id: favorite.id,
      type: favorite.storeId ? "STORE" : "MENU_ITEM",
      targetId: favorite.storeId ?? favorite.menuItemId,
      store: favorite.store
        ? { id: favorite.store.id, name: favorite.store.name, type: favorite.store.type, imageUrl: favorite.store.imageUrl, ratingAverage: favorite.store.ratingAverage.toString(), isOpen: favorite.store.isOpen }
        : null,
      menuItem: favorite.menuItem
        ? { id: favorite.menuItem.id, name: favorite.menuItem.name, price: favorite.menuItem.price.toString(), imageUrl: favorite.menuItem.imageUrl, store: { id: favorite.menuItem.store.id, name: favorite.menuItem.store.name, type: favorite.menuItem.store.type } }
        : null,
      createdAt: favorite.createdAt.toISOString(),
    };
  }
  private async publishPartnerLocationToActiveOrders(partnerId: string, lat: number, lng: number): Promise<void> {
    const orders = await this.prisma.order.findMany({
      where: {
        deliveryPartnerId: partnerId,
        status: { in: [OrderStatus.READY, OrderStatus.PICKED_UP] },
      },
      select: { id: true, status: true },
    });

    await Promise.all(
      orders.map((order) =>
        this.realtimeProvider.publish(`order:${order.id}`, {
          id: `partner.location:${partnerId}:${Date.now()}`,
          type: "partner.location.updated",
          payload: {
            orderId: order.id,
            partnerId,
            status: order.status,
            lat,
            lng,
          },
        }),
      ),
    );
  }


  private async publishPartnerLocationToActiveCouriers(partnerId: string, lat: number, lng: number): Promise<void> {
    const bookings = await this.prisma.courierBooking.findMany({
      where: {
        deliveryPartnerId: partnerId,
        status: { in: [CourierStatus.ASSIGNED, CourierStatus.ARRIVED, CourierStatus.IN_TRANSIT] },
      },
      select: { id: true, status: true },
    });

    await Promise.all(
      bookings.map((booking) =>
        this.realtimeProvider.publish(`courier:${booking.id}`, {
          id: `partner.location:${partnerId}:${Date.now()}`,
          type: "partner.location.updated",
          payload: {
            courierId: booking.id,
            partnerId,
            status: booking.status,
            lat,
            lng,
          },
        }),
      ),
    );
  }
  private async publishPartnerLocationToActiveHomeServices(partnerId: string, lat: number, lng: number): Promise<void> {
    const bookings = await this.prisma.homeServiceBooking.findMany({
      where: {
        professionalId: partnerId,
        status: { in: [HomeServiceStatus.ASSIGNED, HomeServiceStatus.ARRIVED, HomeServiceStatus.IN_SERVICE] },
      },
      select: { id: true, status: true },
    });

    await Promise.all(
      bookings.map((booking) =>
        this.realtimeProvider.publish(`home-service:${booking.id}`, {
          id: `partner.location:${partnerId}:${Date.now()}`,
          type: "partner.location.updated",
          payload: {
            homeServiceId: booking.id,
            partnerId,
            status: booking.status,
            lat,
            lng,
          },
        }),
      ),
    );
  }
  private async publishDriverLocationToActiveRides(driverId: string, lat: number, lng: number): Promise<void> {
    const rides = await this.prisma.ride.findMany({
      where: {
        driverId,
        status: { in: [RideStatus.ASSIGNED, RideStatus.ARRIVED, RideStatus.IN_RIDE] },
      },
      select: { id: true, status: true },
    });

    await Promise.all(
      rides.map((ride) =>
        this.realtimeProvider.publish(`ride:${ride.id}`, {
          id: `driver.location:${driverId}:${Date.now()}`,
          type: "driver.location.updated",
          payload: {
            rideId: ride.id,
            driverId,
            status: ride.status,
            lat,
            lng,
          },
        }),
      ),
    );
  }
  private assertApprovedPartner(session: SessionRecord): void {

    if (session.user.partnerApproval !== APPROVED) {
      throw new ForbiddenException("Partner approval is required");
    }
  }
}