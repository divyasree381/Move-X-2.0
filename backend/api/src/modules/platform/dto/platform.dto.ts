import { Type } from "class-transformer";
import { IsBoolean, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

export class AnalyticsQueryDto {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  scope?: string;
}

export class RefreshAnalyticsDto extends AnalyticsQueryDto {}

export class FeatureFlagQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  q?: string;
}

export class UpsertFeatureFlagDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsObject()
  rollout?: Record<string, unknown>;
}

export class SearchRebuildDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  scope?: string;
}
