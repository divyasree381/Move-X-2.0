import { Type } from "class-transformer";
import {
  IsArray,
  IsDefined,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { PaymentMethod } from "@movex/shared";

export class CartItemDto {
  @IsString()
  @MinLength(1)
  menuItemId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;

  @IsOptional()
  @IsObject()
  customizations?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;

  @IsOptional()
  @IsObject()
  substitutionPreference?: Record<string, unknown>;
}

export class UpdateCartQtyDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;
}

export class ApplyCouponDto {
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  code!: string;
}

export class CheckoutAddressDto {
  @IsString()
  @MinLength(4)
  @MaxLength(500)
  address!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  line?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  pincode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  placeId?: string;

  @Type(() => Number)
  @IsLatitude()
  lat!: number;

  @Type(() => Number)
  @IsLongitude()
  lng!: number;

  @IsIn(["autocomplete", "map-click", "marker-drag", "gps", "typed"])
  source!: "autocomplete" | "map-click" | "marker-drag" | "gps" | "typed";
}

export class CheckoutDto {
  @IsIn(Object.values(PaymentMethod))
  paymentMethod!: PaymentMethod;

  @IsString()
  @MinLength(8)
  @MaxLength(120)
  idempotencyKey!: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => CheckoutAddressDto)
  address!: CheckoutAddressDto;
}

export class OrdersQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
export class PrepTimeDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(180)
  prepTimeMinutes?: number;
}

export class OtpStatusDto {
  @IsString()
  @MinLength(4)
  @MaxLength(12)
  otp!: string;
}

export class CancelOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class RatingDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}
export class PrescriptionUploadDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  fileName!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(120)
  contentType!: string;

  @IsString()
  @MinLength(8)
  contentBase64!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class PrescriptionVerificationDto {
  @IsIn(["VERIFIED", "REJECTED"])
  status!: "VERIFIED" | "REJECTED";

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class SubstitutionProposalItemDto {
  @IsString()
  @MinLength(1)
  menuItemId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  replacementMenuItemId?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(180)
  replacementName!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-9999)
  @Max(9999)
  priceDelta?: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class SubstitutionProposalDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubstitutionProposalItemDto)
  items!: SubstitutionProposalItemDto[];
}

export class SubstitutionDecisionItemDto {
  @IsString()
  @MinLength(1)
  menuItemId!: string;

  @IsIn(["APPROVED", "REJECTED"])
  decision!: "APPROVED" | "REJECTED";
}

export class SubstitutionDecisionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubstitutionDecisionItemDto)
  items!: SubstitutionDecisionItemDto[];
}