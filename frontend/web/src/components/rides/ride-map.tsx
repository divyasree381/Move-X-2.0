"use client";

import type { CSSProperties } from "react";
import type { SelectedLocation } from "@movex/shared";
import { Bike, CircleDot, Flag, Navigation } from "lucide-react";

import { StatusPill } from "@/components/ui";
import { cn } from "@/lib/utils";

type JourneyLike = { status: string } | null;

type RideMapProps = {
  ride?: JourneyLike;
  driverLocation?: { lat: number; lng: number } | null;
  phase?: "booking" | "tracking";
  pickup?: SelectedLocation | null;
  drop?: SelectedLocation | null;
  activePoint?: "pickup" | "drop";
  onActivePointChange?: (point: "pickup" | "drop") => void;
  routeLabel?: string;
};

type MapPosition = {
  x: number;
  y: number;
};

export function RideMap({ ride, driverLocation, phase = "tracking", pickup, drop, activePoint = "pickup", onActivePointChange, routeLabel }: RideMapProps) {
  const status = ride?.status ?? "ESTIMATE";
  const marker = driverMarkerStyle(driverLocation, status);
  const booking = phase === "booking";
  const routeMap = booking && pickup && drop ? buildRouteMap(pickup, drop) : null;
  const pickupPosition = routeMap && pickup ? routeMap.project(pickup) : { x: 18, y: 68 };
  const dropPosition = routeMap && drop ? routeMap.project(drop) : { x: 82, y: 22 };

  return (
    <section className="relative min-h-[30rem] overflow-hidden rounded-lg border border-border bg-surface-muted shadow-[var(--shadow-shell)]" aria-label="Ride route map">
      {routeMap ? (
        <iframe title="Ride route map" className="absolute inset-0 h-full w-full border-0 opacity-90 saturate-[0.92]" src={routeMap.url} loading="lazy" tabIndex={-1} />
      ) : (
        <div className="absolute inset-0 bg-[linear-gradient(135deg,var(--ride-soft)_0%,var(--background)_48%,var(--food-soft)_100%)]" aria-hidden="true" />
      )}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(249,250,251,0.22)_0%,rgba(249,250,251,0)_38%,rgba(249,250,251,0.72)_100%)] dark:bg-[linear-gradient(180deg,rgba(11,15,13,0.35)_0%,rgba(11,15,13,0)_38%,rgba(11,15,13,0.82)_100%)]" aria-hidden="true" />
      <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-2 sm:left-4 sm:top-4">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/94 px-3 py-2 text-xs font-medium text-foreground shadow-sm backdrop-blur">
          <Navigation className="size-4 text-primary" aria-hidden="true" /> Live map preview
        </span>
        {booking ? <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-medium text-primary shadow-sm backdrop-blur">One map, two addresses</span> : null}
      </div>
      <div className="relative z-10 h-[30rem] p-4">
        {booking ? (
          <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
            <line x1={`${pickupPosition.x}%`} y1={`${pickupPosition.y}%`} x2={`${dropPosition.x}%`} y2={`${dropPosition.y}%`} stroke="rgba(15, 118, 110, 0.24)" strokeWidth="12" strokeLinecap="round" />
            <line x1={`${pickupPosition.x}%`} y1={`${pickupPosition.y}%`} x2={`${dropPosition.x}%`} y2={`${dropPosition.y}%`} stroke="rgb(5, 150, 105)" strokeWidth="5" strokeLinecap="round" strokeDasharray="10 10" />
          </svg>
        ) : null}
        <RouteNode
          type="pickup"
          active={booking && activePoint === "pickup"}
          address={pickup?.address ?? "Set pickup"}
          position={pickupPosition}
          onClick={booking && onActivePointChange ? () => onActivePointChange("pickup") : undefined}
        />
        <RouteNode
          type="drop"
          active={booking && activePoint === "drop"}
          address={drop?.address ?? "Set drop"}
          position={dropPosition}
          onClick={booking && onActivePointChange ? () => onActivePointChange("drop") : undefined}
        />
        {!booking ? (
          <div className="absolute rounded-full bg-ride p-3 text-primary-foreground shadow-lg transition-all duration-700 ease-out" style={marker} aria-label="Driver marker">
            <Bike className="size-5" aria-hidden="true" />
          </div>
        ) : null}
        <div className="absolute bottom-4 left-4 flex flex-wrap gap-2">
          <StatusPill label={booking ? "Route preview" : status} tone={status === "COMPLETED" ? "success" : status === "CANCELLED" ? "danger" : "info"} />
          <StatusPill label={routeLabel ?? (booking ? "Select from and to" : "Live ETA")} tone="warning" />
        </div>
        <Navigation className="absolute bottom-6 right-6 size-5 text-muted-foreground" aria-hidden="true" />
      </div>
    </section>
  );
}

