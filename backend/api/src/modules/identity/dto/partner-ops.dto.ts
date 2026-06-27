import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

export class PartnerOpsQueryDto {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}

export class PartnerShiftDto {
  @IsString()
  @MinLength(10)
  @MaxLength(80)
  startsAt!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(80)
  endsAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class PartnerRoutePlanDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  maxStops?: number;

  @IsOptional()
  @IsIn(["DISTANCE", "ETA", "PAYOUT"])
  objective?: "DISTANCE" | "ETA" | "PAYOUT";
}