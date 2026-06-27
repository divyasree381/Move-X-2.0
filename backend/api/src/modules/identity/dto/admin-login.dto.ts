import { IsEmail, IsOptional, IsString, Length, MinLength } from "class-validator";

export class AdminLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  @Length(6, 6)
  mfaCode?: string;
}
