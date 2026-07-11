import { IsString, MinLength } from "class-validator";

export class AdminAcceptInvitationDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(12)
  newPassword!: string;
}