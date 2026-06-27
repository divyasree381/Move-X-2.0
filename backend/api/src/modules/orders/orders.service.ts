import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  CouponDiscountType,
  LedgerEntryType,
  OrderStatus,
  PartnerApproval,
  PaymentMethod as PrismaPaymentMethod,
  PaymentStatus,
  Prisma,
  RideStatus,
  ServiceType,
  UserRole,
} from "@prisma/client";
import { OrderStatus as SharedOrderStatus, canTransition, orderStatusTransitions } from "@movex/shared";
import type { PaymentMethod as SharedPaymentMethod } from "@movex/shared";

import { RedisStoreService } from "../../infrastructure/redis/redis-store.service";
import { STORAGE_PROVIDER, type StorageProvider, type StoredObject } from "../../infrastructure/storage/storage-provider";
import { MarketplaceService } from "../marketplace/marketplace.service";
import { OutboxService } from "../outbox/outbox.service";
import { REALTIME_PROVIDER, type RealtimeProvider } from "../realtime/realtime-provider";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import {
  ApplyCouponDto,
  CancelOrderDto,
  CartItemDto,
  CheckoutAddressDto,
  CheckoutDto,
  OrdersQueryDto,
  OtpStatusDto,
  PrepTimeDto,
  PrescriptionUploadDto,
  PrescriptionVerificationDto,
  RatingDto,
  SubstitutionDecisionDto,
  SubstitutionProposalDto,
  UpdateCartQtyDto,
} from "./dto/orders.dto";

type PrismaTx = Prisma.TransactionClient;

type StoredCartItem = {
  menuItemId: string;
  quantity: number;
  customizations?: Record<string, unknown>;
  note?: string;
  substitutionPreference?: Record<string, unknown>;
};

type PrescriptionAttachment = {
  status: "UPLOADED" | "VERIFIED" | "REJECTED";
  files: StoredObject[];
  uploadedAt: string;
  note?: string | null;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  verificationNote?: string | null;
};

type StoredCart = {
  storeId?: string;
  items: StoredCartItem[];
  couponCode?: string;
  prescription?: PrescriptionAttachment;
  updatedAt: string;
};

type CartLine = StoredCartItem & {
  name: string;
  description: string;
  imageUrl?: string | null;
  section: string;
  price: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  available: boolean;
  stock: number;
};

type CartQuote = {
  cart: StoredCart;
  store?: {
    id: string;
    ownerId: string;
    type: ServiceType;
    name: string;
    etaMinutes: number;
    minOrder: Prisma.Decimal;
    deliveryRadiusKm: Prisma.Decimal;
    lat: Prisma.Decimal;
    lng: Prisma.Decimal;
    isOpen: boolean;
    approval: PartnerApproval;
    openingHours: Prisma.JsonValue;
    owner: { id: string; role: UserRole };
  };
  lines: CartLine[];
  subtotal: Prisma.Decimal;
  deliveryFee: Prisma.Decimal;
  discount: Prisma.Decimal;
  taxes: Prisma.Decimal;
  total: Prisma.Decimal;
  coupon?: { id: string; code: string; title?: string; campaignName?: string | null; campaignTag?: string | null; serviceType?: ServiceType | null };
  couponError?: string;
  distanceKm?: number;
  minimumRemaining?: Prisma.Decimal;
};

type CheckoutResponse = {
  order: Record<string, unknown>;
  paymentRequired: boolean;
  devOtps?: { pickup: string; delivery: string };
};

