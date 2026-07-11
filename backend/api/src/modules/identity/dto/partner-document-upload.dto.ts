import { PartnerDocumentType } from "@prisma/client";
import {
  IsBase64,
  IsEnum,
  IsISO8601,
  IsMimeType,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class PartnerDocumentUploadDto {
  @IsEnum(PartnerDocumentType)
  documentType!: PartnerDocumentType;

  @IsString()
  @MinLength(1)
  @MaxLength(180)
  fileName!: string;

  @IsMimeType()
  @MaxLength(100)
  contentType!: string;

  @IsBase64()
  @MaxLength(14_000_000)
  contentBase64!: string;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}