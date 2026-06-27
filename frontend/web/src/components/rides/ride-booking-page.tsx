"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { SelectedLocation } from "@movex/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Bike, Car, IndianRupee, MapPin, Wallet } from "lucide-react";

import { MapPicker } from "@/components/location/map-picker";
import { CancellationPolicyCard } from "@/components/trust";
import { Button, StatusPill } from "@/components/ui";
import { createRide, estimateRide, type RideCreateResponse } from "@/lib/api";
import { cn } from "@/lib/utils";
import { RideMap } from "./ride-map";

const DEFAULT_PICKUP: SelectedLocation = { address: "Indiranagar, Bengaluru", lat: 12.9784, lng: 77.6408, source: "gps" };
const DEFAULT_DROP: SelectedLocation = { address: "MG Road, Bengaluru", lat: 12.9756, lng: 77.6068, source: "map-click" };
const VEHICLES = [
  { value: "BIKE", label: "Bike", icon: Bike },
  { value: "AUTO", label: "Auto", icon: Car },
  { value: "CAB", label: "Cab", icon: Car },
] as const;
const PAYMENTS = ["CASH", "WALLET", "ONLINE"] as const;

export function RideBookingPage() {
  const [pickup, setPickup] = useState<SelectedLocation>(DEFAULT_PICKUP);
  const [drop, setDrop] = useState<SelectedLocation>(DEFAULT_DROP);
  const [vehicleType, setVehicleType] = useState<(typeof VEHICLES)[number]["value"]>("BIKE");
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENTS)[number]>("CASH");
  const [created, setCreated] = useState<RideCreateResponse | null>(null);

  const estimateInput = useMemo(() => ({ pickup, drop, vehicleType }), [drop, pickup, vehicleType]);
  const estimate = useQuery({
    queryKey: ["ride-estimate", pickup.lat, pickup.lng, drop.lat, drop.lng, vehicleType],
    queryFn: () => estimateRide(estimateInput),
    enabled: Boolean(pickup && drop),
  });
  const createMutation = useMutation({
    mutationFn: () => createRide({ ...estimateInput, paymentMethod }),
    onSuccess: setCreated,
  });

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-border bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ride">Mobility</p>
            <h2 className="text-xl font-semibold text-foreground">Book a ride</h2>
          </div>
          {estimate.data ? <StatusPill label={`${estimate.data.durationMinutes} min ETA`} tone="info" /> : null}
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_22rem]">
          <div className="grid gap-4 lg:grid-cols-2">
            <LocationPanel title="From" iconTone="text-ride" value={pickup} onChange={setPickup} />
            <LocationPanel title="To" iconTone="text-brand" value={drop} onChange={setDrop} />
          </div>
          <aside className="space-y-4 rounded-md border border-border bg-surface-muted p-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Vehicle</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {VEHICLES.map((vehicle) => {
                  const Icon = vehicle.icon;
                  const active = vehicleType === vehicle.value;
                  return (
                    <button key={vehicle.value} type="button" aria-pressed={active} onClick={() => setVehicleType(vehicle.value)} className={cn("rounded-md border border-border bg-surface p-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30", active && "border-ride bg-ride/10 text-ride")}>
                      <Icon className="mx-auto mb-1 size-5" aria-hidden="true" />
                      {vehicle.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Payment</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {PAYMENTS.map((method) => (
                  <Button key={method} type="button" size="sm" variant={paymentMethod === method ? "primary" : "secondary"} onClick={() => setPaymentMethod(method)}>
                    <Wallet className="size-4" aria-hidden="true" /> {method}
                  </Button>
                ))}
              </div>
            </div>
            <div className="rounded-md border border-border bg-surface p-3">
              <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><IndianRupee className="size-4" aria-hidden="true" /> Estimated fare</p>
              <p className="mt-1 text-3xl font-semibold text-foreground">Rs {estimate.data ? Number(estimate.data.estimatedFare).toFixed(0) : "--"}</p>
              <p className="mt-1 text-xs text-muted-foreground">{estimate.data ? `${estimate.data.distanceKm} km with ${estimate.data.surgeMultiplier}x surge` : estimate.isLoading ? "Calculating route" : "Move pins to calculate"}</p>
            </div>
            <CancellationPolicyCard serviceType="RIDE" />
            <Button type="button" className="w-full" disabled={!estimate.data || createMutation.isPending} onClick={() => createMutation.mutate()}>
              {createMutation.isPending ? "Finding drivers" : "Confirm ride"}
            </Button>
            {createMutation.error ? <p role="status" className="text-sm text-destructive">{createMutation.error instanceof Error ? createMutation.error.message : "Ride could not be created"}</p> : null}
          </aside>
        </div>
      </section>

      {created ? (
        <section className="rounded-md border border-border bg-surface p-4">
          <StatusPill label="Ride requested" tone="success" />
          <h3 className="mt-2 text-lg font-semibold text-foreground">Drivers offered: {created.offeredDrivers}</h3>
          {created.devStartOtp ? <p className="mt-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-foreground">Dev start OTP: {created.devStartOtp}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild><Link href={`/customer/rides/${created.ride.id}`}>Track ride</Link></Button>
            <Button asChild variant="secondary"><Link href="/customer/rides">Book another</Link></Button>
          </div>
        </section>
      ) : null}

      <RideMap phase="booking" />
    </div>
  );
}

function LocationPanel({ title, iconTone, value, onChange }: { title: string; iconTone: string; value: SelectedLocation; onChange: (location: SelectedLocation) => void }) {
  return (
    <section className="rounded-md border border-border bg-surface-muted p-3">
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground"><MapPin className={cn("size-4", iconTone)} aria-hidden="true" /> {title}</p>
      <MapPicker value={value} onChange={onChange} />
    </section>
  );
}