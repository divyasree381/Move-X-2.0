import { Type } from "class-transformer";
import { IsIn, IsInt, IsLatitude, IsLongitude, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from "class-validator";
import { PaymentMethod, VehicleType } from "@movex/shared";

export class RideLocationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  address!: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  placeId?: string;

  @Type(() => Number)
  @IsLatitude()
  lat!: number;

  @Type(() => Number)
  @IsLongitude()
  lng!: number;

  @IsIn(["autocomplete", "map-click", "marker-drag", "gps"])
  source!: "autocomplete" | "map-click" | "marker-drag" | "gps";
}

export class RideEstimateDto {
  @ValidateNested()
  @Type(() => RideLocationDto)
  pickup!: RideLocationDto;

  @ValidateNested()
  @Type(() => RideLocationDto)
  drop!: RideLocationDto;

  @IsIn(Object.values(VehicleType))
  vehicleType!: VehicleType;
}

export class CreateRideDto extends RideEstimateDto {
  @IsIn(Object.values(PaymentMethod))
  paymentMethod!: PaymentMethod;
}


export class CourierContactDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(20)
  phone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class CourierEstimateDto {
  @ValidateNested()
  @Type(() => RideLocationDto)
  pickup!: RideLocationDto;

  @ValidateNested()
  @Type(() => RideLocationDto)
  drop!: RideLocationDto;

  @IsString()
  @MinLength(2)
  @MaxLength(300)
  packageDescription!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @Max(50)
  packageWeightKg?: number;
}

export class CreateCourierDto extends CourierEstimateDto {
  @ValidateNested()
  @Type(() => CourierContactDto)
  sender!: CourierContactDto;

  @ValidateNested()
  @Type(() => CourierContactDto)
  recipient!: CourierContactDto;

  @IsIn(Object.values(PaymentMethod))
  paymentMethod!: PaymentMethod;
}

export class HomeServiceCatalogQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;
}

export class HomeServiceEstimateDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  serviceCode!: string;
}

export class CreateHomeServiceDto extends HomeServiceEstimateDto {
  @ValidateNested()
  @Type(() => RideLocationDto)
  address!: RideLocationDto;

  @IsString()
  @MinLength(10)
  @MaxLength(80)
  scheduledFor!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsIn(Object.values(PaymentMethod))
  paymentMethod!: PaymentMethod;
}
export class RideOtpDto {
  @IsString()
  @MinLength(4)
  @MaxLength(12)
  otp!: string;
}

export class RideCancelDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class RideRatingDto {
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

export class RidesQueryDto {
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