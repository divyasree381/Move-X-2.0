import { IsIn, IsString, Length } from "class-validator";

import { OTP_LOGIN_ROLES, type OtpLoginRole } from "../constants";

export class OtpRequestDto {
  @IsString()
  @Length(5, 24)
  phone!: string;

  @IsIn(OTP_LOGIN_ROLES)
  role!: OtpLoginRole;
}