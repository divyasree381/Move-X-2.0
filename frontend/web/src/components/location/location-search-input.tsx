"use client";

import { useEffect, useId, useMemo, useState } from "react";
import type { MapSuggestion, SelectedLocation } from "@movex/shared";

import { autocompleteLocations, geocodeAddress, getPlaceDetails } from "@/lib/api";

type LocationSearchInputProps = {
  label: string;
  value: SelectedLocation | null;
  onChange: (location: SelectedLocation) => void;
  placeholder?: string;
  bias?: { lat: number; lng: number; radiusMeters?: number };
};

export function LocationSearchInput({ label, value, onChange, placeholder, bias }: LocationSearchInputProps) {
  const listId = useId();
  const [query, setQuery] = useState(value?.address ?? "");
  const [suggestions, setSuggestions] = useState<MapSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setQuery(value?.address ?? "");
  }, [value?.address]);

  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < 2 || trimmed === value?.address) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsLoading(true);
      setError(null);

      try {
        const results = await autocompleteLocations(trimmed, bias);

        if (!controller.signal.aborted) {
          setSuggestions(results);
        }
      } catch (caught) {
        if (!controller.signal.aborted) {
          setError(caught instanceof Error ? caught.message : "Location search failed");
          setSuggestions([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [bias, query, value?.address]);

  const helperText = useMemo(() => {
    if (error) {
      return error;
    }

    if (value) {
      return `${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}`;
    }

    return isLoading ? "Searching..." : "Awaiting location.";
  }, [error, isLoading, value]);

  async function selectSuggestion(placeId: string) {
    setIsLoading(true);
    setError(null);

    try {
      const selected = await getPlaceDetails(placeId);
      onChange(selected);
      setSuggestions([]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load place details");
    } finally {
      setIsLoading(false);
    }
  }

  async function useTypedFallback() {
    const trimmed = query.trim();

    if (trimmed.length < 3) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const selected = await geocodeAddress(trimmed);
      onChange(selected);
      setSuggestions([]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not find that address");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground" htmlFor={listId}>
        {label}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={listId}
          className="min-h-11 flex-1 rounded-md border border-input bg-card px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          value={query}
          placeholder={placeholder ?? "Search address"}
          autoComplete="off"
          aria-autocomplete="list"
          aria-controls={`${listId}-suggestions`}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void useTypedFallback();
            }
          }}
        />
        <button
          type="button"
          className="min-h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-muted-foreground"
          disabled={query.trim().length < 3 || isLoading}
          onClick={() => void useTypedFallback()}
        >
          Use typed address
        </button>
      </div>
      <p className={error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{helperText}</p>
      {suggestions.length > 0 ? (
        <ul
          id={`${listId}-suggestions`}
          className="overflow-hidden rounded-md border border-border bg-card shadow-sm"
          role="listbox"
        >
          {suggestions.map((suggestion) => (
            <li key={suggestion.placeId} role="option" aria-selected="false">
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm transition hover:bg-primary/10 focus:bg-primary/10 focus:outline-none"
                onClick={() => void selectSuggestion(suggestion.placeId)}
              >
                <span className="block font-medium text-foreground">{suggestion.mainText}</span>
                {suggestion.secondaryText ? (
                  <span className="block text-muted-foreground">{suggestion.secondaryText}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}