import { Inject, Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ApiExtraModels, ApiTags } from "@nestjs/swagger";

import { Public } from "../../common/decorators/public.decorator";
import {
  AutocompleteQueryDto,
  GeocodeQueryDto,
  PlaceQueryDto,
  ReverseGeocodeQueryDto,
  RouteDto,
  RouteMatrixDto,
} from "./dto/maps.dto";
import { MapsService } from "./maps.service";

@ApiTags("Maps")
@ApiExtraModels(AutocompleteQueryDto, GeocodeQueryDto, PlaceQueryDto, ReverseGeocodeQueryDto, RouteDto, RouteMatrixDto)
@Public()
@Controller({ path: "maps", version: "1" })
export class MapsController {
  constructor(@Inject(MapsService) private readonly mapsService: MapsService) {}

  @Get("autocomplete")
  autocomplete(@Query() query: AutocompleteQueryDto) {
    const bias =
      typeof query.lat === "number" && typeof query.lng === "number"
        ? { lat: query.lat, lng: query.lng, radiusMeters: query.radiusMeters }
        : undefined;

    return this.mapsService.autocomplete(query.input, bias);
  }

  @Get("place")
  getPlaceDetails(@Query() query: PlaceQueryDto) {
    return this.mapsService.getPlaceDetails(query.placeId);
  }

  @Get("geocode")
  geocode(@Query() query: GeocodeQueryDto) {
    return this.mapsService.geocode(query.address);
  }

  @Get("reverse-geocode")
  reverseGeocode(@Query() query: ReverseGeocodeQueryDto) {
    return this.mapsService.reverseGeocode(query.lat, query.lng);
  }

  @Post("route")
  getRoute(@Body() body: RouteDto) {
    return this.mapsService.getRoute(body);
  }

  @Post("route-matrix")
  routeMatrix(@Body() body: RouteMatrixDto) {
    return this.mapsService.routeMatrix(body);
  }
}