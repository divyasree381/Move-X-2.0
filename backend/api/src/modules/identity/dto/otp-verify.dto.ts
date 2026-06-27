import { IsIn, IsString, Length, Matches } from "class-validator";

import { OTP_LOGIN_ROLES, type OtpLoginRole } from "../constants";

export class OtpVerifyDto {
  @IsString()
  @Length(5, 24)
  phone!: string;

  @IsIn(OTP_LOGIN_ROLES)
  role!: OtpLoginRole;

  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;
}