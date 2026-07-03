"use client";

import { useMemo, useState } from "react";
import type { SelectedLocation } from "@movex/shared";
import { Bike, BriefcaseBusiness, Home, MapPin, Package, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { LocationSearchInput } from "./location-search-input";
import { MapPicker } from "./map-picker";
import { RouteSummary } from "./route-summary";

type ActivePoint = "pickup" | "drop";

const DEFAULT_PICKUP: SelectedLocation = {
  address: "Indiranagar, Bengaluru",
  lat: 12.9784,
  lng: 77.6408,
  source: "gps",
};

const DEFAULT_DROP: SelectedLocation = {
  address: "MG Road, Bengaluru",
  lat: 12.9756,
  lng: 77.6068,
  source: "autocomplete",
};

const savedPlaces: Array<{ label: string; helper: string; icon: LucideIcon; location: SelectedLocation }> = [
  { label: "Home", helper: "Koramangala", icon: Home, location: { address: "Koramangala, Bengaluru", lat: 12.9352, lng: 77.6245, source: "autocomplete" } },
  { label: "Work", helper: "Indiranagar", icon: BriefcaseBusiness, location: DEFAULT_PICKUP },
  { label: "Pickup hub", helper: "MG Road", icon: Package, location: DEFAULT_DROP },
];

const serviceChoices = [
  { label: "Bike", eta: "3 min", price: "Rs 48", icon: Bike, active: true },
  { label: "Auto", eta: "5 min", price: "Rs 92", icon: MapPin, active: false },
  { label: "Courier", eta: "8 min", price: "Rs 64", icon: Package, active: false },
];

export function LocationDemo() {
  const [activePoint, setActivePoint] = useState<ActivePoint>("pickup");
  const [pickup, setPickup] = useState<SelectedLocation | null>(DEFAULT_PICKUP);
  const [drop, setDrop] = useState<SelectedLocation | null>(DEFAULT_DROP);

  const activeLocation = activePoint === "pickup" ? pickup : drop;
  const activeLabel = activePoint === "pickup" ? "Pickup" : "Drop";

  const activeAddress = useMemo(() => activeLocation?.address ?? `Set ${activeLabel.toLowerCase()} location`, [activeLabel, activeLocation?.address]);

  function updateActiveLocation(location: SelectedLocation) {
    if (activePoint === "pickup") {
      setPickup(location);
      return;
    }

    setDrop(location);
  }

  function applySavedPlace(location: SelectedLocation) {
    updateActiveLocation(location);
  }

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-surface shadow-[var(--shadow-shell)]">
      <div className="border-b border-border bg-surface-muted px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-primary"><Sparkles className="size-4" aria-hidden={true} /> MoveX map experience</p>
            <h2 className="mt-1 text-2xl font-medium tracking-normal text-foreground">Set pickup, drop, and review the route</h2>
          </div>
          <div className="flex rounded-full border border-border bg-surface p-1 text-sm shadow-sm">
            {(["pickup", "drop"] as const).map((point) => (
              <button
                key={point}
                type="button"
                className={cn("rounded-full px-4 py-2 font-medium capitalize transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30", activePoint === point ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                onClick={() => setActivePoint(point)}
              >
                {point}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid min-h-[42rem] lg:grid-cols-[25rem_minmax(0,1fr)]">
        <aside className="flex flex-col gap-5 border-b border-border bg-surface p-4 sm:p-5 lg:border-b-0 lg:border-r">
          <div className="grid gap-3">
            <LocationStep index="01" label="Pickup" value={pickup?.address ?? "Choose pickup"} active={activePoint === "pickup"} onClick={() => setActivePoint("pickup")} />
            <LocationStep index="02" label="Drop" value={drop?.address ?? "Choose drop"} active={activePoint === "drop"} onClick={() => setActivePoint("drop")} />
          </div>

          <div className="space-y-4 rounded-lg border border-border bg-background p-4">
            <LocationSearchInput label={`${activeLabel} search`} value={activeLocation} onChange={updateActiveLocation} placeholder={`Search ${activeLabel.toLowerCase()} address`} bias={pickup ? { lat: pickup.lat, lng: pickup.lng } : undefined} />
            <div>
              <p className="text-sm font-medium text-foreground">Saved places</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
                {savedPlaces.map((place) => {
                  const Icon = place.icon;

                  return (
                    <button key={place.label} type="button" className="flex items-center gap-3 rounded-md border border-border bg-surface p-3 text-left transition hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30" onClick={() => applySavedPlace(place.location)}>
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><Icon className="size-4" aria-hidden={true} /></span>
                      <span>
                        <span className="block text-sm font-medium text-foreground">{place.label}</span>
                        <span className="text-xs text-muted-foreground">{place.helper}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <RouteSummary from={pickup} to={drop} />

          <div className="rounded-lg border border-border bg-background p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">Choose service</p>
                <p className="mt-1 text-xs text-muted-foreground">Preview surface for ride, courier, and delivery flows.</p>
              </div>
              <ShieldCheck className="size-5 text-success" aria-hidden={true} />
            </div>
            <div className="mt-3 grid gap-2">
              {serviceChoices.map((choice) => {
                const Icon = choice.icon;

                return (
                  <button key={choice.label} type="button" className={cn("grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30", choice.active ? "border-primary bg-primary/10" : "border-border bg-surface hover:border-primary/35")}>
                    <span className={cn("flex size-10 items-center justify-center rounded-md", choice.active ? "bg-primary text-primary-foreground" : "bg-surface-muted text-muted-foreground")}><Icon className="size-4" aria-hidden={true} /></span>
                    <span>
                      <span className="block text-sm font-medium text-foreground">{choice.label}</span>
                      <span className="text-xs text-muted-foreground">{choice.eta} arrival</span>
                    </span>
                    <span className="text-sm font-semibold text-foreground">{choice.price}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <div className="relative bg-background p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3 shadow-sm">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-primary">Editing {activeLabel}</p>
              <p className="mt-1 truncate text-sm font-medium text-foreground">{activeAddress}</p>
            </div>
            <Button type="button" onClick={() => setActivePoint(activePoint === "pickup" ? "drop" : "pickup")}>Next step</Button>
          </div>
          <MapPicker value={activeLocation} onChange={updateActiveLocation} showAdvancedControls />
        </div>
      </div>
    </section>
  );
}

function LocationStep({ index, label, value, active, onClick }: { index: string; label: string; value: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" className={cn("rounded-lg border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30", active ? "border-primary bg-primary/10" : "border-border bg-background hover:border-primary/35")} onClick={onClick}>
      <span className="flex items-start gap-3">
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-md text-sm font-semibold", active ? "bg-primary text-primary-foreground" : "bg-surface-muted text-muted-foreground")}>{index}</span>
        <span className="min-w-0">
          <span className="block text-sm font-medium text-foreground">{label}</span>
          <span className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">{value}</span>
        </span>
      </span>
    </button>
  );
}

