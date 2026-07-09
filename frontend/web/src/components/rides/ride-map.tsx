"use client";

import type { SelectedLocation } from "@movex/shared";
import dynamic from "next/dynamic";
import { Navigation } from "lucide-react";
import { StatusPill } from "@/components/ui";

const DynamicLeafletMap = dynamic(() => import("./leaflet-map"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-surface-muted animate-pulse" />
});

export type RideMapProps = {
  ride?: { status: string } | null;
  driverLocation?: { lat: number; lng: number } | null;
  phase?: "booking" | "tracking";
  pickup?: SelectedLocation | null;
  drop?: SelectedLocation | null;
  activePoint?: "pickup" | "drop";
  onActivePointChange?: (point: "pickup" | "drop") => void;
  routeLabel?: string;
  routePolyline?: string | null;
};

export function RideMap({ ride, phase = "tracking", pickup, drop, routeLabel, routePolyline }: RideMapProps) {
  const status = ride?.status ?? "ESTIMATE";
  const booking = phase === "booking";

  return (
    <section className="relative h-full w-full overflow-hidden bg-surface-muted z-0" aria-label="Ride route map">
      <div className="absolute inset-0 z-0">
        <DynamicLeafletMap 
          className="h-full w-full" 
          pickup={pickup} 
          drop={drop} 
          routePolyline={routePolyline} 
        />
      </div>
      
      <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-2 sm:left-4 sm:top-4 pointer-events-none">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/94 px-3 py-2 text-xs font-medium text-foreground shadow-sm backdrop-blur">
          <Navigation className="size-4 text-info" aria-hidden="true" /> Live map
        </span>
      </div>

      <div className="absolute bottom-4 left-4 z-10 flex flex-wrap gap-2 pointer-events-none">
        <StatusPill label={booking ? "Route preview" : status} tone={status === "COMPLETED" ? "success" : status === "CANCELLED" ? "danger" : "info"} />
        <StatusPill label={routeLabel ?? (booking ? "Select pickup and drop" : "Live ETA")} tone="warning" />
      </div>
    </section>
  );
}