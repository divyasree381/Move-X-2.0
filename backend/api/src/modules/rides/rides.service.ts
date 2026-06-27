import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { CourierStatus, HomeServiceStatus, LedgerEntryType, PaymentMethod as PrismaPaymentMethod, PaymentStatus, Prisma, RideStatus, UserRole, VehicleType } from "@prisma/client";
import { canTransition, courierStatusTransitions, homeServiceStatusTransitions, rideStatusTransitions } from "@movex/shared";
import type { MapTravelMode, RouteSummary , CourierStatus as SharedCourierStatus, HomeServiceStatus as SharedHomeServiceStatus, RideStatus as SharedRideStatus} from "@movex/shared";

import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { RedisStoreService } from "../../infrastructure/redis/redis-store.service";
import { MapsService } from "../maps/maps.service";
import { OutboxService } from "../outbox/outbox.service";
import { REALTIME_PROVIDER, type RealtimeProvider } from "../realtime/realtime-provider";
import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import type { CreateCourierDto, CreateHomeServiceDto, CreateRideDto, CourierEstimateDto, HomeServiceCatalogQueryDto, HomeServiceEstimateDto, RideCancelDto, RideEstimateDto, RideLocationDto, RideOtpDto, RideRatingDto, RidesQueryDto } from "./dto/rides.dto";

type PrismaTx = Prisma.TransactionClient;

type FareConfig = {
  base: Prisma.Decimal;
  perKm: Prisma.Decimal;
  perMinute: Prisma.Decimal;
};

type FareEstimate = {
  vehicleType: VehicleType;
  distanceMeters: number;
  durationSeconds: number;
  distanceKm: string;
  durationMinutes: number;
  baseFare: string;
  surgeMultiplier: string;
  estimatedFare: string;
  polyline: string;
};

type RideWithUsers = Prisma.RideGetPayload<{
  include: { customer: { select: { id: true; name: true; phoneE164: true; role: true } }; driver: { select: { id: true; name: true; phoneE164: true; role: true } } };
}>;


type CourierWithUsers = Prisma.CourierBookingGetPayload<{
  include: { customer: { select: { id: true; name: true; phoneE164: true; role: true } }; deliveryPartner: { select: { id: true; name: true; phoneE164: true; role: true } } };
}>;

type HomeServiceWithUsers = Prisma.HomeServiceBookingGetPayload<{
  include: { customer: { select: { id: true; name: true; phoneE164: true; role: true } }; professional: { select: { id: true; name: true; phoneE164: true; role: true } } };
}>;

type HomeServiceCatalogItem = {
  code: string;
  category: string;
  name: string;
  description: string;
  price: Prisma.Decimal;
  durationMinutes: number;
};
type DriverHeartbeat = {
  userId?: string;
  role?: string;
  vehicleType?: string | null;
  lat?: number;
  lng?: number;
  at?: string;
};

const DEFAULT_FARE_CONFIG: Record<VehicleType, FareConfig> = {
  [VehicleType.BIKE]: { base: new Prisma.Decimal(25), perKm: new Prisma.Decimal(8), perMinute: new Prisma.Decimal(1) },
  [VehicleType.AUTO]: { base: new Prisma.Decimal(35), perKm: new Prisma.Decimal(13), perMinute: new Prisma.Decimal(1.5) },
  [VehicleType.CAB]: { base: new Prisma.Decimal(70), perKm: new Prisma.Decimal(19), perMinute: new Prisma.Decimal(2.5) },
};

const ZERO = new Prisma.Decimal(0);
const RIDE_LOYALTY_POINTS_PER_RUPEE = new Prisma.Decimal(process.env.RIDE_LOYALTY_POINTS_PER_RUPEE ?? "0.02");
const REFERRAL_REFERRER_CREDIT = new Prisma.Decimal(process.env.REFERRAL_REFERRER_CREDIT ?? "100");
const OTP_HASH_SALT = process.env.OTP_HASH_SALT ?? "movex-dev-otp-salt";
const DRIVER_SEARCH_RADIUS_KM = Number(process.env.RIDE_DRIVER_SEARCH_RADIUS_KM ?? 6);
const COURIER_SEARCH_RADIUS_KM = Number(process.env.COURIER_PARTNER_SEARCH_RADIUS_KM ?? 8);
const HOME_SERVICE_SEARCH_RADIUS_KM = Number(process.env.HOME_SERVICE_PRO_SEARCH_RADIUS_KM ?? 10);
const DRIVER_OFFER_TTL_MS = Number(process.env.RIDE_DRIVER_OFFER_TTL_MS ?? 45_000);
const COURIER_OFFER_TTL_MS = Number(process.env.COURIER_PARTNER_OFFER_TTL_MS ?? 45_000);
const HOME_SERVICE_OFFER_TTL_MS = Number(process.env.HOME_SERVICE_PRO_OFFER_TTL_MS ?? 45_000);
const DRIVER_HEARTBEAT_STALE_MS = Number(process.env.RIDE_DRIVER_HEARTBEAT_STALE_MS ?? 45_000);


