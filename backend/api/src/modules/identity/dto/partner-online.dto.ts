import { IsBoolean } from "class-validator";

export class PartnerOnlineDto {
  @IsBoolean()
  isOnline!: boolean;
}