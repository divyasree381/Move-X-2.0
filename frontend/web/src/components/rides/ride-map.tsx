"use client";

import type { CSSProperties } from "react";
import type { SelectedLocation } from "@movex/shared";
import { Bike, CircleDot, MapPin, Navigation } from "lucide-react";

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
  const pickupPosition = routeMap && pickup ? routeMap.project(pickup) : { x: 25, y: 68 };
  const dropPosition = routeMap && drop ? routeMap.project(drop) : { x: 76, y: 28 };

  return (
    <section className="relative h-full min-h-[24rem] overflow-hidden rounded-lg border border-border bg-surface-muted shadow-[var(--shadow-shell)] sm:min-h-[30rem] xl:min-h-[32rem]" aria-label="Ride route map">
      {routeMap ? (
        <iframe title="Ride route map" className="absolute inset-0 h-full w-full border-0 opacity-95 saturate-[0.96]" src={routeMap.url} loading="lazy" tabIndex={-1} />
      ) : (
        <div className="absolute inset-0 bg-[linear-gradient(135deg,var(--ride-soft)_0%,var(--background)_48%,var(--food-soft)_100%)]" aria-hidden="true" />
      )}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(249,250,251,0.12)_0%,rgba(249,250,251,0)_42%,rgba(249,250,251,0.58)_100%)] dark:bg-[linear-gradient(180deg,rgba(11,15,13,0.24)_0%,rgba(11,15,13,0)_42%,rgba(11,15,13,0.72)_100%)]" aria-hidden="true" />
      <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-2 sm:left-4 sm:top-4">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/94 px-3 py-2 text-xs font-medium text-foreground shadow-sm backdrop-blur">
          <Navigation className="size-4 text-primary" aria-hidden="true" /> Live map
        </span>
        {booking ? <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-medium text-primary shadow-sm backdrop-blur">One map, two pins</span> : null}
      </div>
      <div className="relative z-10 h-full min-h-[24rem] p-4 sm:min-h-[30rem] xl:min-h-[32rem]">
        {booking ? (
          <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
            <line x1={`${pickupPosition.x}%`} y1={`${pickupPosition.y}%`} x2={`${dropPosition.x}%`} y2={`${dropPosition.y}%`} stroke="rgba(6, 95, 70, 0.22)" strokeWidth="14" strokeLinecap="round" />
            <line x1={`${pickupPosition.x}%`} y1={`${pickupPosition.y}%`} x2={`${dropPosition.x}%`} y2={`${dropPosition.y}%`} stroke="rgb(5, 150, 105)" strokeWidth="5" strokeLinecap="round" />
          </svg>
        ) : null}
        {booking ? <NearbyVehicles /> : null}
        <RoutePin
          type="pickup"
          active={booking && activePoint === "pickup"}
          address={pickup?.address ?? "Set pickup"}
          position={pickupPosition}
          onClick={booking && onActivePointChange ? () => onActivePointChange("pickup") : undefined}
        />
        <RoutePin
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
          <StatusPill label={routeLabel ?? (booking ? "Select pickup and drop" : "Live ETA")} tone="warning" />
        </div>
        <Navigation className="absolute bottom-6 right-6 size-5 text-muted-foreground" aria-hidden="true" />
      </div>
    </section>
  );
}

function RoutePin({ type, active, address, position, onClick }: { type: "pickup" | "drop"; active: boolean; address: string; position: MapPosition; onClick?: () => void }) {
  const style: CSSProperties = { left: `${position.x}%`, top: `${position.y}%` };
  const isPickup = type === "pickup";
  const label = isPickup ? "Pickup" : "Drop";
  const Icon = isPickup ? CircleDot : MapPin;

  return (
    <button
      type="button"
      disabled={!onClick}
      onClick={onClick}
      style={style}
      title={`${label}: ${address}`}
      aria-label={`${label}: ${address}`}
      className={cn(
        "group absolute z-20 -translate-x-1/2 -translate-y-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
        onClick ? "cursor-pointer" : "cursor-default",
      )}
    >
      <span
        className={cn(
          "relative grid size-12 place-items-center rounded-full border-2 bg-surface shadow-lg transition group-hover:-translate-y-0.5",
          isPickup ? "border-primary text-primary" : "border-destructive text-destructive",
          active ? "ring-4 ring-primary/18" : "",
        )}
      >
        <Icon className="size-6" aria-hidden="true" />
        <span className={cn("absolute -bottom-2 size-4 rotate-45 border-b-2 border-r-2 bg-surface", isPickup ? "border-primary" : "border-destructive")} aria-hidden="true" />
      </span>
      <span className="pointer-events-none absolute left-1/2 top-full mt-3 hidden -translate-x-1/2 whitespace-nowrap rounded-full border border-border bg-surface/95 px-2.5 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur group-hover:block group-focus-visible:block">
        {label}
      </span>
    </button>
  );
}

function NearbyVehicles() {
  const vehicles = [
    { left: "18%", top: "34%", delay: "0ms" },
    { left: "37%", top: "22%", delay: "120ms" },
    { left: "63%", top: "64%", delay: "220ms" },
    { left: "82%", top: "45%", delay: "320ms" },
  ];

  return (
    <div aria-hidden="true">
      {vehicles.map((vehicle, index) => (
        <span
          key={index}
          className="absolute z-10 grid size-9 place-items-center rounded-full border border-ride/20 bg-surface/88 text-ride shadow-sm backdrop-blur transition hover:scale-105"
          style={{ left: vehicle.left, top: vehicle.top, animationDelay: vehicle.delay }}
        >
          <Bike className="size-4" />
        </span>
      ))}
    </div>
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
        y: clamp(rawY, 18, 84),
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