@Injectable()
export class RidesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisStoreService) private readonly redisStore: RedisStoreService,
    @Inject(MapsService) private readonly mapsService: MapsService,
    @Inject(OutboxService) private readonly outboxService: OutboxService,
    @Inject(REALTIME_PROVIDER) private readonly realtimeProvider: RealtimeProvider,
  ) {}

  async estimate(input: RideEstimateDto): Promise<FareEstimate> {
    const route = await this.mapsService.getRoute({ from: input.pickup, to: input.drop, mode: this.modeForVehicle(input.vehicleType) });
    return this.calculateFare(input.vehicleType as unknown as VehicleType, route);
  }

  async createRide(user: AuthenticatedUser, input: CreateRideDto) {
    this.assertCustomer(user);
    const estimate = await this.estimate(input);
    const fare = new Prisma.Decimal(estimate.estimatedFare);

    if ((input.paymentMethod as unknown as PrismaPaymentMethod) === PrismaPaymentMethod.WALLET) {
      const balance = await this.computeWalletBalance(this.prisma, user.userId);
      if (balance.lessThan(fare)) {
        throw new BadRequestException("Wallet balance is insufficient");
      }
    }

    const startOtp = this.generateOtp();
    const ride = await this.prisma.$transaction(async (tx) => {
      const created = await tx.ride.create({
        data: {
          customerId: user.userId,
          vehicleType: input.vehicleType as unknown as VehicleType,
          pickup: this.locationSnapshot(input.pickup),
          drop: this.locationSnapshot(input.drop),
          estimatedFare: fare,
          distanceKm: new Prisma.Decimal(estimate.distanceKm),
          durationMinutes: estimate.durationMinutes,
          surgeMultiplier: new Prisma.Decimal(estimate.surgeMultiplier),
          startOtpHash: this.hashOtp(startOtp),
          paymentMethod: input.paymentMethod as unknown as PrismaPaymentMethod,
          paymentStatus: PaymentStatus.PENDING,
        },
        include: { customer: { select: { id: true, name: true, phoneE164: true, role: true } }, driver: { select: { id: true, name: true, phoneE164: true, role: true } } },
      });
      await this.outboxService.rideRequested(tx, { rideId: created.id, customerId: created.customerId, topic: `ride:${created.id}`, vehicleType: created.vehicleType, amount: created.estimatedFare.toString() });
      return created;
    });

    const offeredDrivers = await this.offerRideToNearbyDrivers(ride);
    await this.publishRideRealtime(ride, "ride.requested", { offeredDrivers });

    return {
      ride: this.serializeRide(ride),
      offeredDrivers,
      devStartOtp: process.env.NODE_ENV !== "production" ? startOtp : undefined,
    };
  }


  async estimateCourier(input: CourierEstimateDto): Promise<FareEstimate> {
    const route = await this.mapsService.getRoute({ from: input.pickup, to: input.drop, mode: "TWO_WHEELER" });
    return this.calculateFare(VehicleType.BIKE, route);
  }

  async createCourier(user: AuthenticatedUser, input: CreateCourierDto) {
    this.assertCustomer(user);
    const estimate = await this.estimateCourier(input);
    const fare = new Prisma.Decimal(estimate.estimatedFare);

    if ((input.paymentMethod as unknown as PrismaPaymentMethod) === PrismaPaymentMethod.WALLET) {
      const balance = await this.computeWalletBalance(this.prisma, user.userId);
      if (balance.lessThan(fare)) {
        throw new BadRequestException("Wallet balance is insufficient");
      }
    }

    const pickupOtp = this.generateOtp();
    const deliveryOtp = this.generateOtp();
    const booking = await this.prisma.$transaction(async (tx) => {
      const created = await tx.courierBooking.create({
        data: {
          customerId: user.userId,
          pickup: this.courierPointSnapshot(input.pickup, input.sender),
          drop: this.courierPointSnapshot(input.drop, input.recipient),
          packageDescription: input.packageDescription,
          packageWeightKg: input.packageWeightKg !== undefined ? new Prisma.Decimal(input.packageWeightKg) : undefined,
          estimatedFare: fare,
          distanceKm: new Prisma.Decimal(estimate.distanceKm),
          pickupOtpHash: this.hashOtp(pickupOtp),
          deliveryOtpHash: this.hashOtp(deliveryOtp),
          paymentMethod: input.paymentMethod as unknown as PrismaPaymentMethod,
          paymentStatus: PaymentStatus.PENDING,
        },
        include: { customer: { select: { id: true, name: true, phoneE164: true, role: true } }, deliveryPartner: { select: { id: true, name: true, phoneE164: true, role: true } } },
      });
      await this.outboxService.courierRequested(tx, { courierId: created.id, customerId: created.customerId, topic: `courier:${created.id}`, amount: created.estimatedFare.toString() });
      return created;
    });

    const offeredPartners = await this.offerCourierToNearbyPartners(booking);
    await this.publishCourierRealtime(booking, "courier.requested", { offeredPartners });

    return {
      courier: this.serializeCourier(booking),
      offeredPartners,
      devOtps: process.env.NODE_ENV !== "production" ? { pickup: pickupOtp, delivery: deliveryOtp } : undefined,
    };
  }

  async listCouriers(user: AuthenticatedUser, query: RidesQueryDto) {
    const limit = query.limit ?? 25;
    const where = user.role === UserRole.CUSTOMER ? { customerId: user.userId } : user.role === UserRole.DELIVERY ? { deliveryPartnerId: user.userId } : {};
    const bookings = await this.prisma.courierBooking.findMany({
      where: { ...where, ...(query.cursor ? { createdAt: { lt: new Date(query.cursor) } } : {}) },
      include: { customer: { select: { id: true, name: true, phoneE164: true, role: true } }, deliveryPartner: { select: { id: true, name: true, phoneE164: true, role: true } } },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
    });
    const page = bookings.slice(0, limit);
    return { items: page.map((booking) => this.serializeCourier(booking)), nextCursor: bookings.length > limit ? page.at(-1)?.createdAt.toISOString() : undefined };
  }

  async getCourier(user: AuthenticatedUser, courierId: string) {
    const booking = await this.findCourierOrThrow(courierId);
    this.assertCourierAccess(user, booking);
    return this.serializeCourier(booking);
  }

  async listCourierQueue(user: AuthenticatedUser) {
    this.assertDelivery(user);
    await this.assertApprovedOnlineDelivery(user.userId);
    const heartbeat = await this.getPartnerHeartbeat(user.userId);
    const partnerLat = heartbeat?.lat;
    const partnerLng = heartbeat?.lng;

    if (typeof partnerLat !== "number" || typeof partnerLng !== "number") {
      throw new BadRequestException("Write live delivery location before requesting courier queue");
    }

    const bookings = await this.prisma.courierBooking.findMany({
      where: {
        OR: [
          { status: CourierStatus.REQUESTED, deliveryPartnerId: null },
          { deliveryPartnerId: user.userId, status: { in: [CourierStatus.ASSIGNED, CourierStatus.ARRIVED, CourierStatus.IN_TRANSIT] } },
        ],
      },
      include: { customer: { select: { id: true, name: true, phoneE164: true, role: true } }, deliveryPartner: { select: { id: true, name: true, phoneE164: true, role: true } } },
      orderBy: { createdAt: "asc" },
      take: 50,
    });

    return {
      items: bookings
        .map((booking) => ({ booking, distanceKm: this.distanceFromPickup(booking.pickup, partnerLat, partnerLng) }))
        .filter(({ booking, distanceKm }) => booking.deliveryPartnerId === user.userId || distanceKm <= COURIER_SEARCH_RADIUS_KM)
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .map(({ booking, distanceKm }) => ({ ...this.serializeCourier(booking), distanceKm: Number(distanceKm.toFixed(2)) })),
    };
  }

  async acceptCourier(user: AuthenticatedUser, courierId: string) {
    this.assertDelivery(user);
    await this.assertApprovedOnlineDelivery(user.userId);

    const result = await this.prisma.courierBooking.updateMany({
      where: { id: courierId, status: CourierStatus.REQUESTED, deliveryPartnerId: null },
      data: { status: CourierStatus.ASSIGNED, deliveryPartnerId: user.userId },
    });

    if (result.count !== 1) {
      throw new BadRequestException("Courier job is no longer available");
    }

    const booking = await this.findCourierOrThrow(courierId);
    await this.outboxService.courierAccepted(this.prisma, { courierId: booking.id, customerId: booking.customerId, partnerId: user.userId, topic: `courier:${booking.id}` });
    await this.publishCourierRealtime(booking, "courier.accepted");
    return this.serializeCourier(booking);
  }

  arriveCourier(user: AuthenticatedUser, courierId: string) {
    return this.transitionCourier(user, courierId, CourierStatus.ARRIVED);
  }

  pickupCourier(user: AuthenticatedUser, courierId: string, body: RideOtpDto) {
    return this.transitionCourier(user, courierId, CourierStatus.IN_TRANSIT, body.otp);
  }

  deliverCourier(user: AuthenticatedUser, courierId: string, body: RideOtpDto) {
    return this.transitionCourier(user, courierId, CourierStatus.COMPLETED, body.otp);
  }

  async cancelCourier(user: AuthenticatedUser, courierId: string, body: RideCancelDto) {
    const booking = await this.findCourierOrThrow(courierId);
    const isCustomer = booking.customerId === user.userId;
    const isPartner = booking.deliveryPartnerId === user.userId;
    const isStaff = ([UserRole.SUPPORT, UserRole.ADMIN, UserRole.SUPER_ADMIN] as UserRole[]).includes(user.role as UserRole);

    if (!isCustomer && !isPartner && !isStaff) {
      throw new ForbiddenException("Courier cancellation is not allowed");
    }

    this.assertCourierTransitionAllowed(booking.status, CourierStatus.CANCELLED);
    const updated = await this.prisma.$transaction(async (tx) => {
      const latest = await tx.courierBooking.findUnique({ where: { id: courierId }, include: { customer: { select: { id: true, name: true, phoneE164: true, role: true } }, deliveryPartner: { select: { id: true, name: true, phoneE164: true, role: true } } } });
      if (!latest) {
        throw new NotFoundException("Courier booking not found");
      }
      this.assertCourierTransitionAllowed(latest.status, CourierStatus.CANCELLED);
      const cancelled = await tx.courierBooking.update({
        where: { id: courierId },
        data: { status: CourierStatus.CANCELLED, paymentStatus: latest.paymentStatus === PaymentStatus.PAID ? PaymentStatus.REFUNDED : PaymentStatus.CANCELLED },
        include: { customer: { select: { id: true, name: true, phoneE164: true, role: true } }, deliveryPartner: { select: { id: true, name: true, phoneE164: true, role: true } } },
      });
      await this.outboxService.courierStatusChanged(tx, { courierId: cancelled.id, customerId: cancelled.customerId, partnerId: cancelled.deliveryPartnerId ?? undefined, status: cancelled.status, topic: `courier:${cancelled.id}` });
      return cancelled;
    });

    await this.publishCourierRealtime(updated, "courier.cancelled", { reason: body.reason ?? null });
    return this.serializeCourier(updated);
  }

  async rateCourier(user: AuthenticatedUser, courierId: string, body: RideRatingDto) {
    const booking = await this.findCourierOrThrow(courierId);
    this.assertCourierAccess(user, booking);

    if (booking.status !== CourierStatus.COMPLETED) {
      throw new BadRequestException("Only completed courier bookings can be rated");
    }

    const side = user.userId === booking.customerId ? "customer" : user.userId === booking.deliveryPartnerId ? "partner" : null;
    if (!side) {
      throw new ForbiddenException("Courier rating is not allowed");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const markerKey = `rating:courier:${courierId}:${side}`;
      const existing = await tx.systemConfig.findUnique({ where: { key: markerKey } });
      if (existing) {
        return tx.courierBooking.findUniqueOrThrow({ where: { id: courierId }, include: { customer: { select: { id: true, name: true, phoneE164: true, role: true } }, deliveryPartner: { select: { id: true, name: true, phoneE164: true, role: true } } } });
      }

      const targetId = side === "customer" ? booking.deliveryPartnerId : booking.customerId;
      if (targetId) {
        await this.applyRatingAggregate(tx, `${side === "customer" ? "delivery" : "customer"}:${targetId}`, body.rating);
      }

      await tx.systemConfig.create({ data: { key: markerKey, value: { rating: body.rating, comment: body.comment ?? null, by: user.userId }, description: "Courier rating marker" } });
      return tx.courierBooking.update({ where: { id: courierId }, data: side === "customer" ? { rated: true } : {}, include: { customer: { select: { id: true, name: true, phoneE164: true, role: true } }, deliveryPartner: { select: { id: true, name: true, phoneE164: true, role: true } } } });
    });

    await this.publishCourierRealtime(updated, "courier.rated", { ratedBy: side });
    return this.serializeCourier(updated);
  }

  async listHomeServiceCatalog(query: HomeServiceCatalogQueryDto = {}) {
    const category = query.category?.trim();
    const items = await this.prisma.homeServiceCatalogItem.findMany({
      where: {
        isActive: true,
        ...(category ? { category: { equals: category, mode: "insensitive" as const } } : {}),
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return { items: items.map((item) => this.serializeHomeServiceCatalogItem(item)) };
  }

  async estimateHomeService(input: HomeServiceEstimateDto) {
    const item = await this.findHomeServiceCatalogItem(input.serviceCode);
    return this.serializeHomeServiceEstimate(item);
  }

  async createHomeService(user: AuthenticatedUser, input: CreateHomeServiceDto) {
    this.assertCustomer(user);
    const item = await this.findHomeServiceCatalogItem(input.serviceCode);
    const scheduledFor = new Date(input.scheduledFor);
    if (Number.isNaN(scheduledFor.getTime()) || scheduledFor.getTime() < Date.now() + 30 * 60 * 1000) {
      throw new BadRequestException("Choose a service slot at least 30 minutes from now");
    }

    if ((input.paymentMethod as unknown as PrismaPaymentMethod) === PrismaPaymentMethod.WALLET) {
      const balance = await this.computeWalletBalance(this.prisma, user.userId);
      if (balance.lessThan(item.price)) {
        throw new BadRequestException("Wallet balance is insufficient");
      }
    }

    const startOtp = this.generateOtp();
    const booking = await this.prisma.$transaction(async (tx) => {
      const created = await tx.homeServiceBooking.create({
        data: {
          customerId: user.userId,
          serviceCategory: item.category,
          serviceDescription: item.name,
          address: this.homeServiceAddressSnapshot(input.address, input.note),
          scheduledFor,
          estimatedFare: item.price,
          durationMinutes: item.durationMinutes,
          startOtpHash: this.hashOtp(startOtp),
          paymentMethod: input.paymentMethod as unknown as PrismaPaymentMethod,
          paymentStatus: PaymentStatus.PENDING,
        },
        include: { customer: { select: { id: true, name: true, phoneE164: true, role: true } }, professional: { select: { id: true, name: true, phoneE164: true, role: true } } },
      });
      await this.outboxService.homeServiceRequested(tx, { homeServiceId: created.id, customerId: created.customerId, topic: `home-service:${created.id}`, amount: created.estimatedFare.toString(), serviceCategory: created.serviceCategory });
      return created;
    });

    const offeredProfessionals = await this.offerHomeServiceToNearbyProfessionals(booking);
    await this.publishHomeServiceRealtime(booking, "home-service.requested", { offeredProfessionals });

    return {
      booking: this.serializeHomeService(booking),
      offeredProfessionals,
      devStartOtp: process.env.NODE_ENV !== "production" ? startOtp : undefined,
    };
  }

  async listHomeServices(user: AuthenticatedUser, query: RidesQueryDto) {
    const limit = query.limit ?? 25;
    const where = user.role === UserRole.CUSTOMER ? { customerId: user.userId } : user.role === UserRole.DELIVERY ? { professionalId: user.userId } : {};
    const bookings = await this.prisma.homeServiceBooking.findMany({
      where: { ...where, ...(query.cursor ? { createdAt: { lt: new Date(query.cursor) } } : {}) },
      include: { customer: { select: { id: true, name: true, phoneE164: true, role: true } }, professional: { select: { id: true, name: true, phoneE164: true, role: true } } },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
    });
    const page = bookings.slice(0, limit);
    return { items: page.map((booking) => this.serializeHomeService(booking)), nextCursor: bookings.length > limit ? page.at(-1)?.createdAt.toISOString() : undefined };
  }

  async getHomeService(user: AuthenticatedUser, bookingId: string) {
    const booking = await this.findHomeServiceOrThrow(bookingId);
    this.assertHomeServiceAccess(user, booking);
    return this.serializeHomeService(booking);
  }

  async listHomeServiceQueue(user: AuthenticatedUser) {
    this.assertDelivery(user);
    await this.assertApprovedOnlineDelivery(user.userId);
    const heartbeat = await this.getPartnerHeartbeat(user.userId);
    const partnerLat = heartbeat?.lat;
    const partnerLng = heartbeat?.lng;
    if (typeof partnerLat !== "number" || typeof partnerLng !== "number") {
      throw new BadRequestException("Write live professional location before requesting home-service queue");
    }

    const bookings = await this.prisma.homeServiceBooking.findMany({
      where: {
        OR: [
          { status: HomeServiceStatus.REQUESTED, professionalId: null },
          { professionalId: user.userId, status: { in: [HomeServiceStatus.ASSIGNED, HomeServiceStatus.ARRIVED, HomeServiceStatus.IN_SERVICE] } },
        ],
      },
      include: { customer: { select: { id: true, name: true, phoneE164: true, role: true } }, professional: { select: { id: true, name: true, phoneE164: true, role: true } } },
      orderBy: { scheduledFor: "asc" },
      take: 50,
    });

    return {
      items: bookings
        .map((booking) => ({ booking, distanceKm: this.distanceFromPickup(booking.address, partnerLat, partnerLng) }))
        .filter(({ booking, distanceKm }) => booking.professionalId === user.userId || distanceKm <= HOME_SERVICE_SEARCH_RADIUS_KM)
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .map(({ booking, distanceKm }) => ({ ...this.serializeHomeService(booking), distanceKm: Number(distanceKm.toFixed(2)) })),
    };
  }

  async acceptHomeService(user: AuthenticatedUser, bookingId: string) {
    this.assertDelivery(user);
    await this.assertApprovedOnlineDelivery(user.userId);
    const result = await this.prisma.homeServiceBooking.updateMany({ where: { id: bookingId, status: HomeServiceStatus.REQUESTED, professionalId: null }, data: { status: HomeServiceStatus.ASSIGNED, professionalId: user.userId } });
    if (result.count !== 1) {
      throw new BadRequestException("Home-service job is no longer available");
    }
    const booking = await this.findHomeServiceOrThrow(bookingId);
    await this.outboxService.homeServiceAccepted(this.prisma, { homeServiceId: booking.id, customerId: booking.customerId, partnerId: user.userId, topic: `home-service:${booking.id}` });
    await this.publishHomeServiceRealtime(booking, "home-service.accepted");
    return this.serializeHomeService(booking);
  }

  arriveHomeService(user: AuthenticatedUser, bookingId: string) {
    return this.transitionHomeService(user, bookingId, HomeServiceStatus.ARRIVED);
  }

  startHomeService(user: AuthenticatedUser, bookingId: string, body: RideOtpDto) {
    return this.transitionHomeService(user, bookingId, HomeServiceStatus.IN_SERVICE, body.otp);
  }

  completeHomeService(user: AuthenticatedUser, bookingId: string) {
    return this.transitionHomeService(user, bookingId, HomeServiceStatus.COMPLETED);
  }

  async cancelHomeService(user: AuthenticatedUser, bookingId: string, body: RideCancelDto) {
    const booking = await this.findHomeServiceOrThrow(bookingId);
    const isCustomer = booking.customerId === user.userId;
    const isProfessional = booking.professionalId === user.userId;
    const isStaff = ([UserRole.SUPPORT, UserRole.ADMIN, UserRole.SUPER_ADMIN] as UserRole[]).includes(user.role as UserRole);
    if (!isCustomer && !isProfessional && !isStaff) {
      throw new ForbiddenException("Home-service cancellation is not allowed");
    }

    this.assertHomeServiceTransitionAllowed(booking.status, HomeServiceStatus.CANCELLED);
    const updated = await this.prisma.$transaction(async (tx) => {
      const latest = await tx.homeServiceBooking.findUnique({ where: { id: bookingId }, include: { customer: { select: { id: true, name: true, phoneE164: true, role: true } }, professional: { select: { id: true, name: true, phoneE164: true, role: true } } } });
      if (!latest) {
        throw new NotFoundException("Home-service booking not found");
      }
      this.assertHomeServiceTransitionAllowed(latest.status, HomeServiceStatus.CANCELLED);
      const cancelled = await tx.homeServiceBooking.update({
        where: { id: bookingId },
        data: { status: HomeServiceStatus.CANCELLED, paymentStatus: latest.paymentStatus === PaymentStatus.PAID ? PaymentStatus.REFUNDED : PaymentStatus.CANCELLED },
        include: { customer: { select: { id: true, name: true, phoneE164: true, role: true } }, professional: { select: { id: true, name: true, phoneE164: true, role: true } } },
      });
      await this.outboxService.homeServiceStatusChanged(tx, { homeServiceId: cancelled.id, customerId: cancelled.customerId, partnerId: cancelled.professionalId ?? undefined, status: cancelled.status, topic: `home-service:${cancelled.id}` });
      return cancelled;
    });

    await this.publishHomeServiceRealtime(updated, "home-service.cancelled", { reason: body.reason ?? null });
    return this.serializeHomeService(updated);
  }

  async rateHomeService(user: AuthenticatedUser, bookingId: string, body: RideRatingDto) {
    const booking = await this.findHomeServiceOrThrow(bookingId);
    this.assertHomeServiceAccess(user, booking);
    if (booking.status !== HomeServiceStatus.COMPLETED) {
      throw new BadRequestException("Only completed home-service bookings can be rated");
    }

    const side = user.userId === booking.customerId ? "customer" : user.userId === booking.professionalId ? "professional" : null;
    if (!side) {
      throw new ForbiddenException("Home-service rating is not allowed");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const markerKey = `rating:home-service:${bookingId}:${side}`;
      const existing = await tx.systemConfig.findUnique({ where: { key: markerKey } });
      if (existing) {
        return tx.homeServiceBooking.findUniqueOrThrow({ where: { id: bookingId }, include: { customer: { select: { id: true, name: true, phoneE164: true, role: true } }, professional: { select: { id: true, name: true, phoneE164: true, role: true } } } });
      }
      const targetId = side === "customer" ? booking.professionalId : booking.customerId;
      if (targetId) {
        await this.applyRatingAggregate(tx, `${side === "customer" ? "home-service-pro" : "customer"}:${targetId}`, body.rating);
      }
      await tx.systemConfig.create({ data: { key: markerKey, value: { rating: body.rating, comment: body.comment ?? null, by: user.userId }, description: "Home-service rating marker" } });
      return tx.homeServiceBooking.update({ where: { id: bookingId }, data: side === "customer" ? { rated: true } : {}, include: { customer: { select: { id: true, name: true, phoneE164: true, role: true } }, professional: { select: { id: true, name: true, phoneE164: true, role: true } } } });
    });

    await this.publishHomeServiceRealtime(updated, "home-service.rated", { ratedBy: side });
    return this.serializeHomeService(updated);
  }
  async listRides(user: AuthenticatedUser, query: RidesQueryDto) {
    const limit = query.limit ?? 25;
    const where = user.role === UserRole.CUSTOMER ? { customerId: user.userId } : user.role === UserRole.DRIVER ? { driverId: user.userId } : {};
    const rides = await this.prisma.ride.findMany({
      where: { ...where, ...(query.cursor ? { createdAt: { lt: new Date(query.cursor) } } : {}) },
      include: { customer: { select: { id: true, name: true, phoneE164: true, role: true } }, driver: { select: { id: true, name: true, phoneE164: true, role: true } } },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
    });
    const page = rides.slice(0, limit);
    return { items: page.map((ride) => this.serializeRide(ride)), nextCursor: rides.length > limit ? page.at(-1)?.createdAt.toISOString() : undefined };
  }

  async getRide(user: AuthenticatedUser, rideId: string) {
    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
      include: { customer: { select: { id: true, name: true, phoneE164: true, role: true } }, driver: { select: { id: true, name: true, phoneE164: true, role: true } } },
    });

    if (!ride) {
      throw new NotFoundException("Ride not found");
    }

    this.assertRideAccess(user, ride);
    return this.serializeRide(ride);
  }

  async listDriverQueue(user: AuthenticatedUser) {
    this.assertDriver(user);
    await this.assertApprovedOnlineDriver(user.userId);
    const heartbeat = await this.getDriverHeartbeat(user.userId);
    const driverLat = heartbeat?.lat;
    const driverLng = heartbeat?.lng;
    const vehicleType = heartbeat?.vehicleType;

    if (typeof driverLat !== "number" || typeof driverLng !== "number" || !this.isVehicleType(vehicleType)) {
      throw new BadRequestException("Write live driver location and vehicle type before requesting ride queue");
    }

    const rides = await this.prisma.ride.findMany({
      where: {
        OR: [
          { status: RideStatus.REQUESTED, vehicleType },
          { driverId: user.userId, status: { in: [RideStatus.ASSIGNED, RideStatus.ARRIVED, RideStatus.IN_RIDE] } },
        ],
      },
      include: { customer: { select: { id: true, name: true, phoneE164: true, role: true } }, driver: { select: { id: true, name: true, phoneE164: true, role: true } } },
      orderBy: { createdAt: "asc" },
      take: 50,
    });

    return {
      items: rides
        .map((ride) => ({ ride, distanceKm: this.distanceFromPickup(ride.pickup, driverLat, driverLng) }))
        .filter(({ ride, distanceKm }) => ride.driverId === user.userId || distanceKm <= DRIVER_SEARCH_RADIUS_KM)
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .map(({ ride, distanceKm }) => ({ ...this.serializeRide(ride), distanceKm: Number(distanceKm.toFixed(2)) })),
    };
  }

  async acceptRide(user: AuthenticatedUser, rideId: string) {
    this.assertDriver(user);
    await this.assertApprovedOnlineDriver(user.userId);
    const heartbeat = await this.getDriverHeartbeat(user.userId);

    if (!heartbeat || !this.isVehicleType(heartbeat.vehicleType)) {
      throw new BadRequestException("Driver vehicle heartbeat is required");
    }

    const result = await this.prisma.ride.updateMany({
      where: { id: rideId, status: RideStatus.REQUESTED, driverId: null, vehicleType: heartbeat.vehicleType },
      data: { status: RideStatus.ASSIGNED, driverId: user.userId },
    });

    if (result.count !== 1) {
      throw new BadRequestException("Ride is no longer available");
    }

    const ride = await this.findRideOrThrow(rideId);
    await this.outboxService.rideAccepted(this.prisma, { rideId: ride.id, customerId: ride.customerId, partnerId: user.userId, topic: `ride:${ride.id}` });
    await this.publishRideRealtime(ride, "ride.accepted");
    return this.serializeRide(ride);
  }

  arriveRide(user: AuthenticatedUser, rideId: string) {
    return this.transitionDriverRide(user, rideId, RideStatus.ARRIVED);
  }

  startRide(user: AuthenticatedUser, rideId: string, body: RideOtpDto) {
    return this.transitionDriverRide(user, rideId, RideStatus.IN_RIDE, body.otp);
  }

  completeRide(user: AuthenticatedUser, rideId: string) {
    return this.transitionDriverRide(user, rideId, RideStatus.COMPLETED);
  }

  async cancelRide(user: AuthenticatedUser, rideId: string, body: RideCancelDto) {
    const ride = await this.findRideOrThrow(rideId);
    const isCustomer = ride.customerId === user.userId;
    const isDriver = ride.driverId === user.userId;
    const isStaff = ([UserRole.SUPPORT, UserRole.ADMIN, UserRole.SUPER_ADMIN] as UserRole[]).includes(user.role as UserRole);

    if (!isCustomer && !isDriver && !isStaff) {
      throw new ForbiddenException("Ride cancellation is not allowed");
    }

    this.assertTransitionAllowed(ride.status, RideStatus.CANCELLED);
    const cancellationFee = this.calculateCancellationFee(ride, isCustomer);
    const updated = await this.prisma.$transaction(async (tx) => {
      const latest = await tx.ride.findUnique({ where: { id: rideId }, include: { customer: { select: { id: true, name: true, phoneE164: true, role: true } }, driver: { select: { id: true, name: true, phoneE164: true, role: true } } } });

      if (!latest) {
        throw new NotFoundException("Ride not found");
      }

      this.assertTransitionAllowed(latest.status, RideStatus.CANCELLED);
      if (cancellationFee.greaterThan(ZERO)) {
        await this.writeRidePaymentLedger(tx, latest, cancellationFee, body.reason ?? "Ride cancellation fee");
      }

      const cancelled = await tx.ride.update({
        where: { id: rideId },
        data: {
          status: RideStatus.CANCELLED,
          finalFare: cancellationFee.greaterThan(ZERO) ? cancellationFee : latest.finalFare,
          paymentStatus: cancellationFee.greaterThan(ZERO) ? PaymentStatus.PAID : PaymentStatus.CANCELLED,
        },
        include: { customer: { select: { id: true, name: true, phoneE164: true, role: true } }, driver: { select: { id: true, name: true, phoneE164: true, role: true } } },
      });
      await this.outboxService.rideStatusChanged(tx, { rideId: cancelled.id, customerId: cancelled.customerId, partnerId: cancelled.driverId ?? undefined, status: cancelled.status, topic: `ride:${cancelled.id}` });
      return cancelled;
    });

    await this.publishRideRealtime(updated, "ride.cancelled", { reason: body.reason ?? null, cancellationFee: cancellationFee.toString() });
    return this.serializeRide(updated);
  }

  async rateRide(user: AuthenticatedUser, rideId: string, body: RideRatingDto) {
    const ride = await this.findRideOrThrow(rideId);
    this.assertRideAccess(user, ride);

    if (ride.status !== RideStatus.COMPLETED) {
      throw new BadRequestException("Only completed rides can be rated");
    }

    const side = user.userId === ride.customerId ? "customer" : user.userId === ride.driverId ? "driver" : null;
    if (!side) {
      throw new ForbiddenException("Ride rating is not allowed");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const markerKey = `rating:ride:${rideId}:${side}`;
      const existing = await tx.systemConfig.findUnique({ where: { key: markerKey } });
      if (existing) {
        return tx.ride.findUniqueOrThrow({ where: { id: rideId }, include: { customer: { select: { id: true, name: true, phoneE164: true, role: true } }, driver: { select: { id: true, name: true, phoneE164: true, role: true } } } });
      }

      const targetId = side === "customer" ? ride.driverId : ride.customerId;
      if (targetId) {
        await this.applyRatingAggregate(tx, `${side === "customer" ? "driver" : "customer"}:${targetId}`, body.rating);
      }

      await tx.systemConfig.create({ data: { key: markerKey, value: { rating: body.rating, comment: body.comment ?? null, by: user.userId }, description: "Ride rating marker" } });
      return tx.ride.update({ where: { id: rideId }, data: side === "customer" ? { rated: true } : {}, include: { customer: { select: { id: true, name: true, phoneE164: true, role: true } }, driver: { select: { id: true, name: true, phoneE164: true, role: true } } } });
    });

    await this.publishRideRealtime(updated, "ride.rated", { ratedBy: side });
    return this.serializeRide(updated);
  }



  private async transitionHomeService(user: AuthenticatedUser, bookingId: string, target: HomeServiceStatus, otp?: string) {
    this.assertDelivery(user);
    await this.assertApprovedOnlineDelivery(user.userId);
    const updated = await this.prisma.$transaction(async (tx) => {
      const booking = await tx.homeServiceBooking.findFirst({ where: { id: bookingId, professionalId: user.userId }, include: { customer: { select: { id: true, name: true, phoneE164: true, role: true } }, professional: { select: { id: true, name: true, phoneE164: true, role: true } } } });
      if (!booking) {
        throw new NotFoundException("Home-service booking not found");
      }

      this.assertHomeServiceTransitionAllowed(booking.status, target);
      if (target === HomeServiceStatus.IN_SERVICE) {
        this.verifyOtp(booking.startOtpHash, otp, "Start OTP is required", "Invalid start OTP");
      }

      const data: Prisma.HomeServiceBookingUpdateInput = { status: target };
      if (target === HomeServiceStatus.COMPLETED) {
        data.finalFare = booking.estimatedFare;
        data.paymentStatus = booking.paymentMethod === PrismaPaymentMethod.CASH || booking.paymentMethod === PrismaPaymentMethod.WALLET ? PaymentStatus.PAID : booking.paymentStatus;
        if (booking.paymentMethod === PrismaPaymentMethod.WALLET || booking.paymentMethod === PrismaPaymentMethod.CASH) {
          await this.writeHomeServicePaymentLedger(tx, booking, booking.estimatedFare, booking.paymentMethod === PrismaPaymentMethod.CASH ? "Home-service cash fare recorded" : "Home-service paid from wallet");
        }
      }

      const next = await tx.homeServiceBooking.update({ where: { id: bookingId }, data, include: { customer: { select: { id: true, name: true, phoneE164: true, role: true } }, professional: { select: { id: true, name: true, phoneE164: true, role: true } } } });
      await this.outboxService.homeServiceStatusChanged(tx, { homeServiceId: next.id, customerId: next.customerId, partnerId: next.professionalId ?? undefined, status: next.status, topic: `home-service:${next.id}` });
      return next;
    });

    await this.publishHomeServiceRealtime(updated, "home-service.status.changed");
    return this.serializeHomeService(updated);
  }
  private async transitionCourier(user: AuthenticatedUser, courierId: string, target: CourierStatus, otp?: string) {
    this.assertDelivery(user);
    await this.assertApprovedOnlineDelivery(user.userId);
    const updated = await this.prisma.$transaction(async (tx) => {
      const booking = await tx.courierBooking.findFirst({ where: { id: courierId, deliveryPartnerId: user.userId }, include: { customer: { select: { id: true, name: true, phoneE164: true, role: true } }, deliveryPartner: { select: { id: true, name: true, phoneE164: true, role: true } } } });

      if (!booking) {
        throw new NotFoundException("Courier booking not found");
      }

      this.assertCourierTransitionAllowed(booking.status, target);
      if (target === CourierStatus.IN_TRANSIT) {
        this.verifyOtp(booking.pickupOtpHash, otp, "Pickup OTP is required", "Invalid pickup OTP");
      }
      if (target === CourierStatus.COMPLETED) {
        this.verifyOtp(booking.deliveryOtpHash, otp, "Delivery OTP is required", "Invalid delivery OTP");
      }

      const data: Prisma.CourierBookingUpdateInput = { status: target };
      if (target === CourierStatus.COMPLETED) {
        data.finalFare = booking.estimatedFare;
        data.paymentStatus = booking.paymentMethod === PrismaPaymentMethod.CASH || booking.paymentMethod === PrismaPaymentMethod.WALLET ? PaymentStatus.PAID : booking.paymentStatus;
        if (booking.paymentMethod === PrismaPaymentMethod.WALLET || booking.paymentMethod === PrismaPaymentMethod.CASH) {
          await this.writeCourierPaymentLedger(tx, booking, booking.estimatedFare, booking.paymentMethod === PrismaPaymentMethod.CASH ? "Courier cash fare recorded" : "Courier paid from wallet");
        }
      }

      const next = await tx.courierBooking.update({ where: { id: courierId }, data, include: { customer: { select: { id: true, name: true, phoneE164: true, role: true } }, deliveryPartner: { select: { id: true, name: true, phoneE164: true, role: true } } } });
      await this.outboxService.courierStatusChanged(tx, { courierId: next.id, customerId: next.customerId, partnerId: next.deliveryPartnerId ?? undefined, status: next.status, topic: `courier:${next.id}` });
      return next;
    });

    await this.publishCourierRealtime(updated, "courier.status.changed");
    return this.serializeCourier(updated);
  }
  private async transitionDriverRide(user: AuthenticatedUser, rideId: string, target: RideStatus, otp?: string) {
    this.assertDriver(user);
    await this.assertApprovedOnlineDriver(user.userId);
    const updated = await this.prisma.$transaction(async (tx) => {
      const ride = await tx.ride.findFirst({ where: { id: rideId, driverId: user.userId }, include: { customer: { select: { id: true, name: true, phoneE164: true, role: true } }, driver: { select: { id: true, name: true, phoneE164: true, role: true } } } });

      if (!ride) {
        throw new NotFoundException("Ride not found");
      }

      this.assertTransitionAllowed(ride.status, target);
      if (target === RideStatus.IN_RIDE) {
        this.verifyOtp(ride.startOtpHash, otp, "Start OTP is required", "Invalid start OTP");
      }

      const data: Prisma.RideUpdateInput = { status: target };
      if (target === RideStatus.COMPLETED) {
        data.finalFare = ride.estimatedFare;
        data.paymentStatus = ride.paymentMethod === PrismaPaymentMethod.CASH || ride.paymentMethod === PrismaPaymentMethod.WALLET ? PaymentStatus.PAID : ride.paymentStatus;
        if (ride.paymentMethod === PrismaPaymentMethod.WALLET) {
          await this.writeRidePaymentLedger(tx, ride, ride.estimatedFare, "Ride paid from wallet");
        }
      }

      const next = await tx.ride.update({ where: { id: rideId }, data, include: { customer: { select: { id: true, name: true, phoneE164: true, role: true } }, driver: { select: { id: true, name: true, phoneE164: true, role: true } } } });
      if (target === RideStatus.COMPLETED) {
        await this.writeRideRetentionLedger(tx, next);
        await this.creditReferralReferrer(tx, next.customerId, "ride", next.id);
      }
      await this.outboxService.rideStatusChanged(tx, { rideId: next.id, customerId: next.customerId, partnerId: next.driverId ?? undefined, status: next.status, topic: `ride:${next.id}` });
      return next;
    });

    await this.publishRideRealtime(updated, "ride.status.changed");
    return this.serializeRide(updated);
  }

  private async calculateFare(vehicleType: VehicleType, route: RouteSummary): Promise<FareEstimate> {
    const config = DEFAULT_FARE_CONFIG[vehicleType];
    const surgeMultiplier = await this.getSurgeMultiplier(vehicleType);
    const distanceKm = new Prisma.Decimal(route.distanceMeters).div(1000);
    const durationMinutesDecimal = new Prisma.Decimal(route.durationSeconds).div(60);
    const estimatedFare = config.base.plus(distanceKm.mul(config.perKm)).plus(durationMinutesDecimal.mul(config.perMinute)).mul(surgeMultiplier).toDecimalPlaces(2);

    return {
      vehicleType,
      distanceMeters: route.distanceMeters,
      durationSeconds: route.durationSeconds,
      distanceKm: distanceKm.toDecimalPlaces(2).toFixed(2),
      durationMinutes: Math.ceil(route.durationSeconds / 60),
      baseFare: config.base.toFixed(2),
      surgeMultiplier: surgeMultiplier.toFixed(2),
      estimatedFare: estimatedFare.toFixed(2),
      polyline: route.polyline,
    };
  }

  private async getSurgeMultiplier(vehicleType: VehicleType): Promise<Prisma.Decimal> {
    const value = await this.redisStore.getJson<{ multiplier?: unknown }>(`surge:ride:${vehicleType}`);
    const raw = value?.multiplier;
    const multiplier = typeof raw === "number" || typeof raw === "string" ? new Prisma.Decimal(raw) : new Prisma.Decimal(1);
    return multiplier.lessThan(1) ? new Prisma.Decimal(1) : multiplier.toDecimalPlaces(2);
  }

  private async offerRideToNearbyDrivers(ride: RideWithUsers): Promise<number> {
    const pickup = this.pointFromJson(ride.pickup);
    if (!pickup) {
      return 0;
    }

    const candidates = await this.redisStore.geoRadius({ geoKey: `geo:drivers:${ride.vehicleType}`, lat: pickup.lat, lng: pickup.lng, radiusKm: DRIVER_SEARCH_RADIUS_KM, count: 12 });
    let offered = 0;

    for (const candidate of candidates) {
      const heartbeat = await this.getDriverHeartbeat(candidate.member);
      if (!heartbeat || heartbeat.vehicleType !== ride.vehicleType || this.isHeartbeatStale(heartbeat)) {
        continue;
      }

      const driver = await this.prisma.user.findUnique({ where: { id: candidate.member }, select: { role: true, isBanned: true, isOnline: true, partnerApproval: true } });
      if (!driver || driver.role !== UserRole.DRIVER || driver.isBanned || !driver.isOnline || driver.partnerApproval !== "APPROVED") {
        continue;
      }

      await this.redisStore.setJson(`driver:offers:${candidate.member}:${ride.id}`, { rideId: ride.id, distanceKm: candidate.distanceKm }, DRIVER_OFFER_TTL_MS);
      await this.realtimeProvider.publish(`partner:${candidate.member}`, {
        id: `ride.offer:${ride.id}:${candidate.member}:${Date.now()}`,
        type: "ride.offer.created",
        payload: { rideId: ride.id, vehicleType: ride.vehicleType, pickup: ride.pickup, drop: ride.drop, estimatedFare: ride.estimatedFare.toString(), distanceKm: Number(candidate.distanceKm.toFixed(2)) },
      });
      offered += 1;
    }

    return offered;
  }

  private modeForVehicle(vehicleType: string): MapTravelMode {
    return vehicleType === VehicleType.BIKE ? "TWO_WHEELER" : "DRIVE";
  }


  private async offerCourierToNearbyPartners(booking: CourierWithUsers): Promise<number> {
    const pickup = this.pointFromJson(booking.pickup);
    if (!pickup) {
      return 0;
    }

    const candidates = await this.redisStore.geoRadius({ geoKey: "geo:partners:delivery", lat: pickup.lat, lng: pickup.lng, radiusKm: COURIER_SEARCH_RADIUS_KM, count: 12 });
    let offered = 0;

    for (const candidate of candidates) {
      const heartbeat = await this.getPartnerHeartbeat(candidate.member);
      if (!heartbeat || heartbeat.role !== UserRole.DELIVERY || this.isHeartbeatStale(heartbeat)) {
        continue;
      }

      const partner = await this.prisma.user.findUnique({ where: { id: candidate.member }, select: { role: true, isBanned: true, isOnline: true, partnerApproval: true } });
      if (!partner || partner.role !== UserRole.DELIVERY || partner.isBanned || !partner.isOnline || partner.partnerApproval !== "APPROVED") {
        continue;
      }

      await this.redisStore.setJson(`partner:courier-offers:${candidate.member}:${booking.id}`, { courierId: booking.id, distanceKm: candidate.distanceKm }, COURIER_OFFER_TTL_MS);
      await this.realtimeProvider.publish(`partner:${candidate.member}`, {
        id: `courier.offer:${booking.id}:${candidate.member}:${Date.now()}`,
        type: "courier.offer.created",
        payload: { courierId: booking.id, pickup: booking.pickup, drop: booking.drop, packageDescription: booking.packageDescription, estimatedFare: booking.estimatedFare.toString(), distanceKm: Number(candidate.distanceKm.toFixed(2)) },
      });
      offered += 1;
    }

    return offered;
  }

  private async findCourierOrThrow(courierId: string): Promise<CourierWithUsers> {
    const booking = await this.prisma.courierBooking.findUnique({ where: { id: courierId }, include: { customer: { select: { id: true, name: true, phoneE164: true, role: true } }, deliveryPartner: { select: { id: true, name: true, phoneE164: true, role: true } } } });
    if (!booking) {
      throw new NotFoundException("Courier booking not found");
    }
    return booking;
  }

  private async assertApprovedOnlineDelivery(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true, isBanned: true, isOnline: true, partnerApproval: true } });
    if (!user || user.role !== UserRole.DELIVERY || user.isBanned || !user.isOnline || user.partnerApproval !== "APPROVED") {
      throw new ForbiddenException("Approved online delivery partner status is required");
    }
  }

  private assertDelivery(user: AuthenticatedUser): void {
    if (user.role !== UserRole.DELIVERY) {
      throw new ForbiddenException("Only delivery partners can manage courier jobs");
    }
  }

  private assertCourierAccess(user: AuthenticatedUser, booking: { customerId: string; deliveryPartnerId: string | null }): void {
    const isStaff = ([UserRole.SUPPORT, UserRole.ADMIN, UserRole.SUPER_ADMIN] as UserRole[]).includes(user.role as UserRole);
    if (!isStaff && booking.customerId !== user.userId && booking.deliveryPartnerId !== user.userId) {
      throw new ForbiddenException("Courier access is not allowed");
    }
  }

  private assertCourierTransitionAllowed(from: CourierStatus, to: CourierStatus): void {
    if (!canTransition(courierStatusTransitions, from as unknown as SharedCourierStatus, to as unknown as SharedCourierStatus)) {
      throw new BadRequestException(`Illegal courier status transition: ${from} to ${to}`);
    }
  }

  private verifyOtp(expected: string | null, otp: string | undefined, requiredMessage: string, invalidMessage: string): void {
    if (!expected || !otp) {
      throw new BadRequestException(requiredMessage);
    }

    const expectedBuffer = Buffer.from(expected, "hex");
    const actualBuffer = Buffer.from(this.hashOtp(otp.trim()), "hex");
    if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
      throw new BadRequestException(invalidMessage);
    }
  }

  private async writeCourierPaymentLedger(tx: PrismaTx, booking: CourierWithUsers, amount: Prisma.Decimal, description: string): Promise<void> {
    if (booking.paymentMethod !== PrismaPaymentMethod.WALLET && booking.paymentMethod !== PrismaPaymentMethod.CASH) {
      return;
    }

    if (booking.paymentMethod === PrismaPaymentMethod.WALLET) {
      await tx.ledgerEntry.create({ data: { userId: booking.customerId, userRole: booking.customer.role, type: LedgerEntryType.DEBIT, amount, description, paymentMethod: booking.paymentMethod } });
      await this.reconcileWalletBalance(tx, booking.customerId);
    }

    if (booking.deliveryPartnerId && booking.deliveryPartner) {
      await tx.ledgerEntry.create({ data: { userId: booking.deliveryPartnerId, userRole: booking.deliveryPartner.role, type: LedgerEntryType.CREDIT, amount, description: booking.paymentMethod === PrismaPaymentMethod.CASH ? "Courier cash fare recorded" : "Courier wallet fare received", paymentMethod: booking.paymentMethod } });
      await this.reconcileWalletBalance(tx, booking.deliveryPartnerId);
    }
  }

  private courierPointSnapshot(location: RideLocationDto, contact: { name: string; phone: string; note?: string }): Prisma.InputJsonValue {
    return { ...(this.locationSnapshot(location) as Record<string, unknown>), contact: { name: contact.name, phone: contact.phone, note: contact.note ?? null } };
  }

  private async getPartnerHeartbeat(partnerId: string): Promise<DriverHeartbeat | null> {
    const heartbeat = await this.redisStore.getJson<DriverHeartbeat>(`heartbeat:partner:${partnerId}`);
    return heartbeat ?? null;
  }

  private async publishCourierRealtime(booking: CourierWithUsers, type: string, extra: Record<string, unknown> = {}): Promise<void> {
    await this.realtimeProvider.publish(`courier:${booking.id}`, {
      id: `${type}:${booking.id}:${Date.now()}`,
      type,
      payload: {
        courierId: booking.id,
        customerId: booking.customerId,
        deliveryPartnerId: booking.deliveryPartnerId,
        status: booking.status,
        estimatedFare: booking.estimatedFare.toString(),
        finalFare: booking.finalFare?.toString() ?? null,
        ...extra,
      },
    });
  }

  private serializeCourier(booking: CourierWithUsers) {
    return {
      id: booking.id,
      customerId: booking.customerId,
      deliveryPartnerId: booking.deliveryPartnerId,
      pickup: booking.pickup,
      drop: booking.drop,
      status: booking.status,
      packageDescription: booking.packageDescription,
      packageWeightKg: booking.packageWeightKg?.toString() ?? null,
      estimatedFare: booking.estimatedFare.toString(),
      finalFare: booking.finalFare?.toString() ?? null,
      distanceKm: booking.distanceKm?.toString() ?? null,
      paymentMethod: booking.paymentMethod,
      paymentStatus: booking.paymentStatus,
      rated: booking.rated,
      customer: booking.customer ? { id: booking.customer.id, name: booking.customer.name, phoneE164: booking.customer.phoneE164 } : null,
      deliveryPartner: booking.deliveryPartner ? { id: booking.deliveryPartner.id, name: booking.deliveryPartner.name, phoneE164: booking.deliveryPartner.phoneE164 } : null,
      createdAt: booking.createdAt.toISOString(),
      updatedAt: booking.updatedAt.toISOString(),
    };
  }
  private async offerHomeServiceToNearbyProfessionals(booking: HomeServiceWithUsers): Promise<number> {
    const address = this.pointFromJson(booking.address);
    if (!address) {
      return 0;
    }

    const candidates = await this.redisStore.geoRadius({ geoKey: "geo:partners:delivery", lat: address.lat, lng: address.lng, radiusKm: HOME_SERVICE_SEARCH_RADIUS_KM, count: 12 });
    let offered = 0;

    for (const candidate of candidates) {
      const heartbeat = await this.getPartnerHeartbeat(candidate.member);
      if (!heartbeat || heartbeat.role !== UserRole.DELIVERY || this.isHeartbeatStale(heartbeat)) {
        continue;
      }

      const partner = await this.prisma.user.findUnique({ where: { id: candidate.member }, select: { role: true, isBanned: true, isOnline: true, partnerApproval: true } });
      if (!partner || partner.role !== UserRole.DELIVERY || partner.isBanned || !partner.isOnline || partner.partnerApproval !== "APPROVED") {
        continue;
      }

      await this.redisStore.setJson(`partner:home-service-offers:${candidate.member}:${booking.id}`, { homeServiceId: booking.id, distanceKm: candidate.distanceKm }, HOME_SERVICE_OFFER_TTL_MS);
      await this.realtimeProvider.publish(`partner:${candidate.member}`, {
        id: `home-service.offer:${booking.id}:${candidate.member}:${Date.now()}`,
        type: "home-service.offer.created",
        payload: { homeServiceId: booking.id, serviceCategory: booking.serviceCategory, serviceDescription: booking.serviceDescription, address: booking.address, scheduledFor: booking.scheduledFor?.toISOString() ?? null, estimatedFare: booking.estimatedFare.toString(), distanceKm: Number(candidate.distanceKm.toFixed(2)) },
      });
      offered += 1;
    }

    return offered;
  }

  private async findHomeServiceCatalogItem(serviceCode: string): Promise<HomeServiceCatalogItem> {
    const item = await this.prisma.homeServiceCatalogItem.findFirst({
      where: { code: serviceCode, isActive: true },
    });
    if (!item) {
      throw new NotFoundException("Home-service item not found");
    }
    return item;
  }

  private serializeHomeServiceCatalogItem(item: HomeServiceCatalogItem) {
    return {
      code: item.code,
      category: item.category,
      name: item.name,
      description: item.description,
      price: item.price.toString(),
      durationMinutes: item.durationMinutes,
    };
  }

  private serializeHomeServiceEstimate(item: HomeServiceCatalogItem) {
    return {
      service: this.serializeHomeServiceCatalogItem(item),
      estimatedFare: item.price.toString(),
      durationMinutes: item.durationMinutes,
    };
  }

  private async findHomeServiceOrThrow(bookingId: string): Promise<HomeServiceWithUsers> {
    const booking = await this.prisma.homeServiceBooking.findUnique({ where: { id: bookingId }, include: { customer: { select: { id: true, name: true, phoneE164: true, role: true } }, professional: { select: { id: true, name: true, phoneE164: true, role: true } } } });
    if (!booking) {
      throw new NotFoundException("Home-service booking not found");
    }
    return booking;
  }

  private assertHomeServiceAccess(user: AuthenticatedUser, booking: { customerId: string; professionalId: string | null }): void {
    const isStaff = ([UserRole.SUPPORT, UserRole.ADMIN, UserRole.SUPER_ADMIN] as UserRole[]).includes(user.role as UserRole);
    if (!isStaff && booking.customerId !== user.userId && booking.professionalId !== user.userId) {
      throw new ForbiddenException("Home-service access is not allowed");
    }
  }

  private assertHomeServiceTransitionAllowed(from: HomeServiceStatus, to: HomeServiceStatus): void {
    if (!canTransition(homeServiceStatusTransitions, from as unknown as SharedHomeServiceStatus, to as unknown as SharedHomeServiceStatus)) {
      throw new BadRequestException(`Illegal home-service status transition: ${from} to ${to}`);
    }
  }

  private async writeHomeServicePaymentLedger(tx: PrismaTx, booking: HomeServiceWithUsers, amount: Prisma.Decimal, description: string): Promise<void> {
    if (booking.paymentMethod !== PrismaPaymentMethod.WALLET && booking.paymentMethod !== PrismaPaymentMethod.CASH) {
      return;
    }

    if (booking.paymentMethod === PrismaPaymentMethod.WALLET) {
      await tx.ledgerEntry.create({ data: { userId: booking.customerId, userRole: booking.customer.role, type: LedgerEntryType.DEBIT, amount, description, paymentMethod: booking.paymentMethod } });
      await this.reconcileWalletBalance(tx, booking.customerId);
    }

    if (booking.professionalId && booking.professional) {
      await tx.ledgerEntry.create({ data: { userId: booking.professionalId, userRole: booking.professional.role, type: LedgerEntryType.CREDIT, amount, description: booking.paymentMethod === PrismaPaymentMethod.CASH ? "Home-service cash fare recorded" : "Home-service wallet fare received", paymentMethod: booking.paymentMethod } });
      await this.reconcileWalletBalance(tx, booking.professionalId);
    }
  }

  private homeServiceAddressSnapshot(location: RideLocationDto, note?: string): Prisma.InputJsonValue {
    return { ...(this.locationSnapshot(location) as Record<string, unknown>), note: note ?? null };
  }

  private async publishHomeServiceRealtime(booking: HomeServiceWithUsers, type: string, extra: Record<string, unknown> = {}): Promise<void> {
    await this.realtimeProvider.publish(`home-service:${booking.id}`, {
      id: `${type}:${booking.id}:${Date.now()}`,
      type,
      payload: {
        homeServiceId: booking.id,
        customerId: booking.customerId,
        professionalId: booking.professionalId,
        status: booking.status,
        serviceCategory: booking.serviceCategory,
        serviceDescription: booking.serviceDescription,
        scheduledFor: booking.scheduledFor?.toISOString() ?? null,
        estimatedFare: booking.estimatedFare.toString(),
        finalFare: booking.finalFare?.toString() ?? null,
        ...extra,
      },
    });
  }

  private serializeHomeService(booking: HomeServiceWithUsers) {
    return {
      id: booking.id,
      customerId: booking.customerId,
      professionalId: booking.professionalId,
      serviceCategory: booking.serviceCategory,
      serviceDescription: booking.serviceDescription,
      address: booking.address,
      scheduledFor: booking.scheduledFor?.toISOString() ?? null,
      status: booking.status,
      estimatedFare: booking.estimatedFare.toString(),
      finalFare: booking.finalFare?.toString() ?? null,
      durationMinutes: booking.durationMinutes,
      paymentMethod: booking.paymentMethod,
      paymentStatus: booking.paymentStatus,
      rated: booking.rated,
      customer: booking.customer ? { id: booking.customer.id, name: booking.customer.name, phoneE164: booking.customer.phoneE164 } : null,
      professional: booking.professional ? { id: booking.professional.id, name: booking.professional.name, phoneE164: booking.professional.phoneE164 } : null,
      createdAt: booking.createdAt.toISOString(),
      updatedAt: booking.updatedAt.toISOString(),
    };
  }
  private async findRideOrThrow(rideId: string): Promise<RideWithUsers> {
    const ride = await this.prisma.ride.findUnique({ where: { id: rideId }, include: { customer: { select: { id: true, name: true, phoneE164: true, role: true } }, driver: { select: { id: true, name: true, phoneE164: true, role: true } } } });
    if (!ride) {
      throw new NotFoundException("Ride not found");
    }
    return ride;
  }

  private async assertApprovedOnlineDriver(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true, isBanned: true, isOnline: true, partnerApproval: true } });
    if (!user || user.role !== UserRole.DRIVER || user.isBanned || !user.isOnline || user.partnerApproval !== "APPROVED") {
      throw new ForbiddenException("Approved online driver status is required");
    }
  }

  private assertCustomer(user: AuthenticatedUser): void {
    if (user.role !== UserRole.CUSTOMER) {
      throw new ForbiddenException("Only customers can book rides");
    }
  }

  private assertDriver(user: AuthenticatedUser): void {
    if (user.role !== UserRole.DRIVER) {
      throw new ForbiddenException("Only drivers can manage rides");
    }
  }

  private assertRideAccess(user: AuthenticatedUser, ride: { customerId: string; driverId: string | null }): void {
    const isStaff = ([UserRole.SUPPORT, UserRole.ADMIN, UserRole.SUPER_ADMIN] as UserRole[]).includes(user.role as UserRole);
    if (!isStaff && ride.customerId !== user.userId && ride.driverId !== user.userId) {
      throw new ForbiddenException("Ride access is not allowed");
    }
  }

  private assertTransitionAllowed(from: RideStatus, to: RideStatus): void {
    if (!canTransition(rideStatusTransitions, from as unknown as SharedRideStatus, to as unknown as SharedRideStatus)) {
      throw new BadRequestException(`Illegal ride status transition: ${from} to ${to}`);
    }
  }

  private generateOtp(): string {
    return String(randomInt(100000, 1000000));
  }

  private hashOtp(code: string): string {
    return createHash("sha256").update(`${OTP_HASH_SALT}:${code}`).digest("hex");
  }


  private calculateCancellationFee(ride: { status: RideStatus; estimatedFare: Prisma.Decimal; driverId: string | null }, customerCancelled: boolean): Prisma.Decimal {
    if (!customerCancelled || !ride.driverId || !([RideStatus.ASSIGNED, RideStatus.ARRIVED] as RideStatus[]).includes(ride.status)) {
      return ZERO;
    }

    const percentageFee = ride.estimatedFare.mul(0.2).toDecimalPlaces(2);
    return percentageFee.greaterThan(50) ? new Prisma.Decimal(50) : percentageFee;
  }

  private async writeRideRetentionLedger(tx: PrismaTx, ride: RideWithUsers): Promise<void> {
    const amount = ride.finalFare ?? ride.estimatedFare;
    const points = amount.mul(RIDE_LOYALTY_POINTS_PER_RUPEE).toDecimalPlaces(0);
    if (points.lessThanOrEqualTo(0)) {
      return;
    }

    const existing = await tx.ledgerEntry.findFirst({ where: { paymentId: `loyalty:ride:${ride.id}` } });
    if (existing) {
      return;
    }

    await tx.ledgerEntry.create({
      data: {
        userId: ride.customerId,
        userRole: ride.customer.role,
        type: LedgerEntryType.LOYALTY,
        amount: points,
        description: `Loyalty points for ride ${ride.id}`,
        rideId: ride.id,
        paymentId: `loyalty:ride:${ride.id}`,
      },
    });
  }

  private async creditReferralReferrer(tx: PrismaTx, refereeId: string, source: "order" | "ride", sourceId: string): Promise<void> {
    const referral = await tx.referral.findUnique({ where: { refereeId }, include: { referrer: { select: { role: true } } } });
    if (!referral || referral.referrerCreditedAt) {
      return;
    }

    await tx.ledgerEntry.create({
      data: {
        userId: referral.referrerId,
        userRole: referral.referrer.role,
        type: LedgerEntryType.PROMOTION,
        amount: REFERRAL_REFERRER_CREDIT,
        description: `Referral credit after first ${source} ${sourceId}`,
        paymentId: `referral:referrer:${referral.id}`,
      },
    });
    await tx.referral.update({ where: { id: referral.id }, data: { referrerCreditedAt: new Date() } });
    await this.reconcileWalletBalance(tx, referral.referrerId);
  }
  private async writeRidePaymentLedger(tx: PrismaTx, ride: RideWithUsers, amount: Prisma.Decimal, description: string): Promise<void> {
    if (ride.paymentMethod !== PrismaPaymentMethod.WALLET && ride.paymentMethod !== PrismaPaymentMethod.CASH) {
      return;
    }

    if (ride.paymentMethod === PrismaPaymentMethod.WALLET) {
      await tx.ledgerEntry.create({ data: { userId: ride.customerId, userRole: ride.customer.role, type: LedgerEntryType.DEBIT, amount, description, paymentMethod: ride.paymentMethod, rideId: ride.id } });
      await this.reconcileWalletBalance(tx, ride.customerId);
    }

    if (ride.driverId && ride.driver) {
      await tx.ledgerEntry.create({ data: { userId: ride.driverId, userRole: ride.driver.role, type: LedgerEntryType.CREDIT, amount, description: ride.paymentMethod === PrismaPaymentMethod.CASH ? "Ride cash fare recorded" : "Ride wallet fare received", paymentMethod: ride.paymentMethod, rideId: ride.id } });
      await this.reconcileWalletBalance(tx, ride.driverId);
    }
  }

  private async reconcileWalletBalance(tx: PrismaTx | PrismaService, userId: string): Promise<Prisma.Decimal> {
    const balance = await this.computeWalletBalance(tx, userId);
    await tx.user.update({ where: { id: userId }, data: { walletBalanceCached: balance } });
    return balance;
  }

  private async computeWalletBalance(tx: PrismaTx | PrismaService, userId: string): Promise<Prisma.Decimal> {
    const entries = await tx.ledgerEntry.findMany({ where: { userId }, select: { type: true, amount: true } });
    return entries.reduce((balance, entry) => {
      if (([LedgerEntryType.CREDIT, LedgerEntryType.REFUND, LedgerEntryType.ADJUSTMENT, LedgerEntryType.PROMOTION] as LedgerEntryType[]).includes(entry.type)) {
        return balance.plus(entry.amount);
      }
      if (entry.type === LedgerEntryType.LOYALTY) {
        return balance;
      }
      return balance.minus(entry.amount);
    }, ZERO);
  }

  private async applyRatingAggregate(tx: PrismaTx, key: string, rating: number): Promise<void> {
    const configKey = `rating:${key}`;
    const existing = await tx.systemConfig.findUnique({ where: { key: configKey } });
    const value = existing && typeof existing.value === "object" && existing.value !== null && !Array.isArray(existing.value) ? (existing.value as { average?: unknown; count?: unknown }) : {};
    const count = typeof value.count === "number" ? value.count : 0;
    const average = new Prisma.Decimal(typeof value.average === "string" || typeof value.average === "number" ? value.average : 0);
    const nextCount = count + 1;
    const nextAverage = average.mul(count).plus(rating).div(nextCount).toDecimalPlaces(2).toString();

    await tx.systemConfig.upsert({
      where: { key: configKey },
      update: { value: { average: nextAverage, count: nextCount }, description: "Ride rating aggregate" },
      create: { key: configKey, value: { average: nextAverage, count: nextCount }, description: "Ride rating aggregate" },
    });
  }

  private locationSnapshot(location: RideLocationDto): Prisma.InputJsonValue {
    return { address: location.address, placeId: location.placeId ?? null, lat: location.lat, lng: location.lng, source: location.source };
  }

  private async getDriverHeartbeat(driverId: string): Promise<DriverHeartbeat | null> {
    const heartbeat = await this.redisStore.getJson<DriverHeartbeat>(`heartbeat:driver:${driverId}`);
    return heartbeat ?? null;
  }

  private isHeartbeatStale(heartbeat: DriverHeartbeat): boolean {
    if (!heartbeat.at) {
      return true;
    }
    return Date.now() - new Date(heartbeat.at).getTime() > DRIVER_HEARTBEAT_STALE_MS;
  }

  private isVehicleType(value: unknown): value is VehicleType {
    return typeof value === "string" && Object.values(VehicleType).includes(value as VehicleType);
  }

  private pointFromJson(value: Prisma.JsonValue): { lat: number; lng: number } | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    const record = value as { lat?: unknown; lng?: unknown };
    const lat = typeof record.lat === "number" ? record.lat : typeof record.lat === "string" ? Number(record.lat) : NaN;
    const lng = typeof record.lng === "number" ? record.lng : typeof record.lng === "string" ? Number(record.lng) : NaN;
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }

  private distanceFromPickup(pickup: Prisma.JsonValue, lat: number, lng: number): number {
    const point = this.pointFromJson(pickup);
    if (!point) {
      return Number.POSITIVE_INFINITY;
    }
    const earthRadiusKm = 6371;
    const toRadians = (value: number) => (value * Math.PI) / 180;
    const dLat = toRadians(point.lat - lat);
    const dLng = toRadians(point.lng - lng);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRadians(lat)) * Math.cos(toRadians(point.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private async publishRideRealtime(ride: RideWithUsers, type: string, extra: Record<string, unknown> = {}): Promise<void> {
    await this.realtimeProvider.publish(`ride:${ride.id}`, {
      id: `${type}:${ride.id}:${Date.now()}`,
      type,
      payload: {
        rideId: ride.id,
        customerId: ride.customerId,
        driverId: ride.driverId,
        status: ride.status,
        vehicleType: ride.vehicleType,
        estimatedFare: ride.estimatedFare.toString(),
        finalFare: ride.finalFare?.toString() ?? null,
        ...extra,
      },
    });
  }

  private serializeRide(ride: RideWithUsers) {
    return {
      id: ride.id,
      customerId: ride.customerId,
      driverId: ride.driverId,
      vehicleType: ride.vehicleType,
      pickup: ride.pickup,
      drop: ride.drop,
      status: ride.status,
      estimatedFare: ride.estimatedFare.toString(),
      finalFare: ride.finalFare?.toString() ?? null,
      distanceKm: ride.distanceKm?.toString() ?? null,
      durationMinutes: ride.durationMinutes,
      surgeMultiplier: ride.surgeMultiplier.toString(),
      paymentMethod: ride.paymentMethod,
      paymentStatus: ride.paymentStatus,
      rated: ride.rated,
      customer: ride.customer ? { id: ride.customer.id, name: ride.customer.name, phoneE164: ride.customer.phoneE164 } : null,
      driver: ride.driver ? { id: ride.driver.id, name: ride.driver.name, phoneE164: ride.driver.phoneE164 } : null,
      createdAt: ride.createdAt.toISOString(),
      updatedAt: ride.updatedAt.toISOString(),
    };
  }
}