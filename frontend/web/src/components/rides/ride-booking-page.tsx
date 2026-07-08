"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { SelectedLocation } from "@movex/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Bike, Car, Clock3, IndianRupee, MapPin, Navigation, Wallet } from "lucide-react";

import { LocationSearchInput } from "@/components/location/location-search-input";
import { CancellationPolicyCard, ServiceDisclaimer } from "@/components/trust";
import { Button, StatusPill } from "@/components/ui";
import { createRide, estimateRide, type RideCreateResponse } from "@/lib/api";
import { cn } from "@/lib/utils";
import { RideMap } from "./ride-map";

const DEFAULT_PICKUP: SelectedLocation = { address: "Indiranagar, Bengaluru", lat: 12.9784, lng: 77.6408, source: "gps" };
const DEFAULT_DROP: SelectedLocation = { address: "MG Road, Bengaluru", lat: 12.9756, lng: 77.6068, source: "map-click" };

const VEHICLES = [
  { value: "BIKE", label: "Bike", helper: "Fast solo rides", capacity: "1 rider", icon: Bike, arrivalMinutes: 3, fare: { base: 25, perKm: 8, perMinute: 1 } },
  { value: "AUTO", label: "Auto", helper: "Everyday city trips", capacity: "3 seats", icon: Car, arrivalMinutes: 5, fare: { base: 35, perKm: 13, perMinute: 1.5 } },
  { value: "CAB", label: "Cab", helper: "Comfort rides", capacity: "4 seats", icon: Car, arrivalMinutes: 7, fare: { base: 70, perKm: 19, perMinute: 2.5 } },
] as const;

const PAYMENTS = ["CASH", "WALLET", "ONLINE"] as const;

type ActivePoint = "pickup" | "drop";

export function RideBookingPage() {
  const [pickup, setPickup] = useState<SelectedLocation>(DEFAULT_PICKUP);
  const [drop, setDrop] = useState<SelectedLocation>(DEFAULT_DROP);
  const [activePoint, setActivePoint] = useState<ActivePoint>("pickup");
  const [vehicleType, setVehicleType] = useState<(typeof VEHICLES)[number]["value"]>("BIKE");
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENTS)[number]>("CASH");
  const [created, setCreated] = useState<RideCreateResponse | null>(null);

  const routePreview = useMemo(() => calculateRoutePreview(pickup, drop), [drop, pickup]);
  const vehicleOptions = useMemo(
    () =>
      VEHICLES.map((vehicle) => ({
        ...vehicle,
        price: estimateFare(routePreview.distanceKm, routePreview.durationMinutes, vehicle.fare),
      })),
    [routePreview],
  );
  const selectedVehicle = vehicleOptions.find((vehicle) => vehicle.value === vehicleType) ?? vehicleOptions[0]!;
  const estimateInput = useMemo(() => ({ pickup, drop, vehicleType }), [drop, pickup, vehicleType]);
  const estimate = useQuery({
    queryKey: ["ride-estimate", pickup.lat, pickup.lng, drop.lat, drop.lng, vehicleType],
    queryFn: () => estimateRide(estimateInput),
    enabled: Boolean(pickup && drop),
    retry: false,
  });
  const createMutation = useMutation({
    mutationFn: () => createRide({ ...estimateInput, paymentMethod }),
    onSuccess: setCreated,
  });
  const backendFare = estimate.data?.vehicleType === vehicleType ? Number(estimate.data.estimatedFare) : null;
  const selectedFare = backendFare ?? selectedVehicle.price;
  const routeDistanceKm = estimate.data ? Number(estimate.data.distanceKm) : routePreview.distanceKm;
  const routeMinutes = estimate.data?.durationMinutes ?? routePreview.durationMinutes;
  const routeLabel = `${routeDistanceKm.toFixed(1)} km - ${routeMinutes} min`;

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-lg border border-border bg-surface shadow-[var(--shadow-shell)]">
        <div className="grid xl:min-h-[calc(100dvh-9rem)] xl:grid-cols-[30rem_minmax(0,1fr)]">
          <aside className="relative z-20 order-2 flex flex-col border-t border-border bg-surface p-4 xl:order-1 xl:border-r xl:border-t-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-ride">Mobility</p>
                <h2 className="text-2xl font-semibold text-foreground">Book a ride</h2>
                <p className="mt-1 text-sm text-muted-foreground">Choose pickup, drop, and compare prices before you confirm.</p>
              </div>
              <StatusPill label={`${selectedVehicle.arrivalMinutes} min away`} tone="info" />
            </div>

            <div className="mt-5 space-y-3">
              <RouteInputCard
                label="From"
                active={activePoint === "pickup"}
                value={pickup}
                placeholder="Search pickup"
                iconTone="text-ride"
                onSelect={() => setActivePoint("pickup")}
                onChange={(location) => {
                  setPickup(location);
                  setActivePoint("drop");
                }}
              />
              <RouteInputCard
                label="To"
                active={activePoint === "drop"}
                value={drop}
                placeholder="Search destination"
                iconTone="text-primary"
                onSelect={() => setActivePoint("drop")}
                onChange={(location) => setDrop(location)}
              />
            </div>

            <div className="mt-5 rounded-md border border-primary/20 bg-primary/10 p-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-primary">
                <Navigation className="size-4" aria-hidden="true" /> {routeDistanceKm.toFixed(1)} km - {routeMinutes} min trip
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Pickup and drop stay in the fields; the map shows route pins, vehicle proximity, and movement.</p>
            </div>

            <div className="mt-5">
              <p className="text-sm font-semibold text-foreground">Choose your ride</p>
              <div className="mt-2 grid gap-2">
                {vehicleOptions.map((vehicle) => (
                  <VehicleOptionCard key={vehicle.value} vehicle={vehicle} active={vehicleType === vehicle.value} onClick={() => setVehicleType(vehicle.value)} />
                ))}
              </div>
            </div>

            <div className="mt-5">
              <p className="text-sm font-semibold text-foreground">Payment</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {PAYMENTS.map((method) => (
                  <Button key={method} type="button" size="sm" variant={paymentMethod === method ? "primary" : "secondary"} onClick={() => setPaymentMethod(method)}>
                    <Wallet className="size-4" aria-hidden="true" /> {method}
                  </Button>
                ))}
              </div>
            </div>

            <div className="mt-5 rounded-md border border-border bg-surface-muted p-3">
              <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <IndianRupee className="size-4" aria-hidden="true" /> Estimated fare
              </p>
              <p className="mt-1 text-3xl font-semibold text-foreground">Rs {selectedFare.toFixed(0)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {estimate.data ? `${estimate.data.distanceKm} km with ${estimate.data.surgeMultiplier}x surge` : estimate.isLoading ? "Checking live route pricing" : "Preview fare shown until live route pricing connects."}
              </p>
            </div>

            <div className="mt-5">
              <CancellationPolicyCard serviceType="RIDE" />
              <div className="mt-3">
                <ServiceDisclaimer serviceType="RIDE" compact />
              </div>
            </div>

            <Button type="button" className="sticky bottom-3 z-20 mt-5 w-full shadow-[var(--shadow-shell)] xl:static xl:shadow-none" disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>
              {createMutation.isPending ? "Finding drivers" : `Book ${selectedVehicle.label.toLowerCase()}`}
            </Button>
            {createMutation.error ? <p role="status" className="mt-2 text-sm text-destructive">{createMutation.error instanceof Error ? createMutation.error.message : "Ride could not be created"}</p> : null}
          </aside>

          <div className="relative order-1 min-h-[28rem] bg-surface-muted p-3 sm:min-h-[34rem] sm:p-4 xl:sticky xl:top-20 xl:order-2 xl:h-[calc(100dvh-6rem)] xl:min-h-0">
            <RideMap phase="booking" pickup={pickup} drop={drop} activePoint={activePoint} onActivePointChange={setActivePoint} routeLabel={routeLabel} routePolyline={estimate.data?.polyline} />
          </div>
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
    </div>
  );
}

