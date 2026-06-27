"use client";

import { Bike, CircleDot, Flag, Navigation } from "lucide-react";

import { StatusPill } from "@/components/ui";
type JourneyLike = { status: string } | null;

type RideMapProps = {
  ride?: JourneyLike;
  driverLocation?: { lat: number; lng: number } | null;
  phase?: "booking" | "tracking";
};

export function RideMap({ ride, driverLocation, phase = "tracking" }: RideMapProps) {
  const status = ride?.status ?? "ESTIMATE";
  const marker = driverMarkerStyle(driverLocation, status);

  return (
    <section className="relative min-h-80 overflow-hidden rounded-md border border-border bg-[linear-gradient(135deg,#eff6ff_0%,#f8fafc_48%,#fff7ed_100%)] p-4" aria-label="Ride route map">
      <div className="absolute inset-0 opacity-70" aria-hidden="true" style={{ backgroundImage: "linear-gradient(#dbeafe 1px, transparent 1px), linear-gradient(90deg, #dbeafe 1px, transparent 1px)", backgroundSize: "30px 30px" }} />
      <div className="relative z-10 h-72">
        <div className="absolute left-[16%] top-[64%] rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-sm"><CircleDot className="mr-1 inline size-4 text-ride" aria-hidden="true" /> Pickup</div>
        <div className="absolute right-[14%] top-[18%] rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-sm"><Flag className="mr-1 inline size-4 text-brand" aria-hidden="true" /> Drop</div>
        <div className="absolute left-[25%] top-[49%] h-1 w-[52%] -rotate-[18deg] rounded-full bg-ride/30" aria-hidden="true" />
        <div className="absolute rounded-full bg-ride p-3 text-white shadow-lg transition-all duration-700 ease-out" style={marker} aria-label="Driver marker">
          <Bike className="size-5" aria-hidden="true" />
        </div>
        <div className="absolute bottom-0 left-0 flex flex-wrap gap-2">
          <StatusPill label={phase === "booking" ? "Fare preview" : status} tone={status === "COMPLETED" ? "success" : status === "CANCELLED" ? "danger" : "info"} />
          <StatusPill label="Live ETA" tone="warning" />
        </div>
        <Navigation className="absolute right-4 bottom-4 size-5 text-muted-foreground" aria-hidden="true" />
      </div>
    </section>
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