import { Transform, Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsNumber, IsObject,
  IsArray, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";
import { InvoiceStatus, InvoiceType, LedgerEntryType, PaymentMethod, PayoutStatus, UserRole } from "@prisma/client";

import { paymentReferenceTypes, type PaymentReferenceType } from "../../payments/dto/payments.dto";

export class FinanceCursorQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class LedgerQueryDto extends FinanceCursorQueryDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsIn(Object.values(UserRole))
  userRole?: UserRole;

  @IsOptional()
  @IsIn(Object.values(LedgerEntryType))
  type?: LedgerEntryType;

  @IsOptional()
  @IsIn(Object.values(PaymentMethod))
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  isSettled?: boolean;

  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsString()
  rideId?: string;
}

export class WalletAdjustmentDto {
  @IsString()
  userId!: string;

  @Type(() => Number)
  @IsNumber()
  amount!: number;

  @IsString()
  @MinLength(3)
  @MaxLength(300)
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;
}

export class PayoutSweepDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsIn(Object.values(UserRole))
  userRole?: UserRole;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;
}

export class PayoutQueryDto extends FinanceCursorQueryDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsIn(Object.values(UserRole))
  userRole?: UserRole;

  @IsOptional()
  @IsIn(Object.values(PayoutStatus))
  status?: PayoutStatus;
}

export class MarkPayoutDto {
  @IsOptional()
  @IsIn(Object.values(PayoutStatus))
  status?: PayoutStatus;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  reference?: string;
}

export class InvoiceQueryDto extends FinanceCursorQueryDto {
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsIn(Object.values(InvoiceType))
  type?: InvoiceType;

  @IsOptional()
  @IsString()
  referenceId?: string;

  @IsOptional()
  @IsIn(Object.values(InvoiceStatus))
  status?: InvoiceStatus;
}

export class GenerateInvoiceDto {
  @IsIn([...paymentReferenceTypes.filter((type) => type !== "WALLET_TOPUP")])
  referenceType!: Exclude<PaymentReferenceType, "WALLET_TOPUP">;

  @IsString()
  @MinLength(1)
  @MaxLength(256)
  referenceId!: string;

  @IsOptional()
  @IsObject()
  recipient?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  taxBreakdown?: Record<string, unknown>;
}
export class ReconciliationQueryDto extends FinanceCursorQueryDto {
  @IsOptional()
  @IsIn(["CLEAR", "HAS_MISMATCHES"])
  status?: "CLEAR" | "HAS_MISMATCHES";
}

export class GenerateReconciliationDto {
  @IsString()
  from!: string;

  @IsString()
  to!: string;

  @IsOptional()
  @IsArray()
  providerRows?: Record<string, unknown>[];
}