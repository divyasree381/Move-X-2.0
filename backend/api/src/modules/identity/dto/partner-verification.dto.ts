import { IsIn, IsObject, IsOptional, IsString, MaxLength } from "class-validator";

export class PartnerVerificationDto {
  @IsIn(["store", "delivery", "driver", "home-services"])
  partnerKind!: "store" | "delivery" | "driver" | "home-services";

  @IsObject()
  profile!: Record<string, unknown>;

  @IsObject()
  address!: Record<string, unknown>;

  @IsObject()
  documents!: Record<string, unknown>;

  @IsObject()
  settlements!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatarUrl?: string;
}
