"use client";

import { useEffect, useId, useState } from "react";
import type { MapSuggestion, SelectedLocation } from "@movex/shared";
import { Clock, Heart, Map as MapIcon, Plus } from "lucide-react";

import { autocompleteLocations, geocodeAddress, getPlaceDetails } from "@/lib/api";

type LocationSearchInputProps = {
  value: SelectedLocation | null;
  onChange: (location: SelectedLocation) => void;
  placeholder?: string;
  bias?: { lat: number; lng: number; radiusMeters?: number };
};

export function LocationSearchInput({ value, onChange, placeholder, bias }: LocationSearchInputProps) {
  const listId = useId();
  const [query, setQuery] = useState(value?.address ?? "");
  const [suggestions, setSuggestions] = useState<MapSuggestion[]>([]);
  const [, setIsLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);

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

  async function selectSuggestion(placeId: string) {
    setIsLoading(true);
    setError(null);

    try {
      const selected = await getPlaceDetails(placeId);
      onChange(selected);
      setSuggestions([]);
      setIsFocused(false);
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
    <div className="relative">
      <input
        id={listId}
        className="w-full bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground focus:ring-0"
        value={query}
        placeholder={placeholder ?? "Where do you want to go?"}
        autoComplete="off"
        aria-autocomplete="list"
        aria-controls={`${listId}-suggestions`}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          setTimeout(() => {
            setIsFocused(false);
            if (query.trim().length >= 3 && query !== value?.address) {
              void useTypedFallback();
            }
          }, 200);
        }}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void useTypedFallback();
            event.currentTarget.blur();
          }
        }}
      />
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
      
      {isFocused && query.trim().length < 2 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-3 rounded-md border border-border bg-surface p-2 shadow-[var(--shadow-shell)]">
          <div className="flex gap-2 p-1">
            <button className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border bg-surface-muted py-2 text-xs font-semibold text-foreground transition hover:bg-border">
              <MapIcon className="size-3.5" /> Select on map
            </button>
            <button className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border bg-surface-muted py-2 text-xs font-semibold text-foreground transition hover:bg-border">
              <Plus className="size-3.5" /> Add stop
            </button>
          </div>
          
          <div className="mt-2 border-t border-border pt-2">
            <button className="flex w-full items-center gap-3 px-2 py-2.5 text-left transition hover:bg-surface-muted rounded-md">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-muted">
                <Heart className="size-3.5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">Home</p>
                <p className="truncate text-xs text-muted-foreground">Add home address</p>
              </div>
            </button>
            <button className="flex w-full items-center gap-3 px-2 py-2.5 text-left transition hover:bg-surface-muted rounded-md">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-muted">
                <Clock className="size-3.5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">Kempegowda International Airport</p>
                <p className="truncate text-xs text-muted-foreground">Bengaluru, Karnataka</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {suggestions.length > 0 && isFocused ? (
        <ul
          id={`${listId}-suggestions`}
          className="absolute left-0 right-0 top-full z-50 mt-3 overflow-hidden rounded-md border border-border bg-surface shadow-[var(--shadow-shell)]"
          role="listbox"
        >
          {suggestions.map((suggestion) => (
            <li key={suggestion.placeId} role="option" aria-selected="false">
              <button
                type="button"
                className="flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-surface-muted focus:bg-surface-muted focus:outline-none"
                onClick={() => void selectSuggestion(suggestion.placeId)}
              >
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-muted">
                  <MapIcon className="size-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">{suggestion.mainText}</span>
                  {suggestion.secondaryText ? (
                    <span className="block truncate text-xs text-muted-foreground">{suggestion.secondaryText}</span>
                  ) : null}
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

