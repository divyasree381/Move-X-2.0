import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import type { MapSuggestion, MapTravelMode, RouteMatrix, RouteMatrixCell, RouteSummary, SelectedLocation } from "@movex/shared";

import type { MapsBias, MapsProvider, RoutePoint } from "./maps-provider";

type GooglePlaceAutocompleteResponse = {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string;
      text?: { text?: string };
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
    };
  }>;
};

type GooglePlaceDetailsResponse = {
  id?: string;
  formattedAddress?: string;
  location?: {
    latitude?: number;
    longitude?: number;
  };
};

type GoogleGeocodeResponse = {
  status: string;
  results?: Array<{
    place_id?: string;
    formatted_address?: string;
    geometry?: {
      location?: {
        lat?: number;
        lng?: number;
      };
    };
  }>;
  error_message?: string;
};

type GoogleRoutesResponse = {
  routes?: Array<{
    distanceMeters?: number;
    duration?: string;
    polyline?: {
      encodedPolyline?: string;
    };
  }>;
};

type GoogleMatrixElement = {
  originIndex?: number;
  destinationIndex?: number;
  distanceMeters?: number;
  duration?: string;
  status?: { code?: number; message?: string } | string;
  condition?: string;
};

const PLACES_BASE_URL = "https://places.googleapis.com/v1";
const GEOCODING_BASE_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const ROUTES_BASE_URL = "https://routes.googleapis.com";

