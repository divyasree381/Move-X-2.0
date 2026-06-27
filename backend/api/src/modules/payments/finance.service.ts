import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { LedgerEntryType, PaymentMethod, PaymentStatus, Prisma, type UserRole } from "@prisma/client";

import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import type { PaymentReferenceType } from "./dto/payments.dto";

type PrismaTx = Prisma.TransactionClient | PrismaService;

export type PaymentReference = {
  referenceType: PaymentReferenceType;
  referenceId: string;
  customerId: string;
  customerRole: UserRole;
  payableAmount: Prisma.Decimal;
  paymentStatus: PaymentStatus;
  providerPaymentId?: string | null;
  creditUserId?: string | null;
  creditUserRole?: UserRole | null;
};

const ZERO_DECIMAL = new Prisma.Decimal(0);

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  derivePaymentReference(referenceType: PaymentReferenceType, referenceId: string): Promise<PaymentReference> {
    return this.derivePaymentReferenceInTx(this.prisma, referenceType, referenceId);
  }

  async derivePaymentReferenceInTx(
    tx: PrismaTx,
    referenceType: PaymentReferenceType,
    referenceId: string,
  ): Promise<PaymentReference> {
    if (referenceType === "ORDER") {
      const order = await tx.order.findUnique({
        where: { id: referenceId },
        include: { customer: true, store: { include: { owner: true } } },
      });

      if (!order) {
        throw new NotFoundException("Order not found");
      }

      return {
        referenceType,
        referenceId,
        customerId: order.customerId,
        customerRole: order.customer.role,
        payableAmount: order.total,
        paymentStatus: order.paymentStatus,
        providerPaymentId: order.razorpayPaymentId,
        creditUserId: order.store.ownerId,
        creditUserRole: order.store.owner.role,
      };
    }

    if (referenceType === "RIDE") {
      const ride = await tx.ride.findUnique({
        where: { id: referenceId },
        include: { customer: true, driver: true },
      });

      if (!ride) {
        throw new NotFoundException("Ride not found");
      }

      return {
        referenceType,
        referenceId,
        customerId: ride.customerId,
        customerRole: ride.customer.role,
        payableAmount: ride.finalFare ?? ride.estimatedFare,
        paymentStatus: ride.paymentStatus,
        creditUserId: ride.driverId,
        creditUserRole: ride.driver?.role,
      };
    }

    if (referenceType === "COURIER") {
      const booking = await tx.courierBooking.findUnique({
        where: { id: referenceId },
        include: { customer: true, deliveryPartner: true },
      });

      if (!booking) {
        throw new NotFoundException("Courier booking not found");
      }

      return {
        referenceType,
        referenceId,
        customerId: booking.customerId,
        customerRole: booking.customer.role,
        payableAmount: booking.finalFare ?? booking.estimatedFare,
        paymentStatus: booking.paymentStatus,
        creditUserId: booking.deliveryPartnerId,
        creditUserRole: booking.deliveryPartner?.role,
      };
    }

    if (referenceType === "HOME_SERVICE") {
      const booking = await tx.homeServiceBooking.findUnique({
        where: { id: referenceId },
        include: { customer: true, professional: true },
      });

      if (!booking) {
        throw new NotFoundException("Home service booking not found");
      }

      return {
        referenceType,
        referenceId,
        customerId: booking.customerId,
        customerRole: booking.customer.role,
        payableAmount: booking.finalFare ?? booking.estimatedFare,
        paymentStatus: booking.paymentStatus,
        creditUserId: booking.professionalId,
        creditUserRole: booking.professional?.role,
      };
    }

    const topup = await tx.systemConfig.findUnique({ where: { key: `wallet_topup:${referenceId}` } });

    if (!topup || typeof topup.value !== "object" || topup.value === null || Array.isArray(topup.value)) {
      throw new NotFoundException("Wallet top-up reference not found");
    }

    const value = topup.value as { userId?: unknown; amount?: unknown; paymentStatus?: unknown; providerPaymentId?: unknown };

    if (typeof value.userId !== "string" || (typeof value.amount !== "string" && typeof value.amount !== "number")) {
      throw new NotFoundException("Wallet top-up reference is invalid");
    }

    const user = await tx.user.findUnique({ where: { id: value.userId } });

    if (!user) {
      throw new NotFoundException("Wallet top-up user not found");
    }

    return {
      referenceType,
      referenceId,
      customerId: user.id,
      customerRole: user.role,
      payableAmount: new Prisma.Decimal(value.amount),
      paymentStatus: this.isPaymentStatus(value.paymentStatus) ? value.paymentStatus : PaymentStatus.PENDING,
      providerPaymentId: typeof value.providerPaymentId === "string" ? value.providerPaymentId : undefined,
      creditUserId: user.id,
      creditUserRole: user.role,
    };
  }

  async markPaymentCaptured(input: {
    referenceType: PaymentReferenceType;
    referenceId: string;
    providerOrderId?: string;
    providerPaymentId: string;
    amountPaise: number;
  }): Promise<{ duplicate: boolean; balance?: string }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.ledgerEntry.findFirst({ where: { paymentId: input.providerPaymentId } });

      if (existing) {
        return { duplicate: true };
      }

      const reference = await this.derivePaymentReferenceInTx(tx, input.referenceType, input.referenceId);
      const capturedAmount = this.paiseToDecimal(input.amountPaise);

      if (!capturedAmount.equals(reference.payableAmount)) {
        throw new BadRequestException("Captured amount does not match server-derived payable amount");
      }

      await this.updatePaymentStatus(tx, reference, PaymentStatus.PAID, input.providerOrderId, input.providerPaymentId);

      let balance: Prisma.Decimal | undefined;

      if (reference.referenceType === "WALLET_TOPUP") {
        await tx.ledgerEntry.create({
          data: {
            userId: reference.customerId,
            userRole: reference.customerRole,
            type: LedgerEntryType.CREDIT,
            amount: reference.payableAmount,
            description: "Wallet top-up captured",
            paymentMethod: PaymentMethod.ONLINE,
            paymentId: input.providerPaymentId,
          },
        });
        balance = await this.reconcileWalletBalanceInTx(tx, reference.customerId);
      } else if (reference.creditUserId && reference.creditUserRole) {
        await tx.ledgerEntry.create({
          data: {
            userId: reference.creditUserId,
            userRole: reference.creditUserRole,
            type: LedgerEntryType.CREDIT,
            amount: reference.payableAmount,
            description: `${reference.referenceType.toLowerCase()} payment captured`,
            paymentMethod: PaymentMethod.ONLINE,
            orderId: reference.referenceType === "ORDER" ? reference.referenceId : undefined,
            rideId: reference.referenceType === "RIDE" ? reference.referenceId : undefined,
            paymentId: input.providerPaymentId,
          },
        });
        await this.reconcileWalletBalanceInTx(tx, reference.creditUserId);
      }

      await tx.outboxEvent.create({
        data: {
          type: "payment.captured",
          payload: {
            referenceType: reference.referenceType,
            referenceId: reference.referenceId,
            paymentId: input.providerPaymentId,
            amount: reference.payableAmount.toString(),
          },
        },
      });

      return { duplicate: false, balance: balance?.toString() };
    });
  }

  async markPaymentFailed(input: {
    referenceType: PaymentReferenceType;
    referenceId: string;
    providerOrderId?: string;
    providerPaymentId?: string;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const reference = await this.derivePaymentReferenceInTx(tx, input.referenceType, input.referenceId);
      await this.updatePaymentStatus(tx, reference, PaymentStatus.FAILED, input.providerOrderId, input.providerPaymentId);
    });
  }

  async recordRefund(input: {
    referenceType: PaymentReferenceType;
    referenceId: string;
    paymentId: string;
    refundId: string;
    amountPaise: number;
    reason?: string;
  }): Promise<{ balance: string }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.ledgerEntry.findFirst({ where: { paymentId: input.refundId } });

      if (existing) {
        const balance = await this.computeWalletBalanceInTx(tx, existing.userId);
        return { balance: balance.toString() };
      }

      const reference = await this.derivePaymentReferenceInTx(tx, input.referenceType, input.referenceId);
      const refundAmount = this.paiseToDecimal(input.amountPaise);

      await this.updatePaymentStatus(tx, reference, PaymentStatus.REFUNDED, undefined, input.paymentId);
      await tx.ledgerEntry.create({
        data: {
          userId: reference.customerId,
          userRole: reference.customerRole,
          type: LedgerEntryType.REFUND,
          amount: refundAmount,
          description: input.reason ?? "Payment refunded",
          paymentMethod: PaymentMethod.ONLINE,
          orderId: reference.referenceType === "ORDER" ? reference.referenceId : undefined,
          rideId: reference.referenceType === "RIDE" ? reference.referenceId : undefined,
          paymentId: input.refundId,
        },
      });
      const balance = await this.reconcileWalletBalanceInTx(tx, reference.customerId);

      await tx.outboxEvent.create({
        data: {
          type: "refund.created",
          payload: {
            referenceType: reference.referenceType,
            referenceId: reference.referenceId,
            paymentId: input.paymentId,
            refundId: input.refundId,
            amount: refundAmount.toString(),
          },
        },
      });

      return { balance: balance.toString() };
    });
  }

  async reconcileWalletBalance(userId: string): Promise<Prisma.Decimal> {
    return this.prisma.$transaction((tx) => this.reconcileWalletBalanceInTx(tx, userId));
  }

  private async reconcileWalletBalanceInTx(tx: PrismaTx, userId: string): Promise<Prisma.Decimal> {
    const balance = await this.computeWalletBalanceInTx(tx, userId);
    await tx.user.update({ where: { id: userId }, data: { walletBalanceCached: balance } });
    return balance;
  }

  private async computeWalletBalanceInTx(tx: PrismaTx, userId: string): Promise<Prisma.Decimal> {
    const entries = await tx.ledgerEntry.findMany({ where: { userId }, select: { type: true, amount: true } });

    return entries.reduce((balance, entry) => {
      if ([LedgerEntryType.CREDIT, LedgerEntryType.REFUND, LedgerEntryType.ADJUSTMENT, LedgerEntryType.PROMOTION].includes(entry.type)) {
        return balance.plus(entry.amount);
      }

      if (entry.type === LedgerEntryType.LOYALTY) {
        return balance;
      }
      return balance.minus(entry.amount);
    }, ZERO_DECIMAL);
  }

  private async updatePaymentStatus(
    tx: PrismaTx,
    reference: PaymentReference,
    paymentStatus: PaymentStatus,
    providerOrderId?: string,
    providerPaymentId?: string,
  ): Promise<void> {
    if (reference.referenceType === "ORDER") {
      await tx.order.update({
        where: { id: reference.referenceId },
        data: {
          paymentStatus,
          razorpayOrderId: providerOrderId,
          razorpayPaymentId: providerPaymentId,
        },
      });
      return;
    }

    if (reference.referenceType === "RIDE") {
      await tx.ride.update({ where: { id: reference.referenceId }, data: { paymentStatus } });
      return;
    }

    if (reference.referenceType === "COURIER") {
      await tx.courierBooking.update({ where: { id: reference.referenceId }, data: { paymentStatus } });
      return;
    }

    if (reference.referenceType === "HOME_SERVICE") {
      await tx.homeServiceBooking.update({ where: { id: reference.referenceId }, data: { paymentStatus } });
      return;
    }

    await tx.systemConfig.update({
      where: { key: `wallet_topup:${reference.referenceId}` },
      data: {
        value: {
          userId: reference.customerId,
          amount: reference.payableAmount.toString(),
          paymentStatus,
          providerPaymentId: providerPaymentId ?? null,
        },
      },
    });
  }

  private referenceTopic(reference: PaymentReference): string {
    if (reference.referenceType === "ORDER") {
      return `order:${reference.referenceId}`;
    }
    if (reference.referenceType === "RIDE") {
      return `ride:${reference.referenceId}`;
    }
    if (reference.referenceType === "COURIER") {
      return `courier:${reference.referenceId}`;
    }
    if (reference.referenceType === "HOME_SERVICE") {
      return `home-service:${reference.referenceId}`;
    }
    return `user:${reference.customerId}`;
  }

  private isPaymentStatus(value: unknown): value is PaymentStatus {
    return typeof value === "string" && Object.values(PaymentStatus).includes(value as PaymentStatus);
  }

  private paiseToDecimal(amountPaise: number): Prisma.Decimal {
    return new Prisma.Decimal(amountPaise).div(100).toDecimalPlaces(2);
  }
}