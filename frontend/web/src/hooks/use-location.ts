"use client";

import { useCallback, useMemo, useState } from "react";
import type { MapSuggestion, MapTravelMode, RouteSummary, SelectedLocation } from "@movex/shared";

import { autocompleteLocations, geocodeAddress, getPlaceDetails, getRoute, reverseGeocode } from "@/lib/api";

type AsyncStatus = "idle" | "loading" | "success" | "error";

export function useLocation(initialLocation?: SelectedLocation | null) {
  const [location, setLocation] = useState<SelectedLocation | null>(initialLocation ?? null);
  const [suggestions, setSuggestions] = useState<MapSuggestion[]>([]);
  const [route, setRoute] = useState<RouteSummary | null>(null);
  const [status, setStatus] = useState<AsyncStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async <T,>(loader: () => Promise<T>): Promise<T | null> => {
    setStatus("loading");
    setError(null);

    try {
      const value = await loader();
      setStatus("success");
      return value;
    } catch (caught) {
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "Something went wrong");
      return null;
    }
  }, []);

  const search = useCallback(
    async (input: string, bias?: { lat: number; lng: number; radiusMeters?: number }) => {
      if (input.trim().length < 2) {
        setSuggestions([]);
        return [];
      }

      const results = await run(() => autocompleteLocations(input.trim(), bias));
      setSuggestions(results ?? []);
      return results ?? [];
    },
    [run],
  );

  const selectSuggestion = useCallback(
    async (placeId: string) => {
      const selected = await run(() => getPlaceDetails(placeId));

      if (selected) {
        setLocation(selected);
        setSuggestions([]);
      }

      return selected;
    },
    [run],
  );

  const useTypedAddress = useCallback(
    async (address: string) => {
      const selected = await run(() => geocodeAddress(address.trim()));

      if (selected) {
        setLocation(selected);
        setSuggestions([]);
      }

      return selected;
    },
    [run],
  );

  const moveMarker = useCallback(
    async (lat: number, lng: number, source: SelectedLocation["source"] = "marker-drag") => {
      const address = await run(() => reverseGeocode(lat, lng));
      const selected: SelectedLocation = {
        address: address ?? `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        lat,
        lng,
        source,
      };
      setLocation(selected);
      return selected;
    },
    [run],
  );

  const loadRoute = useCallback(
    async (from: SelectedLocation, to: SelectedLocation, mode: MapTravelMode = "DRIVE") => {
      const result = await run(() => getRoute(from, to, mode));
      setRoute(result);
      return result;
    },
    [run],
  );

  return useMemo(
    () => ({
      location,
      setLocation,
      suggestions,
      route,
      status,
      error,
      search,
      selectSuggestion,
      useTypedAddress,
      moveMarker,
      loadRoute,
    }),
    [error, loadRoute, location, moveMarker, route, search, selectSuggestion, status, suggestions, useTypedAddress],
  );
}