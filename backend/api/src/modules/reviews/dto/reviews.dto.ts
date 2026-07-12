import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { ReviewStatus } from "@prisma/client";

export class ReviewsQueryDto {
  @IsOptional()
  @IsString()
  storeId?: string;

  @IsOptional()
  @IsString()
  menuItemId?: string;

  @IsOptional()
  @IsString()
  targetUserId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @IsString()
  cursor?: string;
}

export class ReviewModerationDto {
  @IsEnum(ReviewStatus)
  status!: ReviewStatus;
}
