"use client";

import type { SelectedLocation } from "@movex/shared";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Flag, LocateFixed, MapPin, Navigation, Target } from "lucide-react";

import { StatusPill } from "@/components/ui";
import { cn } from "@/lib/utils";

const DynamicLeafletMap = dynamic(() => import("./leaflet-map"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-surface-muted" />,
});

type PinMode = "pickup" | "drop";

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
  pinMode?: PinMode | null;
  pinLocation?: SelectedLocation | null;
  onPinCenterChange?: (lat: number, lng: number) => void;
};

export function RideMap({ ride, phase = "tracking", pickup, drop, routeLabel, routePolyline, pinMode = null, pinLocation, onPinCenterChange,
}: RideMapProps) {
  const status = ride?.status ?? "ESTIMATE";
  const booking = phase === "booking";
  const [pinMoving, setPinMoving] = useState(false);

  useEffect(() => {
    if (!pinMode) setPinMoving(false);
  }, [pinMode]);

  return (
    <section className="relative z-0 h-full w-full overflow-hidden bg-surface-muted" aria-label="Ride route map">
      <div className="absolute inset-0 z-0">
        <DynamicLeafletMap
          className="h-full w-full"
          pickup={pickup}
          drop={drop}
          routePolyline={routePolyline}
          pinMode={pinMode}
          pinLocation={pinLocation}
          onPinCenterChange={onPinCenterChange}
          onPinMovingChange={setPinMoving}
        />
      </div>

      <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-wrap gap-2 sm:left-4 sm:top-4">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/94 px-3 py-2 text-xs font-medium text-foreground shadow-sm backdrop-blur">
          <Navigation className="size-4 text-info" aria-hidden="true" /> Live Map
        </span>
        {pinMode ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/94 px-3 py-2 text-xs font-medium text-foreground shadow-sm backdrop-blur">
            <LocateFixed className="size-4 text-destructive" aria-hidden="true" /> Pinning {" "}
            {pinMode === "pickup" ? "Pickup" : "Destination"}
          </span>
        ) : null}
      </div>

      {pinMode ? (
        <>
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 size-0" aria-hidden="true">
            <span className={cn("absolute left-0 top-0 size-14 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-destructive/35 bg-destructive/10 transition-opacity", pinMoving ? "opacity-0" : "opacity-100",
              )} />
            <span className={cn("absolute left-0 top-0 size-14 -translate-x-1/2 -translate-y-1/2 rounded-full border border-destructive/40 opacity-0", !pinMoving && "motion-safe:animate-ping",
              )} />
            <span className={cn("absolute left-0 top-0 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/25 blur-[2px] motion-safe:transition-all motion-safe:duration-200", pinMoving ? "w-12 opacity-45" : "w-7 opacity-70",
              )} />
            <span className={cn("absolute bottom-0 left-0 size-14 -translate-x-1/2 motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out", pinMoving && "-translate-y-3 scale-105",
              )}>
              <MapPin className="size-14 fill-destructive text-destructive drop-shadow-[0_8px_7px_rgb(17,24,39,0.28)]" strokeWidth={1.6} />
              <span className="absolute left-1/2 top-[0.62rem] flex size-5 -translate-x-1/2 items-center justify-center rounded-full bg-surface text-destructive shadow-sm">
                {pinMode === "pickup" ? (
                  <Target className="size-3" strokeWidth={2.5} />
                ) : (
                  <Flag className="size-3" strokeWidth={2.5} />
                )}
              </span>
            </span>
          </div>
          <p className="sr-only" aria-live="polite">{pinMoving ? "Map moving" : `${pinMode === "pickup" ? "Pickup" : "Destination"} pin settled`}</p>
        </>
      ) : null}

      {!pinMode ? (
        <div className="pointer-events-none absolute bottom-16 left-4 z-10 hidden flex-wrap gap-2 sm:flex lg:bottom-5 lg:left-5">
          <StatusPill label={booking ? "Trip Route" : status} tone={status === "COMPLETED" ? "success" : status === "CANCELLED" ? "danger" : "info"} />
          <StatusPill label={routeLabel ?? (booking ? "Select pickup and destination" : "Live ETA")} tone="warning" />
        </div>
      ) : null}
    </section>
  );
}
