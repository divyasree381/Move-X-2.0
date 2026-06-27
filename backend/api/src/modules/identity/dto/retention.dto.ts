import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class FavoriteDto {
  @IsIn(["STORE", "MENU_ITEM"])
  type!: "STORE" | "MENU_ITEM";

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  targetId!: string;
}

export class ApplyReferralDto {
  @IsString()
  @MinLength(4)
  @MaxLength(32)
  code!: string;
}

export class FavoritesQueryDto {
  @IsOptional()
  @IsIn(["STORE", "MENU_ITEM"])
  type?: "STORE" | "MENU_ITEM";
}