import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";
import { mapTravelModeValues, type MapTravelMode } from "@movex/shared";

export class AutocompleteQueryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  input!: string;

  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  lng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  radiusMeters?: number;
}

export class PlaceQueryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  placeId!: string;
}

export class GeocodeQueryDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  address!: string;
}

export class ReverseGeocodeQueryDto {
  @Type(() => Number)
  @IsLatitude()
  lat!: number;

  @Type(() => Number)
  @IsLongitude()
  lng!: number;
}

export class RoutePointDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  address!: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  placeId?: string;

  @Type(() => Number)
  @IsLatitude()
  lat!: number;

  @Type(() => Number)
  @IsLongitude()
  lng!: number;

  @IsIn(["autocomplete", "map-click", "marker-drag", "gps"])
  source!: "autocomplete" | "map-click" | "marker-drag" | "gps";
}

export class RouteDto {
  @ValidateNested()
  @Type(() => RoutePointDto)
  from!: RoutePointDto;

  @ValidateNested()
  @Type(() => RoutePointDto)
  to!: RoutePointDto;

  @IsIn([...mapTravelModeValues])
  mode!: MapTravelMode;
}

export class RouteMatrixDto {
  @IsArray()
  @ArrayMaxSize(25)
  @ValidateNested({ each: true })
  @Type(() => RoutePointDto)
  origins!: RoutePointDto[];

  @IsArray()
  @ArrayMaxSize(25)
  @ValidateNested({ each: true })
  @Type(() => RoutePointDto)
  destinations!: RoutePointDto[];

  @IsIn([...mapTravelModeValues])
  mode!: MapTravelMode;
}