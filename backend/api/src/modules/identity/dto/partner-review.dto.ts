import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class PartnerReviewDto {
  @IsIn(["APPROVED", "REJECTED"])
  approval!: "APPROVED" | "REJECTED";

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}