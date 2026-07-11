import { IsString, MinLength } from "class-validator";

export class AdminChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(12)
  newPassword!: string;
}