"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import type { SelectedLocation } from "@movex/shared";

import { reverseGeocode } from "@/lib/api";

type MapPickerClientProps = {
  value: SelectedLocation | null;
  onChange: (location: SelectedLocation) => void;
};

type Coordinates = {
  lat: number;
  lng: number;
};

const DEFAULT_LOCATION: SelectedLocation = {
  address: "Bengaluru, Karnataka, India",
  lat: 12.9716,
  lng: 77.5946,
  source: "gps",
};

const LAT_SPAN = 0.08;
const LNG_SPAN = 0.08;

export function MapPickerClient({ value, onChange }: MapPickerClientProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const current = value ?? DEFAULT_LOCATION;
  const [draftCoordinates, setDraftCoordinates] = useState<Coordinates | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hasMoved, setHasMoved] = useState(false);
  const [manualLat, setManualLat] = useState(String(current.lat));
  const [manualLng, setManualLng] = useState(String(current.lng));
  const [status, setStatus] = useState<string | null>(null);

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
    setStatus("Updating address");

    try {
      const address = await reverseGeocode(lat, lng);
      onChange({ address, lat, lng, source });
      setStatus(null);
    } catch (caught) {
      onChange({ address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`, lat, lng, source });
      setStatus(caught instanceof Error ? caught.message : "Reverse geocode failed");
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
      setStatus("Invalid latitude or longitude");
      return;
    }

    void commitCoordinates(lat, lng, "map-click");
  }

  return (
    <div className="space-y-3">
      <div
        ref={mapRef}
        className="relative h-72 overflow-hidden rounded-md border border-slate-300 bg-emerald-50"
        role="application"
        aria-label="Interactive location picker"
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
        <iframe
          title="Map preview"
          className="pointer-events-none absolute inset-0 h-full w-full border-0"
          src={mapPreviewUrl}
          loading="lazy"
          tabIndex={-1}
        />
        <button
          type="button"
          className="absolute grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-emerald-600 text-white shadow-lg ring-4 ring-white transition hover:bg-emerald-700"
          style={markerPosition}
          aria-label="Selected marker"
        >
          +
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <label className="space-y-1 text-sm font-medium text-slate-800">
          <span>Latitude</span>
          <input
            className="min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            value={manualLat}
            inputMode="decimal"
            onChange={(event) => setManualLat(event.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-800">
          <span>Longitude</span>
          <input
            className="min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            value={manualLng}
            inputMode="decimal"
            onChange={(event) => setManualLng(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="self-end rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-950 transition hover:border-emerald-600 hover:text-emerald-700"
          onClick={applyManualCoordinates}
        >
          Apply
        </button>
      </div>
      <p className="text-sm text-slate-600">{status ?? current.address}</p>
    </div>
  );
}