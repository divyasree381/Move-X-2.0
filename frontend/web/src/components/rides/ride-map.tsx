"use client";

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

export function RideMap({ ride, driverLocation, phase = "tracking", pickup, drop, activePoint = "pickup", onActivePointChange, routeLabel }: RideMapProps) {
  const status = ride?.status ?? "ESTIMATE";
  const marker = driverMarkerStyle(driverLocation, status);
  const booking = phase === "booking";

  return (
    <section className="relative min-h-[30rem] overflow-hidden rounded-lg border border-border bg-[linear-gradient(135deg,var(--ride-soft)_0%,var(--background)_48%,var(--food-soft)_100%)] p-4 shadow-[var(--shadow-shell)]" aria-label="Ride route map">
      <div className="absolute inset-0 opacity-70" aria-hidden="true" style={{ backgroundImage: "linear-gradient(color-mix(in srgb, var(--info) 18%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--info) 18%, transparent) 1px, transparent 1px)", backgroundSize: "30px 30px" }} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_70%,rgba(37,99,235,0.18),transparent_28%),radial-gradient(circle_at_78%_20%,rgba(5,150,105,0.16),transparent_24%)]" aria-hidden="true" />
      <div className="relative z-10 h-[27rem]">
        <RouteNode
          type="pickup"
          active={booking && activePoint === "pickup"}
          address={pickup?.address ?? "Set pickup"}
          className="left-[10%] top-[64%]"
          onClick={booking && onActivePointChange ? () => onActivePointChange("pickup") : undefined}
        />
        <RouteNode
          type="drop"
          active={booking && activePoint === "drop"}
          address={drop?.address ?? "Set drop"}
          className="right-[8%] top-[16%]"
          onClick={booking && onActivePointChange ? () => onActivePointChange("drop") : undefined}
        />
        <div className="absolute left-[24%] top-[53%] h-1.5 w-[52%] -rotate-[18deg] rounded-full bg-ride/30" aria-hidden="true" />
        <div className="absolute left-[38%] top-[43%] h-1.5 w-[24%] -rotate-[18deg] rounded-full bg-primary shadow-[0_0_24px_rgba(5,150,105,0.24)]" aria-hidden="true" />
        {!booking ? (
          <div className="absolute rounded-full bg-ride p-3 text-primary-foreground shadow-lg transition-all duration-700 ease-out" style={marker} aria-label="Driver marker">
            <Bike className="size-5" aria-hidden="true" />
          </div>
        ) : null}
        <div className="absolute bottom-0 left-0 flex flex-wrap gap-2">
          <StatusPill label={booking ? "Route preview" : status} tone={status === "COMPLETED" ? "success" : status === "CANCELLED" ? "danger" : "info"} />
          <StatusPill label={routeLabel ?? (booking ? "Select from and to" : "Live ETA")} tone="warning" />
        </div>
        <Navigation className="absolute bottom-4 right-4 size-5 text-muted-foreground" aria-hidden="true" />
      </div>
    </section>
  );
}

function RouteNode({ type, active, address, className, onClick }: { type: "pickup" | "drop"; active: boolean; address: string; className: string; onClick?: () => void }) {
  const Icon = type === "pickup" ? CircleDot : Flag;
  const label = type === "pickup" ? "From" : "To";

  return (
    <button
      type="button"
      disabled={!onClick}
      onClick={onClick}
      className={cn(
        "absolute max-w-[15rem] rounded-lg border bg-surface/95 px-3 py-2 text-left text-sm shadow-sm backdrop-blur transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
        active ? "border-primary ring-2 ring-primary/20" : "border-border",
        onClick ? "hover:border-primary/50" : "cursor-default",
        className,
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