const CART_TTL_MS = Number(process.env.CART_TTL_MS ?? 30 * 24 * 60 * 60 * 1000);
const CHECKOUT_IDEMPOTENCY_TTL_MS = Number(process.env.ORDER_CHECKOUT_IDEMPOTENCY_TTL_MS ?? 24 * 60 * 60 * 1000);
const CHECKOUT_LOCK_TTL_MS = Number(process.env.ORDER_CHECKOUT_LOCK_TTL_MS ?? 30_000);
const TAX_RATE = new Prisma.Decimal(process.env.ORDER_TAX_RATE ?? "0.05");
const BASE_DELIVERY_FEE = new Prisma.Decimal(process.env.ORDER_BASE_DELIVERY_FEE ?? "25");
const DELIVERY_FEE_PER_KM = new Prisma.Decimal(process.env.ORDER_DELIVERY_FEE_PER_KM ?? "6");
const OTP_HASH_SALT = process.env.ORDER_OTP_HASH_SALT ?? "movex-local-otp-salt";
const ZERO = new Prisma.Decimal(0);
const ORDER_LOYALTY_POINTS_PER_RUPEE = new Prisma.Decimal(process.env.ORDER_LOYALTY_POINTS_PER_RUPEE ?? "0.02");
const REFERRAL_REFERRER_CREDIT = new Prisma.Decimal(process.env.REFERRAL_REFERRER_CREDIT ?? "100");

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisStore: RedisStoreService,
    @Inject(STORAGE_PROVIDER) private readonly storageProvider: StorageProvider,
    private readonly marketplaceService: MarketplaceService,
    private readonly outboxService: OutboxService,
    @Inject(REALTIME_PROVIDER) private readonly realtimeProvider: RealtimeProvider,
  ) {}

  async getCart(user: AuthenticatedUser) {
    this.assertCustomer(user);
    const cart = await this.readCart(user.userId);
    const quote = await this.buildCartQuote(this.prisma, user.userId, cart);
    return this.serializeCartQuote(quote);
  }

  async addCartItem(user: AuthenticatedUser, body: CartItemDto) {
    this.assertCustomer(user);
    const menuItem = await this.prisma.menuItem.findUnique({
      where: { id: body.menuItemId },
      include: { store: true },
    });

    if (!menuItem || !menuItem.available || menuItem.store.approval !== PartnerApproval.APPROVED) {
      throw new NotFoundException("Menu item is not available");
    }

    const cart = await this.readCart(user.userId);

    if (cart.storeId && cart.storeId !== menuItem.storeId) {
      throw new BadRequestException("Cart can contain items from one store only");
    }

    const existing = cart.items.find((item) => item.menuItemId === body.menuItemId);
    const nextQuantity = body.quantity + (existing?.quantity ?? 0);

    if (menuItem.stock !== -1 && nextQuantity > menuItem.stock) {
      throw new BadRequestException("Insufficient stock");
    }

    const nextItems = existing
      ? cart.items.map((item) =>
          item.menuItemId === body.menuItemId
            ? { ...item, quantity: nextQuantity, customizations: body.customizations, note: body.note, substitutionPreference: body.substitutionPreference }
            : item,
        )
      : [...cart.items, { menuItemId: body.menuItemId, quantity: body.quantity, customizations: body.customizations, note: body.note, substitutionPreference: body.substitutionPreference }];

    await this.writeCart(user.userId, { ...cart, storeId: menuItem.storeId, items: nextItems, updatedAt: new Date().toISOString() });
    return this.getCart(user);
  }

  async updateCartQty(user: AuthenticatedUser, menuItemId: string, body: UpdateCartQtyDto) {
    this.assertCustomer(user);
    const cart = await this.readCart(user.userId);

    if (!cart.items.some((item) => item.menuItemId === menuItemId)) {
      throw new NotFoundException("Cart item not found");
    }

    const menuItem = await this.prisma.menuItem.findUnique({ where: { id: menuItemId } });

    if (!menuItem) {
      throw new NotFoundException("Menu item not found");
    }

    if (menuItem.stock !== -1 && body.quantity > menuItem.stock) {
      throw new BadRequestException("Insufficient stock");
    }

    await this.writeCart(user.userId, {
      ...cart,
      items: cart.items.map((item) => (item.menuItemId === menuItemId ? { ...item, quantity: body.quantity } : item)),
      updatedAt: new Date().toISOString(),
    });
    return this.getCart(user);
  }

  async removeCartItem(user: AuthenticatedUser, menuItemId: string) {
    this.assertCustomer(user);
    const cart = await this.readCart(user.userId);
    const items = cart.items.filter((item) => item.menuItemId !== menuItemId);
    await this.writeCart(user.userId, {
      ...cart,
      storeId: items.length > 0 ? cart.storeId : undefined,
      couponCode: items.length > 0 ? cart.couponCode : undefined,
      items,
      updatedAt: new Date().toISOString(),
    });
    return this.getCart(user);
  }

  async clearCart(user: AuthenticatedUser) {
    this.assertCustomer(user);
    await this.redisStore.delete(this.cartKey(user.userId));
    return this.emptyCartResponse();
  }

  async applyCoupon(user: AuthenticatedUser, body: ApplyCouponDto) {
    this.assertCustomer(user);
    const cart = await this.readCart(user.userId);

    if (cart.items.length === 0) {
      throw new BadRequestException("Cart is empty");
    }
    const nextCart = { ...cart, couponCode: body.code.trim().toUpperCase(), updatedAt: new Date().toISOString() };
    const quote = await this.buildCartQuote(this.prisma, user.userId, nextCart);

    if (quote.couponError) {
      throw new BadRequestException(quote.couponError);
    }

    await this.writeCart(user.userId, nextCart);
    return this.serializeCartQuote(quote);
  }


  async uploadCartPrescription(user: AuthenticatedUser, body: PrescriptionUploadDto) {
    this.assertCustomer(user);
    const cart = await this.readCart(user.userId);

    if (!cart.storeId || cart.items.length === 0) {
      throw new BadRequestException("Add pharmacy items before uploading a prescription");
    }

    const quote = await this.buildCartQuote(this.prisma, user.userId, cart);
    if (quote.store?.type !== ServiceType.PHARMACY) {
      throw new BadRequestException("Prescription upload is only required for pharmacy carts");
    }

    const uploaded = await this.storageProvider.putObject({
      keyPrefix: `prescriptions/${user.userId}`,
      fileName: body.fileName,
      contentType: body.contentType,
      contentBase64: body.contentBase64,
      metadata: { userId: user.userId, storeId: cart.storeId },
    });
    const prescription: PrescriptionAttachment = {
      status: "UPLOADED",
      files: [...(cart.prescription?.files ?? []), uploaded],
      uploadedAt: cart.prescription?.uploadedAt ?? new Date().toISOString(),
      note: body.note ?? cart.prescription?.note ?? null,
      verifiedBy: null,
      verifiedAt: null,
      verificationNote: null,
    };

    await this.writeCart(user.userId, { ...cart, prescription, updatedAt: new Date().toISOString() });
    return this.getCart(user);
  }
  async removeCoupon(user: AuthenticatedUser) {
    this.assertCustomer(user);
    const cart = await this.readCart(user.userId);
    const nextCart = { ...cart, couponCode: undefined, updatedAt: new Date().toISOString() };
    await this.writeCart(user.userId, nextCart);
    return this.getCart(user);
  }

  async checkout(user: AuthenticatedUser, body: CheckoutDto): Promise<CheckoutResponse> {
    this.assertCustomer(user);
    const cacheKey = `orders:checkout:${user.userId}:${body.idempotencyKey}`;
    const cached = await this.redisStore.getJson<CheckoutResponse>(cacheKey);

    if (cached) {
      return cached;
    }

    const lockKey = `${cacheKey}:lock`;
    const locked = await this.redisStore.acquireLock(lockKey, CHECKOUT_LOCK_TTL_MS);

    if (!locked) {
      const retryCached = await this.redisStore.getJson<CheckoutResponse>(cacheKey);

      if (retryCached) {
        return retryCached;
      }

      throw new BadRequestException("Checkout is already in progress");
    }

    try {
      const cart = await this.readCart(user.userId);

      if (cart.items.length === 0) {
        throw new BadRequestException("Cart is empty");
      }

      const pickupOtp = String(randomInt(100000, 1000000));
      const deliveryOtp = String(randomInt(100000, 1000000));
      const order = await this.prisma.$transaction(async (tx) => {
        const quote = await this.buildCheckoutQuote(tx, user.userId, cart, body.address, body.paymentMethod);
        const store = quote.store;

        if (!store) {
          throw new BadRequestException("Cart store is unavailable");
        }

        const pickupOtp = String(randomInt(100000, 1000000));
        const deliveryOtp = String(randomInt(100000, 1000000));
        const paymentMethod = body.paymentMethod as PrismaPaymentMethod;
        const paymentStatus = paymentMethod === PrismaPaymentMethod.WALLET ? PaymentStatus.PAID : PaymentStatus.PENDING;
        const created = await tx.order.create({
          data: {
            customerId: user.userId,
            storeId: store.id,
            serviceType: store.type,
            items: this.orderItemsSnapshot(quote.lines),
            timeline: [{ status: OrderStatus.PLACED, at: new Date().toISOString() }],
            address: this.checkoutAddressSnapshot(body.address, quote.distanceKm, store.type === ServiceType.PHARMACY ? quote.cart.prescription : undefined),
            paymentMethod,
            paymentStatus,
            subtotal: quote.subtotal,
            deliveryFee: quote.deliveryFee,
            discount: quote.discount,
            taxes: quote.taxes,
            total: quote.total,
            couponCode: quote.coupon?.code,
            prepTimeMinutes: store.etaMinutes,
            pickupOtpHash: this.hashOtp(pickupOtp),
            deliveryOtpHash: this.hashOtp(deliveryOtp),
            storeLocation: {
              storeId: store.id,
              name: store.name,
              lat: store.lat.toString(),
              lng: store.lng.toString(),
            },
          },
          include: { store: true },
        });

        await this.marketplaceService.decrementStock(
          quote.lines.map((line) => ({ menuItemId: line.menuItemId, quantity: line.quantity })),
          tx,
        );

        if (quote.coupon) {
          await this.incrementCouponUsage(tx, quote.coupon.id);
        }

        if (paymentMethod === PrismaPaymentMethod.WALLET) {
          await this.writeWalletLedger(tx, {
            orderId: created.id,
            customerId: user.userId,
            customerRole: UserRole.CUSTOMER,
            storeOwnerId: store.ownerId,
            storeOwnerRole: store.owner.role,
            amount: quote.total,
          });
        }

        await this.outboxService.orderCreated(tx, {
          orderId: created.id,
          customerId: user.userId,
          partnerId: store.ownerId,
          storeId: store.id,
          topic: `order:${created.id}`,
          title: "Order placed",
          body: `${store.name} received a new order.`,
          total: quote.total.toString(),
        });

        return created;
      });

      const response: CheckoutResponse = {
        order: this.serializeOrder(order),
        paymentRequired: order.paymentMethod === PrismaPaymentMethod.ONLINE,
      };
      await this.redisStore.setJson(cacheKey, response, CHECKOUT_IDEMPOTENCY_TTL_MS);
      await this.redisStore.delete(this.cartKey(user.userId));
      return response;
    } finally {
      await this.redisStore.delete(lockKey);
    }
  }

  async listOrders(user: AuthenticatedUser, query: OrdersQueryDto) {
    this.assertCustomer(user);
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 50);
    const orders = await this.prisma.order.findMany({
      where: { customerId: user.userId },
      include: { store: true },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const page = orders.slice(0, limit);

    return {
      items: page.map((order) => this.serializeOrder(order)),
      nextCursor: orders.length > limit ? page.at(-1)?.id : undefined,
    };
  }

  async getOrder(user: AuthenticatedUser, orderId: string) {
    this.assertCustomer(user);
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, customerId: user.userId },
      include: { store: true },
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    return this.serializeOrder(order);
  }


  async listStoreQueue(user: AuthenticatedUser) {
    this.assertRestaurant(user);
    const store = await this.findOwnedStore(user.userId);
    const orders = await this.prisma.order.findMany({
      where: { storeId: store.id, status: { in: [OrderStatus.PLACED, OrderStatus.ACCEPTED, OrderStatus.PREPARING, OrderStatus.READY] } },
      include: { store: true, deliveryPartner: { select: { id: true, name: true, phoneE164: true } } },
      orderBy: { createdAt: "asc" },
    });

    return { items: orders.map((order) => this.serializeOrder(order)) };
  }


  async verifyPrescription(user: AuthenticatedUser, orderId: string, body: PrescriptionVerificationDto) {
    this.assertRestaurant(user);
    const store = await this.findOwnedStore(user.userId);
    const order = await this.prisma.order.findFirst({ where: { id: orderId, storeId: store.id }, include: { store: true, deliveryPartner: { select: { id: true, name: true, phoneE164: true } } } });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    if (order.serviceType !== ServiceType.PHARMACY) {
      throw new BadRequestException("Prescription verification applies only to pharmacy orders");
    }

    const prescription = this.prescriptionFromOrder(order.address);
    if (!prescription || prescription.files.length === 0) {
      throw new BadRequestException("Prescription is missing");
    }

    const updatedPrescription: PrescriptionAttachment = {
      ...prescription,
      status: body.status,
      verifiedBy: user.userId,
      verifiedAt: new Date().toISOString(),
      verificationNote: body.note ?? null,
    };
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { address: this.addressWithPrescription(order.address, updatedPrescription) },
      include: { store: true, deliveryPartner: { select: { id: true, name: true, phoneE164: true } } },
    });
    await this.publishOrderRealtime(updated, "order.prescription.reviewed");
    return this.serializeOrder(updated);
  }

  async proposeSubstitutions(user: AuthenticatedUser, orderId: string, body: SubstitutionProposalDto) {
    this.assertRestaurant(user);
    const store = await this.findOwnedStore(user.userId);
    const order = await this.prisma.order.findFirst({ where: { id: orderId, storeId: store.id }, include: { store: true, deliveryPartner: { select: { id: true, name: true, phoneE164: true } } } });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    if (![ServiceType.GROCERY, ServiceType.PHARMACY].includes(order.serviceType)) {
      throw new BadRequestException("Substitutions apply only to grocery and pharmacy orders");
    }

    if ([OrderStatus.PICKED_UP, OrderStatus.DELIVERED, OrderStatus.CANCELLED].includes(order.status)) {
      throw new BadRequestException("Substitutions cannot be changed after pickup");
    }

    const proposedItems = this.applySubstitutionProposals(order.items, body, user.userId);
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { items: proposedItems },
      include: { store: true, deliveryPartner: { select: { id: true, name: true, phoneE164: true } } },
    });
    await this.publishOrderRealtime(updated, "order.substitutions.proposed");
    return this.serializeOrder(updated);
  }

  async decideSubstitutions(user: AuthenticatedUser, orderId: string, body: SubstitutionDecisionDto) {
    this.assertCustomer(user);
    const order = await this.prisma.order.findFirst({ where: { id: orderId, customerId: user.userId }, include: { store: true, deliveryPartner: { select: { id: true, name: true, phoneE164: true } } } });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    if (![ServiceType.GROCERY, ServiceType.PHARMACY].includes(order.serviceType)) {
      throw new BadRequestException("Substitutions apply only to grocery and pharmacy orders");
    }

    if ([OrderStatus.PICKED_UP, OrderStatus.DELIVERED, OrderStatus.CANCELLED].includes(order.status)) {
      throw new BadRequestException("Substitutions cannot be changed after pickup");
    }

    const decidedItems = this.applySubstitutionDecisions(order.items, body, user.userId);
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { items: decidedItems },
      include: { store: true, deliveryPartner: { select: { id: true, name: true, phoneE164: true } } },
    });
    await this.publishOrderRealtime(updated, "order.substitutions.reviewed");
    return this.serializeOrder(updated);
  }
  acceptStoreOrder(user: AuthenticatedUser, orderId: string, body: PrepTimeDto) {
    return this.transitionStoreOrder(user, orderId, OrderStatus.ACCEPTED, body);
  }

  prepareStoreOrder(user: AuthenticatedUser, orderId: string, body: PrepTimeDto) {
    return this.transitionStoreOrder(user, orderId, OrderStatus.PREPARING, body);
  }

  readyStoreOrder(user: AuthenticatedUser, orderId: string, body: PrepTimeDto) {
    return this.transitionStoreOrder(user, orderId, OrderStatus.READY, body);
  }

  async listDeliveryQueue(user: AuthenticatedUser) {
    this.assertDelivery(user);
    await this.assertApprovedPartnerUser(user.userId);
    const heartbeat = await this.redisStore.getJson<{ lat?: number; lng?: number }>(`heartbeat:partner:${user.userId}`);
    const partnerLat = heartbeat?.lat;
    const partnerLng = heartbeat?.lng;

    if (typeof partnerLat !== "number" || typeof partnerLng !== "number") {
      throw new BadRequestException("Write live location before requesting the delivery queue");
    }

    const orders = await this.prisma.order.findMany({
      where: {
        OR: [
          { status: OrderStatus.READY, deliveryPartnerId: null },
          { status: { in: [OrderStatus.READY, OrderStatus.PICKED_UP] }, deliveryPartnerId: user.userId },
        ],
      },
      include: { store: true },
      orderBy: { createdAt: "asc" },
      take: 100,
    });

    return {
      items: orders
        .map((order) => ({ order, distanceKm: this.distanceFromOrder(order, partnerLat, partnerLng) }))
        .filter(({ order, distanceKm }) => order.deliveryPartnerId === user.userId || distanceKm <= Number(process.env.DELIVERY_QUEUE_RADIUS_KM ?? 8))
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .slice(0, 25)
        .map(({ order, distanceKm }) => ({ ...this.serializeOrder(order), distanceKm: Number(distanceKm.toFixed(2)) })),
    };
  }

  async acceptDeliveryOrder(user: AuthenticatedUser, orderId: string) {
    this.assertDelivery(user);
    await this.assertApprovedPartnerUser(user.userId);

    const result = await this.prisma.order.updateMany({
      where: { id: orderId, status: OrderStatus.READY, deliveryPartnerId: null },
      data: { deliveryPartnerId: user.userId },
    });

    if (result.count !== 1) {
      throw new BadRequestException("Order is no longer available");
    }

    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { store: true, deliveryPartner: { select: { id: true, name: true, phoneE164: true } } } });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    await this.publishOrderRealtime(order, "order.partner.assigned");
    return this.serializeOrder(order);
  }

  async pickupOrder(user: AuthenticatedUser, orderId: string, body: OtpStatusDto) {
    this.assertDelivery(user);
    return this.transitionDeliveryOrder(user, orderId, OrderStatus.PICKED_UP, body.otp);
  }

  async deliverOrder(user: AuthenticatedUser, orderId: string, body: OtpStatusDto) {
    this.assertDelivery(user);
    return this.transitionDeliveryOrder(user, orderId, OrderStatus.DELIVERED, body.otp);
  }

  async cancelOrder(user: AuthenticatedUser, orderId: string, body: CancelOrderDto) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { store: true, deliveryPartner: true } });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    const isCustomer = order.customerId === user.userId;
    const isStore = order.store.ownerId === user.userId;
    const isDelivery = order.deliveryPartnerId === user.userId;
    const isStaff = [UserRole.SUPPORT, UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(user.role as UserRole);

    if (!isCustomer && !isStore && !isDelivery && !isStaff) {
      throw new ForbiddenException("Order cancellation is not allowed");
    }

    this.assertTransitionAllowed(order.status, OrderStatus.CANCELLED);

    const updated = await this.prisma.$transaction(async (tx) => {
      const latest = await tx.order.findUnique({ where: { id: orderId }, include: { store: true, deliveryPartner: true } });

      if (!latest) {
        throw new NotFoundException("Order not found");
      }

      this.assertTransitionAllowed(latest.status, OrderStatus.CANCELLED);
      await this.restoreOrderStock(tx, latest);
      await this.refundOrderIfNeeded(tx, latest, body.reason ?? "Order cancelled");
      const cancelled = await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
          paymentStatus: latest.paymentStatus === PaymentStatus.PAID ? PaymentStatus.REFUNDED : PaymentStatus.CANCELLED,
          timeline: this.appendTimeline(latest.timeline, OrderStatus.CANCELLED, body.reason),
        },
        include: { store: true, deliveryPartner: { select: { id: true, name: true, phoneE164: true } } },
      });
      await this.outboxService.orderStatusChanged(tx, { orderId, customerId: cancelled.customerId, partnerId: cancelled.deliveryPartnerId ?? cancelled.store.ownerId, status: cancelled.status, topic: `order:${orderId}` });
      return cancelled;
    });

    await this.publishOrderRealtime(updated, "order.status.changed");
    return this.serializeOrder(updated);
  }

  async rateOrder(user: AuthenticatedUser, orderId: string, body: RatingDto) {
    this.assertCustomer(user);

    const updated = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({ where: { id: orderId, customerId: user.userId }, include: { store: true, deliveryPartner: true } });

      if (!order) {
        throw new NotFoundException("Order not found");
      }

      if (order.status !== OrderStatus.DELIVERED) {
        throw new BadRequestException("Only delivered orders can be rated");
      }

      if (order.rated) {
        return order;
      }

      await this.applyStoreRating(tx, order.storeId, body.rating);
      if (order.deliveryPartnerId) {
        await this.applyPartnerRating(tx, order.deliveryPartnerId, body.rating);
      }

      return tx.order.update({ where: { id: order.id }, data: { rated: true }, include: { store: true, deliveryPartner: true } });
    });

    await this.publishOrderRealtime(updated, "order.rated");
    return this.serializeOrder(updated);
  }

  async autoCancelStaleOrders() {
    const staleBefore = new Date(Date.now() - Number(process.env.ORDER_STALE_UNPAID_MS ?? 15 * 60 * 1000));
    const staleOrders = await this.prisma.order.findMany({
      where: { status: OrderStatus.PLACED, paymentStatus: PaymentStatus.PENDING, createdAt: { lt: staleBefore } },
      include: { store: true, deliveryPartner: true },
      take: 50,
    });

    for (const order of staleOrders) {
      await this.cancelStaleOrder(order.id);
    }

    return { cancelled: staleOrders.length };
  }

  private async transitionStoreOrder(user: AuthenticatedUser, orderId: string, target: OrderStatus, body: PrepTimeDto) {
    this.assertRestaurant(user);
    const store = await this.findOwnedStore(user.userId);
    const order = await this.prisma.order.findFirst({ where: { id: orderId, storeId: store.id }, include: { store: true, deliveryPartner: { select: { id: true, name: true, phoneE164: true } } } });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    this.assertTransitionAllowed(order.status, target);

    const updated = await this.prisma.$transaction(async (tx) => {
      const latest = await tx.order.findFirst({ where: { id: orderId, storeId: store.id }, include: { store: true, deliveryPartner: { select: { id: true, name: true, phoneE164: true } } } });

      if (!latest) {
        throw new NotFoundException("Order not found");
      }

      this.assertTransitionAllowed(latest.status, target);
      if (target === OrderStatus.ACCEPTED) {
        this.assertPrescriptionVerifiedForAcceptance(latest);
      }
      if (target === OrderStatus.READY) {
        this.assertNoPendingSubstitutions(latest.items);
      }
      const next = await tx.order.update({
        where: { id: orderId },
        data: { status: target, prepTimeMinutes: body.prepTimeMinutes ?? latest.prepTimeMinutes, timeline: this.appendTimeline(latest.timeline, target) },
        include: { store: true, deliveryPartner: { select: { id: true, name: true, phoneE164: true } } },
      });
      await this.outboxService.orderStatusChanged(tx, { orderId, customerId: next.customerId, partnerId: next.deliveryPartnerId ?? store.ownerId, status: next.status, topic: `order:${orderId}` });
      return next;
    });

    await this.publishOrderRealtime(updated, "order.status.changed");
    return this.serializeOrder(updated);
  }

  private async transitionDeliveryOrder(user: AuthenticatedUser, orderId: string, target: OrderStatus, otp: string) {
    await this.assertApprovedPartnerUser(user.userId);
    const updated = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({ where: { id: orderId, deliveryPartnerId: user.userId }, include: { store: true, deliveryPartner: { select: { id: true, name: true, phoneE164: true } } } });

      if (!order) {
        throw new NotFoundException("Order not found");
      }

      this.assertTransitionAllowed(order.status, target);
      if (target === OrderStatus.PICKED_UP) {
        this.assertNoPendingSubstitutions(order.items);
      }
      this.verifyOrderOtp(order, target, otp);
      const next = await tx.order.update({
        where: { id: orderId },
        data: { status: target, timeline: this.appendTimeline(order.timeline, target) },
        include: { store: true, deliveryPartner: { select: { id: true, name: true, phoneE164: true } } },
      });
      if (target === OrderStatus.DELIVERED) {
        await this.writeOrderRetentionLedger(tx, next);
        await this.creditReferralReferrer(tx, next.customerId, "order", next.id);
      }
      await this.outboxService.orderStatusChanged(tx, { orderId, customerId: next.customerId, partnerId: user.userId, status: next.status, topic: `order:${orderId}` });
      return next;
    });

    await this.publishOrderRealtime(updated, "order.status.changed");
    return this.serializeOrder(updated);
  }

  private async cancelStaleOrder(orderId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { store: true, deliveryPartner: true } });

      if (!order || order.status !== OrderStatus.PLACED || order.paymentStatus !== PaymentStatus.PENDING) {
        return;
      }

      await this.restoreOrderStock(tx, order);
      const cancelled = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CANCELLED, paymentStatus: PaymentStatus.CANCELLED, timeline: this.appendTimeline(order.timeline, OrderStatus.CANCELLED, "Auto-cancelled stale unpaid order") },
        include: { store: true, deliveryPartner: true },
      });
      await this.outboxService.orderStatusChanged(tx, { orderId, customerId: cancelled.customerId, partnerId: cancelled.store.ownerId, status: cancelled.status, topic: `order:${orderId}` });
    });
  }
  private async buildCartQuote(tx: PrismaTx | PrismaService, userId: string, cart: StoredCart): Promise<CartQuote> {
    const menuItems = await tx.menuItem.findMany({
      where: { id: { in: cart.items.map((item) => item.menuItemId) } },
      include: { store: { include: { owner: { select: { id: true, role: true } } } } },
    });
    const byId = new Map(menuItems.map((item) => [item.id, item]));
    const firstStore = menuItems[0]?.store;
    const lines = cart.items.map((item) => {
      const menuItem = byId.get(item.menuItemId);
      const available = Boolean(menuItem?.available && menuItem.store.approval === PartnerApproval.APPROVED);
      const price = menuItem?.price ?? ZERO;

      return {
        ...item,
        name: menuItem?.name ?? "Unavailable item",
        description: menuItem?.description ?? "This item is no longer available.",
        imageUrl: menuItem?.imageUrl,
        section: menuItem?.section ?? "Unavailable",
        price,
        lineTotal: available ? price.mul(item.quantity).toDecimalPlaces(2) : ZERO,
        available,
        stock: menuItem?.stock ?? 0,
      };
    });
    const subtotal = lines.reduce((sum, line) => sum.plus(line.lineTotal), ZERO).toDecimalPlaces(2);
    const serviceType = firstStore ? (firstStore.type as unknown as ServiceType) : undefined;
    const couponResult = await this.calculateCoupon(tx, userId, cart.couponCode, subtotal, serviceType);
    const taxes = subtotal.minus(couponResult.discount).mul(TAX_RATE).toDecimalPlaces(2);
    const total = subtotal.minus(couponResult.discount).plus(taxes).toDecimalPlaces(2);

    return {
      cart,
      store: firstStore ? { ...firstStore, type: firstStore.type as unknown as ServiceType } : undefined,
      lines,
      subtotal,
      deliveryFee: ZERO,
      discount: couponResult.discount,
      taxes,
      total,
      coupon: couponResult.coupon,
      couponError: couponResult.error,
      minimumRemaining: firstStore ? (firstStore.minOrder.greaterThan(subtotal) ? firstStore.minOrder.minus(subtotal) : ZERO) : undefined,
    };
  }

  private async buildCheckoutQuote(
    tx: PrismaTx,
    userId: string,
    cart: StoredCart,
    address: CheckoutAddressDto,
    paymentMethod: SharedPaymentMethod,
  ): Promise<CartQuote> {
    const quote = await this.buildCartQuote(tx, userId, cart);
    const store = quote.store;

    if (!store) {
      throw new BadRequestException("Cart store is unavailable");
    }

    if (quote.lines.some((line) => !line.available)) {
      throw new BadRequestException("Cart contains unavailable items");
    }

    if (store.approval !== PartnerApproval.APPROVED || !store.isOpen) {
      throw new BadRequestException("Store is not accepting orders");
    }

    if (!this.isWithinOpeningHours(store.openingHours)) {
      throw new BadRequestException("Store is outside opening hours");
    }

    const distanceKm = haversineKm(address.lat, address.lng, Number(store.lat), Number(store.lng));

    if (distanceKm > Number(store.deliveryRadiusKm)) {
      throw new BadRequestException("Address is outside delivery radius");
    }

    if (quote.subtotal.lessThan(store.minOrder)) {
      throw new BadRequestException("Minimum order value is not met");
    }

    for (const line of quote.lines) {
      if (line.stock !== -1 && line.quantity > line.stock) {
        throw new BadRequestException(`Insufficient stock for ${line.name}`);
      }
    }

    if (quote.couponError) {
      throw new BadRequestException(quote.couponError);
    }

    if (store.type === ServiceType.PHARMACY && (!cart.prescription || cart.prescription.files.length === 0)) {
      throw new BadRequestException("Upload a prescription before checking out from a pharmacy");
    }

    const deliveryFee = BASE_DELIVERY_FEE.plus(new Prisma.Decimal(distanceKm).mul(DELIVERY_FEE_PER_KM)).toDecimalPlaces(2);
    const taxable = quote.subtotal.minus(quote.discount).plus(deliveryFee);
    const taxes = taxable.mul(TAX_RATE).toDecimalPlaces(2);
    const total = taxable.plus(taxes).toDecimalPlaces(2);

    if ((paymentMethod as PrismaPaymentMethod) === PrismaPaymentMethod.WALLET) {
      const walletBalance = await this.computeWalletBalance(tx, userId);

      if (walletBalance.lessThan(total)) {
        throw new BadRequestException("Wallet balance is insufficient");
      }
    }

    return { ...quote, deliveryFee, taxes, total, distanceKm };
  }

  private async calculateCoupon(
    tx: PrismaTx | PrismaService,
    userId: string,
    rawCode: string | undefined,
    subtotal: Prisma.Decimal,
    serviceType?: ServiceType,
  ): Promise<{ discount: Prisma.Decimal; coupon?: { id: string; code: string; title?: string; campaignName?: string | null; campaignTag?: string | null; serviceType?: ServiceType | null }; error?: string }> {
    if (!rawCode) {
      return { discount: ZERO };
    }

    const code = rawCode.trim().toUpperCase();
    const coupon = await tx.coupon.findUnique({ where: { code } });

    if (!coupon || !coupon.isActive) {
      return { discount: ZERO, error: "Coupon is invalid" };
    }

    const now = new Date();

    if (coupon.startsAt && coupon.startsAt > now) {
      return { discount: ZERO, error: "Coupon is not active yet" };
    }

    if (coupon.expiresAt && coupon.expiresAt < now) {
      return { discount: ZERO, error: "Coupon has expired" };
    }

    if (coupon.serviceType && serviceType && coupon.serviceType !== serviceType) {
      return { discount: ZERO, error: "Coupon is not valid for this vertical" };
    }

    if (coupon.firstOrderOnly) {
      const completedOrders = await tx.order.count({ where: { customerId: userId, status: { not: OrderStatus.CANCELLED } } });
      const completedRides = await tx.ride.count({ where: { customerId: userId, status: { not: RideStatus.CANCELLED } } });
      if (completedOrders + completedRides > 0) {
        return { discount: ZERO, error: "Coupon is valid only on your first booking" };
      }
    }

    if (coupon.minOrderValue && subtotal.lessThan(coupon.minOrderValue)) {
      return { discount: ZERO, error: `Add Rs ${coupon.minOrderValue.minus(subtotal).toDecimalPlaces(2).toString()} more to use this coupon` };
    }

    if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
      return { discount: ZERO, error: "Coupon usage limit reached" };
    }

    if (coupon.perUserLimit !== null) {
      const userUses = await tx.order.count({ where: { customerId: userId, couponCode: coupon.code } });

      if (userUses >= coupon.perUserLimit) {
        return { discount: ZERO, error: "Coupon usage limit reached for this account" };
      }
    }

    const rawDiscount = coupon.discountType === CouponDiscountType.PERCENTAGE ? subtotal.mul(coupon.discountValue).div(100) : coupon.discountValue;
    const cappedDiscount = coupon.maxDiscount && rawDiscount.greaterThan(coupon.maxDiscount) ? coupon.maxDiscount : rawDiscount;
    const discount = cappedDiscount.greaterThan(subtotal) ? subtotal : cappedDiscount;
    return { discount: discount.toDecimalPlaces(2), coupon: { id: coupon.id, code: coupon.code, title: coupon.title, campaignName: coupon.campaignName, campaignTag: coupon.campaignTag, serviceType: coupon.serviceType } };
  }

  private async incrementCouponUsage(tx: PrismaTx, couponId: string): Promise<void> {
    const coupon = await tx.coupon.findUnique({ where: { id: couponId }, select: { usageLimit: true } });

    if (!coupon) {
      throw new BadRequestException("Coupon is invalid");
    }

    const result = await tx.coupon.updateMany({
      where: {
        id: couponId,
        ...(coupon.usageLimit !== null ? { usageCount: { lt: coupon.usageLimit } } : {}),
      },
      data: { usageCount: { increment: 1 } },
    });

    if (result.count !== 1) {
      throw new BadRequestException("Coupon usage limit reached");
    }
  }

  private async writeOrderRetentionLedger(tx: PrismaTx, order: { id: string; customerId: string; total: Prisma.Decimal }): Promise<void> {
    const points = order.total.mul(ORDER_LOYALTY_POINTS_PER_RUPEE).toDecimalPlaces(0);
    if (points.lessThanOrEqualTo(0)) {
      return;
    }

    const existing = await tx.ledgerEntry.findFirst({ where: { paymentId: `loyalty:order:${order.id}` } });
    if (existing) {
      return;
    }

    await tx.ledgerEntry.create({
      data: {
        userId: order.customerId,
        userRole: UserRole.CUSTOMER,
        type: LedgerEntryType.LOYALTY,
        amount: points,
        description: `Loyalty points for order ${order.id}`,
        orderId: order.id,
        paymentId: `loyalty:order:${order.id}`,
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
  private async writeWalletLedger(
    tx: PrismaTx,
    input: {
      orderId: string;
      customerId: string;
      customerRole: UserRole;
      storeOwnerId: string;
      storeOwnerRole: UserRole;
      amount: Prisma.Decimal;
    },
  ): Promise<void> {
    await tx.ledgerEntry.create({
      data: {
        userId: input.customerId,
        userRole: input.customerRole,
        type: LedgerEntryType.DEBIT,
        amount: input.amount,
        description: "Order paid from wallet",
        paymentMethod: PrismaPaymentMethod.WALLET,
        orderId: input.orderId,
      },
    });
    await tx.ledgerEntry.create({
      data: {
        userId: input.storeOwnerId,
        userRole: input.storeOwnerRole,
        type: LedgerEntryType.CREDIT,
        amount: input.amount,
        description: "Order wallet payment received",
        paymentMethod: PrismaPaymentMethod.WALLET,
        orderId: input.orderId,
      },
    });
    await this.reconcileWalletBalance(tx, input.customerId);
    await this.reconcileWalletBalance(tx, input.storeOwnerId);
  }

  private async reconcileWalletBalance(tx: PrismaTx, userId: string): Promise<Prisma.Decimal> {
    const balance = await this.computeWalletBalance(tx, userId);
    await tx.user.update({ where: { id: userId }, data: { walletBalanceCached: balance } });
    return balance;
  }

  private async computeWalletBalance(tx: PrismaTx, userId: string): Promise<Prisma.Decimal> {
    const entries = await tx.ledgerEntry.findMany({ where: { userId }, select: { type: true, amount: true } });
    return entries.reduce((balance, entry) => {
      if ([LedgerEntryType.CREDIT, LedgerEntryType.REFUND, LedgerEntryType.ADJUSTMENT, LedgerEntryType.PROMOTION].includes(entry.type)) {
        return balance.plus(entry.amount);
      }

      if (entry.type === LedgerEntryType.LOYALTY) {
        return balance;
      }
      return balance.minus(entry.amount);
    }, ZERO);
  }

  private orderItemsSnapshot(lines: CartLine[]): Prisma.InputJsonValue {
    return lines.map((line) => ({
      menuItemId: line.menuItemId,
      name: line.name,
      section: line.section,
      quantity: line.quantity,
      unitPrice: line.price.toString(),
      lineTotal: line.lineTotal.toString(),
      customizations: line.customizations ?? {},
      note: line.note ?? null,
      substitutionPreference: line.substitutionPreference ?? null,
    })) as Prisma.InputJsonValue;
  }

  private checkoutAddressSnapshot(address: CheckoutAddressDto, distanceKm?: number, prescription?: PrescriptionAttachment): Prisma.InputJsonValue {
    return {
      address: address.address,
      line: address.line ?? null,
      city: address.city ?? null,
      state: address.state ?? null,
      pincode: address.pincode ?? null,
      placeId: address.placeId ?? null,
      lat: address.lat,
      lng: address.lng,
      source: address.source,
      distanceKm: distanceKm !== undefined ? Number(distanceKm.toFixed(2)) : null,
      prescription: prescription ?? null,
    };
  }

  private serializeCartQuote(quote: CartQuote) {
    return {
      store: quote.store
        ? {
            id: quote.store.id,
            name: quote.store.name,
            etaMinutes: quote.store.etaMinutes,
            minOrder: quote.store.minOrder.toString(),
            isOpen: quote.store.isOpen,
            type: quote.store.type,
          }
        : null,
      items: quote.lines.map((line) => ({
        menuItemId: line.menuItemId,
        name: line.name,
        description: line.description,
        imageUrl: line.imageUrl,
        section: line.section,
        quantity: line.quantity,
        price: line.price.toString(),
        lineTotal: line.lineTotal.toString(),
        available: line.available,
        stock: line.stock,
        customizations: line.customizations ?? {},
        note: line.note ?? null,
        substitutionPreference: line.substitutionPreference ?? null,
      })),
      couponCode: quote.cart.couponCode ?? null,
      coupon: quote.coupon ?? null,
      couponError: quote.couponError ?? null,
      prescription: quote.cart.prescription ?? null,
      pricing: {
        subtotal: quote.subtotal.toString(),
        deliveryFee: quote.deliveryFee.toString(),
        discount: quote.discount.toString(),
        taxes: quote.taxes.toString(),
        total: quote.total.toString(),
        minimumRemaining: quote.minimumRemaining?.toString() ?? "0",
      },
      updatedAt: quote.cart.updatedAt,
    };
  }

  private serializeOrder(order: {
    id: string;
    customerId: string;
    storeId: string;
    deliveryPartnerId?: string | null;
    serviceType: ServiceType;
    items: Prisma.JsonValue;
    status: OrderStatus;
    timeline: Prisma.JsonValue;
    address: Prisma.JsonValue;
    paymentMethod: PrismaPaymentMethod;
    paymentStatus: PaymentStatus;
    subtotal: Prisma.Decimal;
    deliveryFee: Prisma.Decimal;
    discount: Prisma.Decimal;
    taxes: Prisma.Decimal;
    total: Prisma.Decimal;
    couponCode: string | null;
    prepTimeMinutes: number | null;
    storeLocation: Prisma.JsonValue;
    rated: boolean;
    createdAt: Date;
    updatedAt: Date;
    store?: { id: string; name: string; imageUrl: string | null };
  }) {
    return {
      id: order.id,
      customerId: order.customerId,
      storeId: order.storeId,
      deliveryPartnerId: order.deliveryPartnerId ?? null,
      store: order.store ? { id: order.store.id, name: order.store.name, imageUrl: order.store.imageUrl } : undefined,
      serviceType: order.serviceType,
      items: order.items,
      status: order.status,
      timeline: order.timeline,
      address: order.address,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      subtotal: order.subtotal.toString(),
      deliveryFee: order.deliveryFee.toString(),
      discount: order.discount.toString(),
      taxes: order.taxes.toString(),
      total: order.total.toString(),
      couponCode: order.couponCode,
      prepTimeMinutes: order.prepTimeMinutes,
      storeLocation: order.storeLocation,
      rated: order.rated,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    };
  }



  private prescriptionFromOrder(address: Prisma.JsonValue): PrescriptionAttachment | null {
    const record = this.jsonRecord(address);
    const prescription = record.prescription;
    if (!prescription || typeof prescription !== "object" || Array.isArray(prescription)) {
      return null;
    }
    const candidate = prescription as PrescriptionAttachment;
    return Array.isArray(candidate.files) ? candidate : null;
  }

  private addressWithPrescription(address: Prisma.JsonValue, prescription: PrescriptionAttachment): Prisma.InputJsonValue {
    return { ...this.jsonRecord(address), prescription } as Prisma.InputJsonValue;
  }

  private assertPrescriptionVerifiedForAcceptance(order: { serviceType: ServiceType; address: Prisma.JsonValue }): void {
    if (order.serviceType !== ServiceType.PHARMACY) {
      return;
    }

    const prescription = this.prescriptionFromOrder(order.address);
    if (!prescription || prescription.files.length === 0) {
      throw new BadRequestException("Prescription must be uploaded before accepting a pharmacy order");
    }
    if (prescription.status !== "VERIFIED") {
      throw new BadRequestException("Prescription must be verified by the pharmacist before accepting this order");
    }
  }

  private applySubstitutionProposals(items: Prisma.JsonValue, body: SubstitutionProposalDto, actorId: string): Prisma.InputJsonValue {
    const records = this.orderItemRecords(items);
    const byMenuItem = new Map(body.items.map((item) => [item.menuItemId, item]));
    const next = records.map((item) => {
      const proposal = typeof item.menuItemId === "string" ? byMenuItem.get(item.menuItemId) : undefined;
      if (!proposal) {
        return item;
      }
      return {
        ...item,
        substitution: {
          status: "PROPOSED",
          replacementMenuItemId: proposal.replacementMenuItemId ?? null,
          replacementName: proposal.replacementName,
          quantity: proposal.quantity,
          priceDelta: proposal.priceDelta ?? 0,
          reason: proposal.reason ?? null,
          proposedBy: actorId,
          proposedAt: new Date().toISOString(),
          decidedBy: null,
          decidedAt: null,
        },
      };
    });

    const found = new Set(records.map((item) => item.menuItemId).filter((id): id is string => typeof id === "string"));
    const missing = body.items.find((item) => !found.has(item.menuItemId));
    if (missing) {
      throw new BadRequestException(`Order item ${missing.menuItemId} is not part of this order`);
    }
    return next as Prisma.InputJsonValue;
  }

  private applySubstitutionDecisions(items: Prisma.JsonValue, body: SubstitutionDecisionDto, actorId: string): Prisma.InputJsonValue {
    const decisions = new Map(body.items.map((item) => [item.menuItemId, item.decision]));
    const records = this.orderItemRecords(items);
    const next = records.map((item) => {
      const decision = typeof item.menuItemId === "string" ? decisions.get(item.menuItemId) : undefined;
      if (!decision) {
        return item;
      }
      const substitution = this.jsonRecord(item.substitution as Prisma.JsonValue);
      if (substitution.status !== "PROPOSED") {
        throw new BadRequestException(`Order item ${item.menuItemId} does not have a pending substitution`);
      }
      return {
        ...item,
        substitution: {
          ...substitution,
          status: decision,
          decidedBy: actorId,
          decidedAt: new Date().toISOString(),
        },
      };
    });
    return next as Prisma.InputJsonValue;
  }

  private assertNoPendingSubstitutions(items: Prisma.JsonValue): void {
    const pending = this.orderItemRecords(items).some((item) => this.jsonRecord(item.substitution as Prisma.JsonValue).status === "PROPOSED");
    if (pending) {
      throw new BadRequestException("Customer must approve or reject proposed substitutions before this handoff");
    }
  }

  private orderItemRecords(items: Prisma.JsonValue): Array<Record<string, unknown>> {
    if (!Array.isArray(items)) {
      return [];
    }
    return items.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item))) as Array<Record<string, unknown>>;
  }

  private jsonRecord(value: Prisma.JsonValue | unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }
  private async findOwnedStore(ownerId: string) {
    const store = await this.prisma.store.findFirst({ where: { ownerId } });

    if (!store) {
      throw new NotFoundException("Store not found");
    }

    return store;
  }

  private assertRestaurant(user: AuthenticatedUser): void {
    if (user.role !== UserRole.RESTAURANT) {
      throw new ForbiddenException("Only restaurant partners can manage store orders");
    }
  }

  private assertDelivery(user: AuthenticatedUser): void {
    if (user.role !== UserRole.DELIVERY) {
      throw new ForbiddenException("Only delivery partners can manage delivery jobs");
    }
  }

  private async assertApprovedPartnerUser(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { partnerApproval: true, isBanned: true, isOnline: true } });

    if (!user || user.isBanned || user.partnerApproval !== PartnerApproval.APPROVED || !user.isOnline) {
      throw new ForbiddenException("Approved online partner status is required");
    }
  }

  private assertTransitionAllowed(from: OrderStatus, to: OrderStatus): void {
    if (!canTransition(orderStatusTransitions, from as unknown as SharedOrderStatus, to as unknown as SharedOrderStatus)) {
      throw new BadRequestException(`Illegal order status transition: ${from} to ${to}`);
    }
  }

  private appendTimeline(timeline: Prisma.JsonValue, status: OrderStatus, note?: string): Prisma.InputJsonValue {
    const existing = Array.isArray(timeline) ? timeline : [];
    return [
      ...existing,
      {
        status,
        note: note ?? null,
        at: new Date().toISOString(),
      },
    ] as Prisma.InputJsonValue;
  }

  private async publishOrderRealtime(order: { id: string; status: OrderStatus; customerId: string; deliveryPartnerId?: string | null; storeId: string; prepTimeMinutes?: number | null }, type: string): Promise<void> {
    await this.realtimeProvider.publish(`order:${order.id}`, {
      id: `${type}:${order.id}:${Date.now()}`,
      type,
      payload: {
        orderId: order.id,
        status: order.status,
        customerId: order.customerId,
        deliveryPartnerId: order.deliveryPartnerId ?? null,
        storeId: order.storeId,
        prepTimeMinutes: order.prepTimeMinutes ?? null,
      },
    });
  }

  private verifyOrderOtp(order: { pickupOtpHash: string | null; deliveryOtpHash: string | null }, target: OrderStatus, otp: string): void {
    const expected = target === OrderStatus.PICKED_UP ? order.pickupOtpHash : target === OrderStatus.DELIVERED ? order.deliveryOtpHash : null;

    if (!expected) {
      throw new BadRequestException("OTP is not available for this handoff");
    }

    const actual = this.hashOtp(otp.trim());
    const expectedBuffer = Buffer.from(expected, "hex");
    const actualBuffer = Buffer.from(actual, "hex");

    if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
      throw new BadRequestException("Invalid OTP");
    }
  }

  private async restoreOrderStock(tx: PrismaTx, order: { status: OrderStatus; items: Prisma.JsonValue }): Promise<void> {
    if ([OrderStatus.CANCELLED, OrderStatus.PICKED_UP, OrderStatus.DELIVERED].includes(order.status)) {
      return;
    }

    const lines = this.stockLinesFromOrder(order.items);

    if (lines.length > 0) {
      await this.marketplaceService.restoreStock(lines, tx);
    }
  }

  private async refundOrderIfNeeded(
    tx: PrismaTx,
    order: { id: string; customerId: string; paymentStatus: PaymentStatus; paymentMethod: PrismaPaymentMethod; total: Prisma.Decimal; store: { ownerId: string; owner?: { role: UserRole } } },
    reason: string,
  ): Promise<void> {
    if (order.paymentStatus !== PaymentStatus.PAID) {
      return;
    }

    const customer = await tx.user.findUnique({ where: { id: order.customerId }, select: { role: true } });

    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    await tx.ledgerEntry.create({
      data: {
        userId: order.customerId,
        userRole: customer.role,
        type: LedgerEntryType.REFUND,
        amount: order.total,
        description: reason,
        paymentMethod: order.paymentMethod,
        orderId: order.id,
      },
    });

    if (order.paymentMethod === PrismaPaymentMethod.WALLET) {
      const owner = await tx.user.findUnique({ where: { id: order.store.ownerId }, select: { role: true } });
      if (owner) {
        await tx.ledgerEntry.create({
          data: {
            userId: order.store.ownerId,
            userRole: owner.role,
            type: LedgerEntryType.DEBIT,
            amount: order.total,
            description: `Refund debit for cancelled order ${order.id}`,
            paymentMethod: order.paymentMethod,
            orderId: order.id,
          },
        });
        await this.reconcileWalletBalance(tx, order.store.ownerId);
      }
    }

    await this.reconcileWalletBalance(tx, order.customerId);
  }

  private stockLinesFromOrder(items: Prisma.JsonValue): Array<{ menuItemId: string; quantity: number }> {
    if (!Array.isArray(items)) {
      return [];
    }

    return items
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }

        const record = item as { menuItemId?: unknown; quantity?: unknown };
        if (typeof record.menuItemId !== "string" || typeof record.quantity !== "number") {
          return null;
        }

        return { menuItemId: record.menuItemId, quantity: record.quantity };
      })
      .filter((line): line is { menuItemId: string; quantity: number } => line !== null);
  }

  private async applyStoreRating(tx: PrismaTx, storeId: string, rating: number): Promise<void> {
    const store = await tx.store.findUnique({ where: { id: storeId }, select: { ratingAverage: true, ratingCount: true } });

    if (!store) {
      throw new NotFoundException("Store not found");
    }

    const nextCount = store.ratingCount + 1;
    const nextAverage = store.ratingAverage.mul(store.ratingCount).plus(rating).div(nextCount).toDecimalPlaces(2);
    await tx.store.update({ where: { id: storeId }, data: { ratingAverage: nextAverage, ratingCount: nextCount } });
  }

  private async applyPartnerRating(tx: PrismaTx, partnerId: string, rating: number): Promise<void> {
    const key = `rating:partner:${partnerId}`;
    const existing = await tx.systemConfig.findUnique({ where: { key } });
    const value = existing && typeof existing.value === "object" && existing.value !== null && !Array.isArray(existing.value) ? (existing.value as { average?: unknown; count?: unknown }) : {};
    const count = typeof value.count === "number" ? value.count : 0;
    const average = new Prisma.Decimal(typeof value.average === "string" || typeof value.average === "number" ? value.average : 0);
    const nextCount = count + 1;
    const nextAverage = average.mul(count).plus(rating).div(nextCount).toDecimalPlaces(2).toString();

    await tx.systemConfig.upsert({
      where: { key },
      update: { value: { average: nextAverage, count: nextCount }, description: "Delivery partner rating aggregate" },
      create: { key, value: { average: nextAverage, count: nextCount }, description: "Delivery partner rating aggregate" },
    });
  }

  private distanceFromOrder(order: { address: Prisma.JsonValue; storeLocation: Prisma.JsonValue }, lat: number, lng: number): number {
    const point = this.pointFromJson(order.address) ?? this.pointFromJson(order.storeLocation);

    if (!point) {
      return Number.POSITIVE_INFINITY;
    }

    return haversineKm(lat, lng, point.lat, point.lng);
  }

  private pointFromJson(value: Prisma.JsonValue): { lat: number; lng: number } | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    const record = value as { lat?: unknown; lng?: unknown };
    const lat = typeof record.lat === "number" ? record.lat : typeof record.lat === "string" ? Number(record.lat) : NaN;
    const lng = typeof record.lng === "number" ? record.lng : typeof record.lng === "string" ? Number(record.lng) : NaN;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }

    return { lat, lng };
  }
  private emptyCartResponse() {
    const now = new Date().toISOString();
    return {
      store: null,
      items: [],
      couponCode: null,
      couponError: null,
      prescription: null,
      pricing: {
        subtotal: "0",
        deliveryFee: "0",
        discount: "0",
        taxes: "0",
        total: "0",
        minimumRemaining: "0",
      },
      updatedAt: now,
    };
  }

  private readCart(userId: string): Promise<StoredCart> {
    return this.redisStore.getJson<StoredCart>(this.cartKey(userId)).then((cart) => cart ?? { items: [], updatedAt: new Date().toISOString() });
  }

  private writeCart(userId: string, cart: StoredCart): Promise<void> {
    return this.redisStore.setJson(this.cartKey(userId), cart, CART_TTL_MS);
  }

  private cartKey(userId: string): string {
    return `cart:${userId}`;
  }

  private hashOtp(code: string): string {
    return createHash("sha256").update(`${OTP_HASH_SALT}:${code}`).digest("hex");
  }

  private assertCustomer(user: AuthenticatedUser): void {
    if (user.role !== UserRole.CUSTOMER) {
      throw new ForbiddenException("Only customers can use delivery ordering");
    }
  }

  private isWithinOpeningHours(openingHours: Prisma.JsonValue): boolean {
    if (!openingHours || typeof openingHours !== "object" || Array.isArray(openingHours)) {
      return true;
    }

    const record = openingHours as Record<string, unknown>;
    const weekly = typeof record.weekly === "object" && record.weekly !== null && !Array.isArray(record.weekly) ? (record.weekly as Record<string, unknown>) : record;
    const now = new Date();
    const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const dayKey = dayNames[now.getDay()] ?? "sunday";
    const slots = weekly[dayKey] ?? weekly[String(now.getDay())];

    if (!slots) {
      return true;
    }

    const normalizedSlots = Array.isArray(slots) ? slots : [slots];
    const minutesNow = now.getHours() * 60 + now.getMinutes();

    return normalizedSlots.some((slot) => {
      if (!slot || typeof slot !== "object") {
        return false;
      }

      const value = slot as { open?: unknown; close?: unknown; from?: unknown; to?: unknown };
      const open = typeof value.open === "string" ? value.open : typeof value.from === "string" ? value.from : undefined;
      const close = typeof value.close === "string" ? value.close : typeof value.to === "string" ? value.to : undefined;

      if (!open || !close) {
        return true;
      }

      const openMinutes = parseTimeToMinutes(open);
      const closeMinutes = parseTimeToMinutes(close);

      if (openMinutes === null || closeMinutes === null) {
        return true;
      }

      if (closeMinutes < openMinutes) {
        return minutesNow >= openMinutes || minutesNow <= closeMinutes;
      }

      return minutesNow >= openMinutes && minutesNow <= closeMinutes;
    });
  }
}

function parseTimeToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const hours = Number(match[1]!);
  const minutes = Number(match[2]!);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
}

function haversineKm(fromLat: number, fromLng: number, toLat: number, toLng: number): number {
  const radiusKm = 6371;
  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(fromLat)) * Math.cos(toRadians(toLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * radiusKm * Math.asin(Math.sqrt(a));
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}