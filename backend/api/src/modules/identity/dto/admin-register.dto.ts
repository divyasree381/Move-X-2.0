import { IsEmail, IsIn, IsOptional, IsString, Length, MinLength } from "class-validator";
import { PASSWORD_LOGIN_ROLES } from "@movex/shared";

export class AdminRegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsIn(PASSWORD_LOGIN_ROLES)
  role!: (typeof PASSWORD_LOGIN_ROLES)[number];

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @Length(5, 24)
  phone?: string;
}