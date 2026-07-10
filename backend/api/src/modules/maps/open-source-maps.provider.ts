/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { Injectable, ServiceUnavailableException, Logger } from "@nestjs/common";
import type { MapSuggestion, MapTravelMode, RouteMatrix, RouteSummary, SelectedLocation } from "@movex/shared";

import type { MapsBias, MapsProvider, RoutePoint } from "./maps-provider";

const PHOTON_URL = "https://photon.komoot.io/api/";
const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const OSRM_BASE = "https://router.project-osrm.org";
const USER_AGENT = "MoveX-App/1.0";

class NominatimQueue {
  private queue: Array<() => void> = [];
  private isProcessing = false;

  async enqueue<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          resolve(await task());
        } catch (e) {
          reject(e);
        }
      });
      if (!this.isProcessing) {
        void this.process();
      }
    });
  }

  private async process() {
    this.isProcessing = true;
    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        await task();
        // Enforce Nominatim's 1 req/sec policy
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    this.isProcessing = false;
  }
}

const nominatimQueue = new NominatimQueue();

@Injectable()
export class OpenSourceMapsProvider implements MapsProvider {
  private readonly logger = new Logger(OpenSourceMapsProvider.name);

  async autocomplete(input: string, bias?: MapsBias): Promise<MapSuggestion[]> {
    try {
      const url = new URL(PHOTON_URL);
      url.searchParams.set("q", input);
      url.searchParams.set("limit", "5");
      if (bias) {
        url.searchParams.set("lat", bias.lat.toString());
        url.searchParams.set("lon", bias.lng.toString());
      }

      const response = await this.fetchJson<any>(url.toString());
      if (response?.features?.length > 0) {
        return response.features.map((feature: any) => ({
          placeId: `photon:${feature.properties.osm_id}`,
          description: [feature.properties.name, feature.properties.street, feature.properties.city].filter(Boolean).join(", "),
          mainText: feature.properties.name || feature.properties.street || "Location",
          secondaryText: [feature.properties.city, feature.properties.state].filter(Boolean).join(", "),
          lat: feature.geometry.coordinates[1],
          lng: feature.geometry.coordinates[0],
        })).filter((s: any) => s.mainText);
      }
    } catch (error) {
      this.logger.warn(`Photon autocomplete failed, falling back to Nominatim: ${error}`);
    }

    // Fallback to Nominatim
    return nominatimQueue.enqueue(async () => {
      const url = new URL(`${NOMINATIM_BASE}/search`);
      url.searchParams.set("q", input);
      url.searchParams.set("format", "json");
      url.searchParams.set("limit", "5");

      const response = await this.fetchJson<any[]>(url.toString(), { headers: { "User-Agent": USER_AGENT } });
      return response.map((item) => ({
        placeId: `nominatim:${item.place_id}`,
        description: item.display_name,
        mainText: item.display_name.split(",")[0],
        secondaryText: item.display_name.split(",").slice(1).join(",").trim(),
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
      }));
    });
  }

  async getPlaceDetails(placeId: string): Promise<SelectedLocation> {
    throw new ServiceUnavailableException("getPlaceDetails not fully supported by open-source stack without specific osm_type. Please use geocode().");
  }

  async geocode(address: string): Promise<SelectedLocation> {
    return nominatimQueue.enqueue(async () => {
      const url = new URL(`${NOMINATIM_BASE}/search`);
      url.searchParams.set("q", address);
      url.searchParams.set("format", "json");
      url.searchParams.set("limit", "1");

      const response = await this.fetchJson<any[]>(url.toString(), { headers: { "User-Agent": USER_AGENT } });
      const first = response[0];
      if (!first) {
        throw new ServiceUnavailableException("Geocode result was not available");
      }

      return {
        address: first.display_name,
        placeId: `nominatim:${first.place_id}`,
        lat: parseFloat(first.lat),
        lng: parseFloat(first.lon),
        source: "autocomplete",
      };
    });
  }

  async reverseGeocode(lat: number, lng: number): Promise<string> {
    return nominatimQueue.enqueue(async () => {
      const url = new URL(`${NOMINATIM_BASE}/reverse`);
      url.searchParams.set("lat", lat.toString());
      url.searchParams.set("lon", lng.toString());
      url.searchParams.set("format", "json");

      const response = await this.fetchJson<any>(url.toString(), { headers: { "User-Agent": USER_AGENT } });
      return response.display_name || `${lat}, ${lng}`;
    });
  }

  async getRoute(from: RoutePoint, to: RoutePoint, mode: MapTravelMode): Promise<RouteSummary> {
    const profile = mode === "TWO_WHEELER" ? "driving" : "driving";
    const url = `${OSRM_BASE}/route/v1/${profile}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full`;
    
    const response = await this.fetchJson<any>(url);
    const route = response.routes?.[0];

    if (!route) {
      throw new ServiceUnavailableException("Route was not available");
    }

    return {
      distanceMeters: route.distance ?? 0,
      durationSeconds: Math.round(route.duration ?? 0),
      polyline: route.geometry ?? "",
    };
  }

  async routeMatrix(origins: RoutePoint[], destinations: RoutePoint[], mode: MapTravelMode): Promise<RouteMatrix> {
    if (origins.length === 0 || destinations.length === 0) return [];

    const coordinates = [...origins, ...destinations].map(p => `${p.lng},${p.lat}`).join(";");
    const sources = origins.map((_, i) => i).join(";");
    const dests = destinations.map((_, i) => origins.length + i).join(";");
    const profile = mode === "TWO_WHEELER" ? "driving" : "driving";

    const url = `${OSRM_BASE}/table/v1/${profile}/${coordinates}?sources=${sources}&destinations=${dests}&annotations=distance,duration`;
    
    try {
      const response = await this.fetchJson<any>(url);
      const matrix: RouteMatrix = origins.map(() => []);

      for (let i = 0; i < origins.length; i++) {
        for (let j = 0; j < destinations.length; j++) {
          const distanceMeters = response.distances?.[i]?.[j];
          const durationSeconds = response.durations?.[i]?.[j];

          matrix[i]![j] = {
            originIndex: i,
            destinationIndex: j,
            distanceMeters: distanceMeters ?? 0,
            durationSeconds: durationSeconds ? Math.round(durationSeconds) : 0,
            polyline: "",
            status: distanceMeters !== undefined ? "OK" : "NO_RESULT",
          };
        }
      }

      return matrix;
    } catch (e) {
      this.logger.error("OSRM Route Matrix failed, falling back to empty matrix", e);
      return origins.map((_, originIndex) =>
        destinations.map((_, destinationIndex) => ({
          originIndex,
          destinationIndex,
          distanceMeters: 0,
          durationSeconds: 0,
          polyline: "",
          status: "NO_RESULT",
        }))
      );
    }
  }

  private async fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(url, init);
    if (!response.ok) {
      throw new ServiceUnavailableException(`Maps provider request failed: ${response.statusText}`);
    }
    return (await response.json()) as T;
  }
}