function RouteNode({ type, active, address, position, onClick }: { type: "pickup" | "drop"; active: boolean; address: string; position: MapPosition; onClick?: () => void }) {
  const Icon = type === "pickup" ? CircleDot : Flag;
  const label = type === "pickup" ? "From" : "To";
  const style: CSSProperties = { left: `${position.x}%`, top: `${position.y}%` };

  return (
    <button
      type="button"
      disabled={!onClick}
      onClick={onClick}
      style={style}
      className={cn(
        "absolute max-w-[15rem] -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-surface/95 px-3 py-2 text-left text-sm shadow-md backdrop-blur transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
        active ? "border-primary ring-2 ring-primary/20" : "border-border",
        onClick ? "hover:border-primary/50" : "cursor-default",
      )}
    >
      <span className="flex items-start gap-2">
        <Icon className={cn("mt-0.5 size-4 shrink-0", type === "pickup" ? "text-ride" : "text-primary")} aria-hidden="true" />
        <span className="min-w-0">
          <span className="block text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
          <span className="mt-1 line-clamp-2 block font-medium text-foreground">{address}</span>
        </span>
      </span>
    </button>
  );
}

function buildRouteMap(pickup: SelectedLocation, drop: SelectedLocation) {
  const latMin = Math.min(pickup.lat, drop.lat);
  const latMax = Math.max(pickup.lat, drop.lat);
  const lngMin = Math.min(pickup.lng, drop.lng);
  const lngMax = Math.max(pickup.lng, drop.lng);
  const latPadding = Math.max(0.015, (latMax - latMin) * 0.45);
  const lngPadding = Math.max(0.015, (lngMax - lngMin) * 0.45);
  const bounds = {
    south: Math.max(-90, latMin - latPadding),
    north: Math.min(90, latMax + latPadding),
    west: Math.max(-180, lngMin - lngPadding),
    east: Math.min(180, lngMax + lngPadding),
  };
  const params = new URLSearchParams({
    bbox: `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`,
    layer: "mapnik",
  });

  return {
    url: `https://www.openstreetmap.org/export/embed.html?${params.toString()}`,
    project(location: SelectedLocation): MapPosition {
      const xRange = bounds.east - bounds.west || 1;
      const yRange = bounds.north - bounds.south || 1;
      const rawX = ((location.lng - bounds.west) / xRange) * 100;
      const rawY = (1 - (location.lat - bounds.south) / yRange) * 100;

      return {
        x: clamp(rawX, 14, 86),
        y: clamp(rawY, 16, 84),
      };
    },
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function driverMarkerStyle(location: { lat: number; lng: number } | null | undefined, status: string) {
  if (location) {
    const left = 28 + Math.abs(location.lng * 1000) % 44;
    const top = 24 + Math.abs(location.lat * 1000) % 48;
    return { left: `${left}%`, top: `${top}%` };
  }

  if (status === "ARRIVED") {
    return { left: "22%", top: "58%" };
  }
  if (status === "IN_RIDE" || status === "IN_TRANSIT" || status === "COMPLETED") {
    return { left: "68%", top: "28%" };
  }

  return { left: "42%", top: "46%" };
}