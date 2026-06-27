import { Type } from "class-transformer";
import { IsIn, IsLatitude, IsLongitude, IsOptional } from "class-validator";
import { VehicleType } from "@movex/shared";

export class PartnerLocationDto {
  @Type(() => Number)
  @IsLatitude()
  lat!: number;

  @Type(() => Number)
  @IsLongitude()
  lng!: number;

  @IsOptional()
  @IsIn(Object.values(VehicleType))
  vehicleType?: VehicleType;
}