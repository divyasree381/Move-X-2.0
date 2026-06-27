"use client";

import { useState } from "react";
import type { SelectedLocation } from "@movex/shared";

import { LocationSearchInput } from "./location-search-input";
import { MapPicker } from "./map-picker";
import { RouteSummary } from "./route-summary";

export function LocationDemo() {
  const [pickup, setPickup] = useState<SelectedLocation | null>(null);
  const [drop, setDrop] = useState<SelectedLocation | null>(null);

  return (
    <section className="w-full max-w-5xl space-y-5 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-5 lg:grid-cols-2">
        <LocationSearchInput label="Pickup" value={pickup} onChange={setPickup} placeholder="Search pickup address" />
        <LocationSearchInput
          label="Drop"
          value={drop}
          onChange={setDrop}
          placeholder="Search drop address"
          bias={pickup ? { lat: pickup.lat, lng: pickup.lng } : undefined}
        />
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]">
        <MapPicker value={pickup} onChange={setPickup} />
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-slate-900">Selected coordinates</p>
            <p className="mt-1 text-sm text-slate-600">
              {pickup ? `${pickup.lat.toFixed(6)}, ${pickup.lng.toFixed(6)}` : "No pickup selected"}
            </p>
          </div>
          <RouteSummary from={pickup} to={drop} />
        </div>
      </div>
    </section>
  );
}