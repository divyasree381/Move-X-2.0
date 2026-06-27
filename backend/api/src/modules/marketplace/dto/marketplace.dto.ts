import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { StoreType } from "@movex/shared";

export class StoreListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  lng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.5)
  @Max(50)
  radiusKm?: number;

  @IsOptional()
  @IsIn(Object.values(StoreType))
  type?: StoreType;

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

export class StoreSearchQueryDto extends StoreListQueryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  q!: string;
}

export class UpsertStoreDto {
  @IsIn(Object.values(StoreType))
  type!: StoreType;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  description!: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  imageUrl?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  licenseUrl?: string;

  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(180)
  etaMinutes!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minOrder!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.5)
  @Max(50)
  deliveryRadiusKm!: number;

  @Type(() => Number)
  @IsLatitude()
  lat!: number;

  @Type(() => Number)
  @IsLongitude()
  lng!: number;

  @IsOptional()
  @IsObject()
  bankAccount?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  openingHours?: Record<string, unknown>;
}

export class StoreOpenDto {
  @IsBoolean()
  isOpen!: boolean;
}

export class StoreReviewDto {
  @IsIn(["APPROVED", "REJECTED"])
  approval!: "APPROVED" | "REJECTED";

  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionReason?: string;
}

export class MenuItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  section!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(140)
  name!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  description!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsUrl({ require_tld: false })
  imageUrl?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(16)
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  available?: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(-1)
  stock!: number;

  @IsOptional()
  @IsObject()
  customizations?: Record<string, unknown>;
}

export class UpdateMenuItemDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  section?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(140)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsUrl({ require_tld: false })
  imageUrl?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(16)
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  available?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-1)
  stock?: number;

  @IsOptional()
  @IsObject()
  customizations?: Record<string, unknown>;
}