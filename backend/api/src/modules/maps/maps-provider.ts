import type { MapSuggestion, MapTravelMode, RouteMatrix, RouteSummary, SelectedLocation } from "@movex/shared";

export const MAPS_PROVIDER = Symbol("MAPS_PROVIDER");

export type RoutePoint = Pick<SelectedLocation, "address" | "placeId" | "lat" | "lng" | "source">;

export type MapsBias = {
  lat: number;
  lng: number;
  radiusMeters?: number;
};

export interface MapsProvider {
  autocomplete(input: string, bias?: MapsBias): Promise<MapSuggestion[]>;
  getPlaceDetails(placeId: string): Promise<SelectedLocation>;
  geocode(address: string): Promise<SelectedLocation>;
  reverseGeocode(lat: number, lng: number): Promise<string>;
  getRoute(from: RoutePoint, to: RoutePoint, mode: MapTravelMode): Promise<RouteSummary>;
  routeMatrix(origins: RoutePoint[], destinations: RoutePoint[], mode: MapTravelMode): Promise<RouteMatrix>;
}