"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import type { SelectedLocation } from "@movex/shared";
import { LocateFixed, MapPin, Navigation, SlidersHorizontal } from "lucide-react";

import { reverseGeocode } from "@/lib/api";

const DEFAULT_LOCATION: SelectedLocation = {
  address: "Bengaluru, Karnataka, India",
  lat: 12.9716,
  lng: 77.5946,
  source: "gps",
};

const LAT_SPAN = 0.08;
const LNG_SPAN = 0.08;

type MapPickerClientProps = {
  value: SelectedLocation | null;
  onChange: (location: SelectedLocation) => void;
};

type Coordinates = {
  lat: number;
  lng: number;
};

export function MapPickerClient({ value, onChange }: MapPickerClientProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const current = value ?? DEFAULT_LOCATION;
  const [draftCoordinates, setDraftCoordinates] = useState<Coordinates | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hasMoved, setHasMoved] = useState(false);
  const [manualLat, setManualLat] = useState(String(current.lat));
  const [manualLng, setManualLng] = useState(String(current.lng));
  const [status, setStatus] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const center = current;
  const visibleCoordinates = draftCoordinates ?? current;

  useEffect(() => {
    if (!draftCoordinates) {
      setManualLat(String(current.lat));
      setManualLng(String(current.lng));
    }
  }, [current.lat, current.lng, draftCoordinates]);

  const markerPosition = useMemo(() => {
    const x = 50 + ((visibleCoordinates.lng - center.lng) / LNG_SPAN) * 100;
    const y = 50 - ((visibleCoordinates.lat - center.lat) / LAT_SPAN) * 100;

    return {
      left: `${Math.max(4, Math.min(96, x))}%`,
      top: `${Math.max(4, Math.min(96, y))}%`,
    };
  }, [center.lat, center.lng, visibleCoordinates.lat, visibleCoordinates.lng]);

  const mapPreviewUrl = useMemo(() => {
    const west = center.lng - LNG_SPAN / 2;
    const east = center.lng + LNG_SPAN / 2;
    const south = center.lat - LAT_SPAN / 2;
    const north = center.lat + LAT_SPAN / 2;
    const params = new URLSearchParams({
      bbox: `${west},${south},${east},${north}`,
      layer: "mapnik",
      marker: `${visibleCoordinates.lat},${visibleCoordinates.lng}`,
    });

    return `https://www.openstreetmap.org/export/embed.html?${params.toString()}`;
  }, [center.lat, center.lng, visibleCoordinates.lat, visibleCoordinates.lng]);

  function coordinatesFromPointer(event: PointerEvent<HTMLDivElement>): Coordinates | null {
    const rect = mapRef.current?.getBoundingClientRect();

    if (!rect) {
      return null;
    }

    const xRatio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const yRatio = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));

    return {
      lng: center.lng + (xRatio - 0.5) * LNG_SPAN,
      lat: center.lat - (yRatio - 0.5) * LAT_SPAN,
    };
  }

  async function commitCoordinates(lat: number, lng: number, source: SelectedLocation["source"]) {
    setStatus("Finding the nearest address...");

    try {
      const address = await reverseGeocode(lat, lng);
      onChange({ address, lat, lng, source });
      setStatus("Exact pin updated");
    } catch {
      onChange({ address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng, source });
      setStatus("Address lookup is unavailable. The pin is still saved.");
    } finally {
      setDraftCoordinates(null);
      setManualLat(String(lat));
      setManualLng(String(lng));
    }
  }

  function applyManualCoordinates() {
    const lat = Number(manualLat);
    const lng = Number(manualLng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setStatus("Enter a valid latitude and longitude.");
      return;
    }

    void commitCoordinates(lat, lng, "map-click");
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-[var(--shadow-shell)]">
      <div
        ref={mapRef}
        className="relative min-h-[28rem] overflow-hidden bg-[radial-gradient(circle_at_22%_18%,var(--grocery-soft)_0%,transparent_28%),linear-gradient(135deg,var(--background)_0%,var(--pharmacy-soft)_48%,var(--ride-soft)_100%)] sm:min-h-[34rem]"
        role="application"
        aria-label="Interactive MoveX map picker"
        onPointerDown={(event) => {
          const coordinates = coordinatesFromPointer(event);

          if (!coordinates) {
            return;
          }

          setIsDragging(true);
          setHasMoved(false);
          setDraftCoordinates(coordinates);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!isDragging) {
            return;
          }

          const coordinates = coordinatesFromPointer(event);

          if (coordinates) {
            setHasMoved(true);
            setDraftCoordinates(coordinates);
          }
        }}
        onPointerUp={(event) => {
          const coordinates = coordinatesFromPointer(event) ?? draftCoordinates;
          setIsDragging(false);
          event.currentTarget.releasePointerCapture(event.pointerId);

          if (coordinates) {
            void commitCoordinates(coordinates.lat, coordinates.lng, hasMoved ? "marker-drag" : "map-click");
          }
        }}
      >
        <iframe title="Map preview" className="pointer-events-none absolute inset-0 h-full w-full border-0 opacity-80 saturate-[0.88]" src={mapPreviewUrl} loading="lazy" tabIndex={-1} />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(249,250,251,0.34)_0%,rgba(249,250,251,0)_32%,rgba(249,250,251,0.78)_100%)] dark:bg-[linear-gradient(180deg,rgba(11,15,13,0.4)_0%,rgba(11,15,13,0)_35%,rgba(11,15,13,0.86)_100%)]" aria-hidden={true} />

        <div className="absolute left-3 top-3 flex flex-wrap gap-2 sm:left-4 sm:top-4">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/92 px-3 py-2 text-xs font-medium text-foreground shadow-sm backdrop-blur">
            <Navigation className="size-4 text-primary" aria-hidden={true} />
            Move pin to refine
          </span>
          <span className="hidden rounded-full border border-success/20 bg-success/10 px-3 py-2 text-xs font-medium text-success shadow-sm backdrop-blur sm:inline-flex">Exact location</span>
        </div>

        <div className="absolute right-3 top-3 grid gap-2 sm:right-4 sm:top-4">
          <button type="button" className="grid size-11 place-items-center rounded-full border border-border bg-surface/94 text-foreground shadow-sm backdrop-blur transition hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30" aria-label="Recenter map" onClick={() => void commitCoordinates(current.lat, current.lng, "gps")}>
            <LocateFixed className="size-5" aria-hidden={true} />
          </button>
          <button type="button" className="grid size-11 place-items-center rounded-full border border-border bg-surface/94 text-foreground shadow-sm backdrop-blur transition hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30" aria-label="Show advanced location controls" onClick={() => setShowAdvanced((next) => !next)}>
            <SlidersHorizontal className="size-5" aria-hidden={true} />
          </button>
        </div>

        <div className="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden={true}>
          <div className="h-24 w-px bg-primary/20" />
          <div className="absolute h-px w-24 bg-primary/20" />
        </div>

        <button type="button" className="absolute grid size-12 -translate-x-1/2 -translate-y-full place-items-center rounded-full bg-primary text-primary-foreground shadow-xl ring-8 ring-primary/16 transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-8 focus-visible:ring-primary/24" style={markerPosition} aria-label="Selected marker">
          <MapPin className="size-6 fill-current" aria-hidden={true} />
        </button>

        <div className="absolute inset-x-3 bottom-3 rounded-lg border border-border bg-surface/95 p-4 shadow-[var(--shadow-shell)] backdrop-blur sm:inset-x-4 sm:bottom-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-primary">Selected pin</p>
              <p className="mt-1 line-clamp-2 text-sm font-medium text-foreground">{current.address}</p>
              <p className="mt-1 text-xs text-muted-foreground" aria-live="polite">{status ?? "Tap or drag anywhere on the map to update the pin."}</p>
            </div>
            <span className="hidden shrink-0 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary sm:inline-flex">{current.source.replace("-", " ")}</span>
          </div>

          {showAdvanced ? (
            <div className="mt-4 grid gap-2 border-t border-border pt-4 sm:grid-cols-[1fr_1fr_auto]">
              <label className="space-y-1 text-xs font-medium text-foreground">
                <span>Latitude</span>
                <input className="min-h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" value={manualLat} inputMode="decimal" onChange={(event) => setManualLat(event.target.value)} />
              </label>
              <label className="space-y-1 text-xs font-medium text-foreground">
                <span>Longitude</span>
                <input className="min-h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" value={manualLng} inputMode="decimal" onChange={(event) => setManualLng(event.target.value)} />
              </label>
              <button type="button" className="self-end rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:border-primary hover:text-primary" onClick={applyManualCoordinates}>
                Apply
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