function RouteInputCard({ label, active, value, placeholder, iconTone, onSelect, onChange }: { label: string; active: boolean; value: SelectedLocation; placeholder: string; iconTone: string; onSelect: () => void; onChange: (location: SelectedLocation) => void }) {
  return (
    <section className={cn("rounded-md border bg-surface p-3 transition", active ? "border-primary ring-2 ring-primary/15" : "border-border")} onFocusCapture={onSelect}>
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
        <MapPin className={cn("size-4", iconTone)} aria-hidden="true" /> {label}
      </p>
      <LocationSearchInput label={`${label} address`} value={value} onChange={onChange} placeholder={placeholder} />
    </section>
  );
}

function VehicleOptionCard({ vehicle, active, onClick }: { vehicle: (typeof VEHICLES)[number] & { price: number }; active: boolean; onClick: () => void }) {
  const Icon = vehicle.icon;

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md border bg-surface p-3 text-left transition hover:-translate-y-0.5 hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
        active ? "border-primary bg-primary/10" : "border-border",
      )}
    >
      <span className={cn("flex size-11 items-center justify-center rounded-md", active ? "bg-primary text-primary-foreground" : "bg-ride-soft text-ride")}>
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span>
        <span className="block font-semibold text-foreground">{vehicle.label}</span>
        <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
          <Clock3 className="size-3.5" aria-hidden="true" /> {vehicle.arrivalMinutes} min pickup, {vehicle.capacity}, {vehicle.helper}
        </span>
      </span>
      <span className="text-right">
        <span className="block text-base font-semibold text-foreground">Rs {vehicle.price.toFixed(0)}</span>
        <span className="text-xs text-muted-foreground">Fare estimate</span>
      </span>
    </button>
  );
}

function calculateRoutePreview(pickup: SelectedLocation, drop: SelectedLocation) {
  const distanceKm = Math.max(0.8, haversineKm(pickup.lat, pickup.lng, drop.lat, drop.lng) * 1.25);
  const durationMinutes = Math.max(4, Math.round((distanceKm / 18) * 60 + 3));

  return { distanceKm, durationMinutes };
}

function estimateFare(distanceKm: number, durationMinutes: number, fare: { base: number; perKm: number; perMinute: number }) {
  return Math.max(fare.base, fare.base + distanceKm * fare.perKm + durationMinutes * fare.perMinute);
}

function haversineKm(fromLat: number, fromLng: number, toLat: number, toLng: number) {
  const earthRadiusKm = 6371;
  const latDistance = degreesToRadians(toLat - fromLat);
  const lngDistance = degreesToRadians(toLng - fromLng);
  const a =
    Math.sin(latDistance / 2) * Math.sin(latDistance / 2) +
    Math.cos(degreesToRadians(fromLat)) * Math.cos(degreesToRadians(toLat)) * Math.sin(lngDistance / 2) * Math.sin(lngDistance / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}
