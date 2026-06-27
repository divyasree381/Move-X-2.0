import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export const trustReferenceTypes = ["ORDER", "RIDE", "COURIER", "HOME_SERVICE"] as const;
export const disputeReasons = ["NOT_DELIVERED", "DAMAGED_OR_INCOMPLETE", "OVERCHARGED", "SAFETY_OR_BEHAVIOR", "CANCELLATION_FEE", "OTHER"] as const;
export const cancellationPolicyServiceTypes = ["FOOD", "GROCERY", "PHARMACY", "RIDE", "COURIER", "HOME_SERVICE"] as const;

export type TrustReferenceType = (typeof trustReferenceTypes)[number];

export class CancellationPolicyQueryDto {
  @IsOptional()
  @IsIn(cancellationPolicyServiceTypes)
  serviceType?: (typeof cancellationPolicyServiceTypes)[number];

  @IsOptional()
  @IsString()
  @MaxLength(64)
  stage?: string;
}

export class OpenDisputeDto {
  @IsIn(trustReferenceTypes)
  referenceType!: TrustReferenceType;

  @IsString()
  @MinLength(1)
  @MaxLength(256)
  referenceId!: string;

  @IsIn(disputeReasons)
  reason!: (typeof disputeReasons)[number];

  @IsString()
  @MinLength(8)
  @MaxLength(160)
  summary!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  customerNote?: string;
}