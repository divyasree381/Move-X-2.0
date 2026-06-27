import { Inject, Injectable } from "@nestjs/common";
import type { MapSuggestion, RouteMatrix, RouteSummary, SelectedLocation } from "@movex/shared";

import { RedisStoreService } from "../../infrastructure/redis/redis-store.service";
import { MAPS_PROVIDER, type MapsBias, type MapsProvider, type RoutePoint } from "./maps-provider";
import type { RouteDto, RouteMatrixDto } from "./dto/maps.dto";

const GEOCODE_CACHE_TTL_MS = Number(process.env.MAPS_GEOCODE_CACHE_TTL_MS ?? 5 * 60 * 1000);
const ROUTE_CACHE_TTL_MS = Number(process.env.MAPS_ROUTE_CACHE_TTL_MS ?? 60 * 1000);

@Injectable()
export class MapsService {
  constructor(
    @Inject(MAPS_PROVIDER) private readonly provider: MapsProvider,
    @Inject(RedisStoreService) private readonly redisStore: RedisStoreService,
  ) {}

  autocomplete(input: string, bias?: MapsBias): Promise<MapSuggestion[]> {
    return this.provider.autocomplete(input, bias);
  }

  getPlaceDetails(placeId: string): Promise<SelectedLocation> {
    return this.provider.getPlaceDetails(placeId);
  }

  geocode(address: string): Promise<SelectedLocation> {
    return this.cached(`maps:geocode:${this.cachePart(address)}`, GEOCODE_CACHE_TTL_MS, () =>
      this.provider.geocode(address),
    );
  }

  reverseGeocode(lat: number, lng: number): Promise<string> {
    return this.cached(`maps:reverse:${lat.toFixed(6)}:${lng.toFixed(6)}`, GEOCODE_CACHE_TTL_MS, () =>
      this.provider.reverseGeocode(lat, lng),
    );
  }

  getRoute(input: RouteDto): Promise<RouteSummary> {
    return this.cached(`maps:route:${this.cachePart(input)}`, ROUTE_CACHE_TTL_MS, () =>
      this.provider.getRoute(this.toRoutePoint(input.from), this.toRoutePoint(input.to), input.mode),
    );
  }

  routeMatrix(input: RouteMatrixDto): Promise<RouteMatrix> {
    return this.cached(`maps:matrix:${this.cachePart(input)}`, ROUTE_CACHE_TTL_MS, () =>
      this.provider.routeMatrix(input.origins.map(this.toRoutePoint), input.destinations.map(this.toRoutePoint), input.mode),
    );
  }

  private toRoutePoint(point: RoutePoint): RoutePoint {
    return {
      address: point.address,
      placeId: point.placeId,
      lat: point.lat,
      lng: point.lng,
      source: point.source,
    };
  }

  private async cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    const cached = await this.redisStore.getJson<T>(key);

    if (cached) {
      return cached;
    }

    const value = await loader();
    await this.redisStore.setJson(key, value, ttlMs);
    return value;
  }

  private cachePart(value: unknown): string {
    return Buffer.from(JSON.stringify(value)).toString("base64url");
  }
}