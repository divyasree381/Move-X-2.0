import { IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";
import { Type } from "class-transformer";

export const paymentReferenceTypes = ["ORDER", "RIDE", "COURIER", "HOME_SERVICE", "WALLET_TOPUP"] as const;
export type PaymentReferenceType = (typeof paymentReferenceTypes)[number];

export class CreatePaymentOrderDto {
  @IsIn([...paymentReferenceTypes])
  referenceType!: PaymentReferenceType;

  @IsString()
  @MinLength(1)
  @MaxLength(256)
  referenceId!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  idempotencyKey!: string;
}

export class CreateRefundDto {
  @IsIn([...paymentReferenceTypes])
  referenceType!: PaymentReferenceType;

  @IsString()
  @MinLength(1)
  @MaxLength(256)
  referenceId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class MockCaptureDto {
  @IsIn([...paymentReferenceTypes])
  referenceType!: PaymentReferenceType;

  @IsString()
  @MinLength(1)
  @MaxLength(256)
  referenceId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(256)
  razorpayOrderId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  razorpayPaymentId?: string;
}

export class CreateWalletTopUpDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(10)
  @Max(100000)
  amount!: number;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  idempotencyKey!: string;
}
