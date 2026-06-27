import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { CouponDiscountType, DisputeReason, DisputeReferenceType, DisputeResolution, DisputeStatus, ServiceType, SupportTicketPriority, SupportTicketStatus } from "@prisma/client";

export class CursorQueryDto {
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

export class CouponQueryDto extends CursorQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(Object.values(ServiceType))
  serviceType?: ServiceType;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}

export class UpsertCouponDto {
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  code!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsIn(Object.values(ServiceType))
  serviceType?: ServiceType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  campaignName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  campaignTag?: string;

  @IsOptional()
  @IsBoolean()
  firstOrderOnly?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsIn(Object.values(CouponDiscountType))
  discountType!: CouponDiscountType;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountValue!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxDiscount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minOrderValue?: number;

  @IsOptional()
  @IsString()
  startsAt?: string;

  @IsOptional()
  @IsString()
  expiresAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  usageLimit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  perUserLimit?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ConfigQueryDto extends CursorQueryDto {
  @IsOptional()
  @IsString()
  q?: string;
}

export class UpsertConfigDto {
  @IsObject()
  value!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isSecret?: boolean;
}

export class TicketQueryDto extends CursorQueryDto {
  @IsOptional()
  @IsIn(Object.values(SupportTicketStatus))
  status?: SupportTicketStatus;

  @IsOptional()
  @IsIn(Object.values(SupportTicketPriority))
  priority?: SupportTicketPriority;

  @IsOptional()
  @IsString()
  referenceType?: string;

  @IsOptional()
  @IsString()
  referenceId?: string;
}

export class CreateTicketDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  subject!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(5000)
  message!: string;

  @IsOptional()
  @IsIn(Object.values(SupportTicketPriority))
  priority?: SupportTicketPriority;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  referenceType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  referenceId?: string;
}

export class UpdateTicketDto {
  @IsOptional()
  @IsIn(Object.values(SupportTicketStatus))
  status?: SupportTicketStatus;

  @IsOptional()
  @IsIn(Object.values(SupportTicketPriority))
  priority?: SupportTicketPriority;

  @IsOptional()
  @IsString()
  assignedToId?: string;
}

export class TicketMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  message!: string;
}

export class AuditQueryDto extends CursorQueryDto {
  @IsOptional()
  @IsString()
  actorId?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  entityType?: string;
}
export class DisputeQueryDto extends CursorQueryDto {
  @IsOptional()
  @IsIn(Object.values(DisputeStatus))
  status?: DisputeStatus;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  partnerId?: string;

  @IsOptional()
  @IsIn(Object.values(DisputeReferenceType))
  referenceType?: DisputeReferenceType;

  @IsOptional()
  @IsString()
  referenceId?: string;

  @IsOptional()
  @IsIn(Object.values(DisputeReason))
  reason?: DisputeReason;
}

export class DisputeActionDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  action?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsOptional()
  @IsIn(Object.values(DisputeStatus))
  status?: DisputeStatus;

  @IsOptional()
  @IsIn(Object.values(DisputeResolution))
  resolution?: DisputeResolution;
}