@Injectable()
export class GoogleMapsProvider implements MapsProvider {
  async autocomplete(input: string, bias?: MapsBias): Promise<MapSuggestion[]> {
    const body: Record<string, unknown> = { input };

    if (bias) {
      body.locationBias = {
        circle: {
          center: { latitude: bias.lat, longitude: bias.lng },
          radius: bias.radiusMeters ?? 20_000,
        },
      };
    }

    const response = await this.googleJson<GooglePlaceAutocompleteResponse>(`${PLACES_BASE_URL}/places:autocomplete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-FieldMask": [
          "suggestions.placePrediction.placeId",
          "suggestions.placePrediction.text.text",
          "suggestions.placePrediction.structuredFormat.mainText.text",
          "suggestions.placePrediction.structuredFormat.secondaryText.text",
        ].join(","),
      },
      body: JSON.stringify(body),
    });

    return (response.suggestions ?? [])
      .map((suggestion) => suggestion.placePrediction)
      .filter((prediction): prediction is NonNullable<typeof prediction> => Boolean(prediction?.placeId))
      .map((prediction) => ({
        placeId: prediction.placeId ?? "",
        description: prediction.text?.text ?? prediction.structuredFormat?.mainText?.text ?? "",
        mainText: prediction.structuredFormat?.mainText?.text ?? prediction.text?.text ?? "",
        secondaryText: prediction.structuredFormat?.secondaryText?.text,
      }))
      .filter((suggestion) => suggestion.placeId && suggestion.description && suggestion.mainText);
  }

  async getPlaceDetails(placeId: string): Promise<SelectedLocation> {
    const response = await this.googleJson<GooglePlaceDetailsResponse>(
      `${PLACES_BASE_URL}/places/${encodeURIComponent(placeId)}`,
      {
        headers: {
          "X-Goog-FieldMask": "id,formattedAddress,location",
        },
      },
    );

    const lat = response.location?.latitude;
    const lng = response.location?.longitude;

    if (typeof lat !== "number" || typeof lng !== "number" || !response.formattedAddress) {
      throw new ServiceUnavailableException("Place details were not available");
    }

    return {
      address: response.formattedAddress,
      placeId: response.id ?? placeId,
      lat,
      lng,
      source: "autocomplete",
    };
  }

  async geocode(address: string): Promise<SelectedLocation> {
    const url = new URL(GEOCODING_BASE_URL);
    url.searchParams.set("address", address);
    url.searchParams.set("key", this.apiKey());

    const response = await this.fetchJson<GoogleGeocodeResponse>(url.toString());
    const first = this.firstGeocodeResult(response);

    return {
      address: first.formatted_address ?? address,
      placeId: first.place_id,
      lat: first.geometry?.location?.lat ?? 0,
      lng: first.geometry?.location?.lng ?? 0,
      source: "autocomplete",
    };
  }

  async reverseGeocode(lat: number, lng: number): Promise<string> {
    const url = new URL(GEOCODING_BASE_URL);
    url.searchParams.set("latlng", `${lat},${lng}`);
    url.searchParams.set("key", this.apiKey());

    const response = await this.fetchJson<GoogleGeocodeResponse>(url.toString());
    return this.firstGeocodeResult(response).formatted_address ?? `${lat}, ${lng}`;
  }

  async getRoute(from: RoutePoint, to: RoutePoint, mode: MapTravelMode): Promise<RouteSummary> {
    const response = await this.googleJson<GoogleRoutesResponse>(`${ROUTES_BASE_URL}/directions/v2:computeRoutes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
      },
      body: JSON.stringify({
        origin: this.routeWaypoint(from),
        destination: this.routeWaypoint(to),
        travelMode: mode,
        computeAlternativeRoutes: false,
      }),
    });

    const route = response.routes?.[0];

    if (!route) {
      throw new ServiceUnavailableException("Route was not available");
    }

    return {
      distanceMeters: route.distanceMeters ?? 0,
      durationSeconds: this.parseGoogleDuration(route.duration),
      polyline: route.polyline?.encodedPolyline ?? "",
    };
  }

  async routeMatrix(origins: RoutePoint[], destinations: RoutePoint[], mode: MapTravelMode): Promise<RouteMatrix> {
    const response = await this.googleJson<GoogleMatrixElement[]>(
      `${ROUTES_BASE_URL}/distanceMatrix/v2:computeRouteMatrix`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-FieldMask": "originIndex,destinationIndex,distanceMeters,duration,status,condition",
        },
        body: JSON.stringify({
          origins: origins.map((origin) => ({ waypoint: this.routeWaypoint(origin) })),
          destinations: destinations.map((destination) => ({ waypoint: this.routeWaypoint(destination) })),
          travelMode: mode,
        }),
      },
    );

    const matrix: RouteMatrix = origins.map(() => []);

    for (const element of response) {
      const originIndex = element.originIndex ?? 0;
      const destinationIndex = element.destinationIndex ?? 0;
      const cell: RouteMatrixCell = {
        originIndex,
        destinationIndex,
        distanceMeters: element.distanceMeters ?? 0,
        durationSeconds: this.parseGoogleDuration(element.duration),
        polyline: "",
        status: typeof element.status === "string" ? element.status : element.status?.message ?? element.condition,
      };
      matrix[originIndex][destinationIndex] = cell;
    }

    return matrix.map((row, originIndex) =>
      destinations.map(
        (_destination, destinationIndex) =>
          row[destinationIndex] ?? {
            originIndex,
            destinationIndex,
            distanceMeters: 0,
            durationSeconds: 0,
            polyline: "",
            status: "NO_RESULT",
          },
      ),
    );
  }

  private routeWaypoint(point: RoutePoint): { location: { latLng: { latitude: number; longitude: number } } } {
    return {
      location: {
        latLng: {
          latitude: point.lat,
          longitude: point.lng,
        },
      },
    };
  }

  private firstGeocodeResult(response: GoogleGeocodeResponse): NonNullable<GoogleGeocodeResponse["results"]>[number] {
    if (response.status !== "OK" || !response.results?.[0]?.geometry?.location) {
      throw new ServiceUnavailableException(response.error_message ?? "Geocode result was not available");
    }

    return response.results[0];
  }

  private parseGoogleDuration(duration?: string): number {
    const seconds = duration?.match(/^(\d+(?:\.\d+)?)s$/)?.[1];
    return seconds ? Math.round(Number(seconds)) : 0;
  }

  private async googleJson<T>(url: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("X-Goog-Api-Key", this.apiKey());

    return this.fetchJson<T>(url, {
      ...init,
      headers,
    });
  }

  private async fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(url, init);

    if (!response.ok) {
      throw new ServiceUnavailableException("Maps provider request failed");
    }

    return (await response.json()) as T;
  }

  private apiKey(): string {
    const key = process.env.GOOGLE_MAPS_API_KEY;

    if (!key) {
      throw new ServiceUnavailableException("Google Maps provider is not configured");
    }

    return key;
  }
}