import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

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