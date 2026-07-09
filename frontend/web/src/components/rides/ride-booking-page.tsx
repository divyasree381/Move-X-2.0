"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { MapSuggestion, SelectedLocation } from "@movex/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Bike, Car, Clock, Heart, IndianRupee, Map as MapIcon, MapPin, Navigation, Plus, Search, Wallet, Pencil } from "lucide-react";

import { CancellationPolicyCard, ServiceDisclaimer } from "@/components/trust";
import { Button, StatusPill } from "@/components/ui";
import { autocompleteLocations, createRide, estimateRide, geocodeAddress, type RideCreateResponse } from "@/lib/api";
import { cn } from "@/lib/utils";
import { RideMap } from "./ride-map";

const DEFAULT_PICKUP: SelectedLocation = { address: "Indiranagar, Bengaluru", lat: 12.9784, lng: 77.6408, source: "gps" };

const VEHICLES = [
  { value: "BIKE", label: "Bike", helper: "Fast solo rides", capacity: "1 rider", icon: Bike, arrivalMinutes: 3, fare: { base: 25, perKm: 8, perMinute: 1 } },
  { value: "AUTO", label: "Auto", helper: "Everyday city trips", capacity: "3 seats", icon: Car, arrivalMinutes: 5, fare: { base: 35, perKm: 13, perMinute: 1.5 } },
  { value: "CAB", label: "Cab", helper: "Comfort rides", capacity: "4 seats", icon: Car, arrivalMinutes: 7, fare: { base: 70, perKm: 19, perMinute: 2.5 } },
] as const;

const PAYMENTS = ["CASH", "WALLET", "ONLINE"] as const;

type ActivePoint = "pickup" | "drop";

export function RideBookingPage() {
  const [pickup, setPickup] = useState<SelectedLocation>(DEFAULT_PICKUP);
  const [drop, setDrop] = useState<SelectedLocation | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [activePoint, setActivePoint] = useState<ActivePoint>("drop");
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
  
  const estimateInput = useMemo(() => {
    if (!drop) return null;
    return { pickup, drop, vehicleType };
  }, [drop, pickup, vehicleType]);

  const estimate = useQuery({
    queryKey: ["ride-estimate", pickup?.lat, pickup?.lng, drop?.lat, drop?.lng, vehicleType],
    queryFn: () => estimateInput ? estimateRide(estimateInput) : Promise.reject("No drop location"),
    enabled: Boolean(pickup && drop && step === 3),
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: () => {
      if (!estimateInput) throw new Error("Missing route info");
      return createRide({ ...estimateInput, paymentMethod });
    },
    onSuccess: setCreated,
  });

  const backendFare = estimate.data?.vehicleType === vehicleType ? Number(estimate.data.estimatedFare) : null;
  const selectedFare = backendFare ?? selectedVehicle.price;
  const routeDistanceKm = estimate.data ? Number(estimate.data.distanceKm) : routePreview.distanceKm;
  const routeMinutes = estimate.data?.durationMinutes ?? routePreview.durationMinutes;
  const routeLabel = `${routeDistanceKm.toFixed(1)} km - ${routeMinutes} min`;

  return (
    <div className="mx-auto flex w-full max-w-[480px] lg:max-w-6xl flex-col lg:flex-row overflow-hidden bg-surface sm:my-8 lg:my-0 sm:rounded-2xl sm:border sm:border-border sm:shadow-lg relative min-h-[100dvh] lg:min-h-[600px] lg:h-[calc(100vh-140px)] lg:max-h-[800px] lg:border lg:shadow-sm lg:mt-6">
      
      {/* MAP COLUMN */}
      <div className={cn(
        "bg-surface-muted relative z-0 transition-all duration-300 ease-in-out",
        step === 1 ? "flex-1 w-full lg:h-full lg:min-h-full" : "",
        step === 2 ? "h-[150px] w-full shrink-0 lg:hidden" : "",
        step === 3 ? "h-[250px] sm:h-[280px] w-full shrink-0 lg:flex-1 lg:h-full lg:min-h-full" : ""
      )}>
        {step !== 1 && (
          <button 
            onClick={() => setStep((step - 1) as 1 | 2 | 3)} 
            className="absolute top-4 left-4 z-30 flex size-10 items-center justify-center rounded-full bg-surface shadow-md lg:hidden"
          >
            <ArrowLeft className="size-5" />
          </button>
        )}
        <RideMap 
          phase="booking" 
          pickup={pickup} 
          drop={drop} 
          routeLabel={step === 3 ? routeLabel : undefined} 
          routePolyline={step === 3 ? estimate.data?.polyline : undefined} 
        />
      </div>

      {/* PANEL COLUMN */}
      <div className={cn(
        "bg-surface z-20 flex flex-col transition-all duration-300 ease-in-out",
        step === 1 ? "lg:w-[420px] lg:h-[calc(100vh-140px)] lg:shrink-0 lg:border-l lg:border-border lg:static absolute bottom-0 left-0 right-0 p-4 pt-6 rounded-t-3xl shadow-[0_-8px_20px_-8px_rgb(0,0,0,0.1)] lg:p-6 lg:justify-start" : "",
        step === 2 ? "flex-1 absolute top-[150px] bottom-0 left-0 right-0 animate-in slide-in-from-bottom-8 fade-in lg:static lg:mx-auto lg:w-[600px] lg:h-[600px] lg:mt-10 lg:rounded-2xl lg:shadow-xl lg:border lg:border-border lg:overflow-hidden" : "",
        step === 3 ? "lg:w-[420px] lg:h-[calc(100vh-140px)] lg:shrink-0 lg:border-l lg:border-border lg:static flex-1 absolute top-[250px] sm:top-[280px] bottom-0 left-0 right-0 animate-in slide-in-from-right-8 fade-in lg:animate-none" : ""
      )}>
        {step === 1 && (
          <div className="flex flex-col h-full animate-in fade-in duration-300 lg:animate-none">
            <h2 className="text-2xl font-bold text-foreground mb-4 px-2 lg:mt-8">Where to?</h2>
            <button 
              type="button"
              className="w-full bg-surface-muted rounded-2xl p-4 flex items-center gap-3 text-left transition active:scale-[0.98] hover:bg-border/50"
              onClick={() => {
                setActivePoint("drop");
                setStep(2);
              }}
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background shadow-sm">
                <Search className="size-4 text-foreground" />
              </div>
              <span className="text-muted-foreground font-medium text-lg flex-1">Where do you want to go?</span>
            </button>
            <div className="mt-5 flex gap-3 overflow-x-auto pb-2 hide-scrollbar px-2">
              <button onClick={() => { setStep(2); }} className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium shadow-sm active:scale-95 transition hover:bg-surface-muted">
                <Heart className="size-4 text-primary" fill="currentColor" /> Home
              </button>
              <button onClick={() => { setStep(2); }} className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium shadow-sm active:scale-95 transition hover:bg-surface-muted">
                <Heart className="size-4 text-foreground" /> Work
              </button>
              <button onClick={() => { setStep(2); }} className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium shadow-sm active:scale-95 transition hover:bg-surface-muted">
                <Clock className="size-4 text-muted-foreground" /> Airport
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col h-full animate-in fade-in duration-300 lg:animate-none relative">
            {/* Desktop Map Preview at top of modal */}
            <div className="h-[150px] w-full shrink-0 bg-surface-muted relative hidden lg:block">
              <button 
                onClick={() => setStep(1)} 
                className="absolute top-4 left-4 z-30 flex size-10 items-center justify-center rounded-full bg-surface shadow-sm border border-border"
              >
                <ArrowLeft className="size-5" />
              </button>
              <RideMap phase="booking" pickup={pickup} />
            </div>
            {/* Mobile back button (map is in left column on mobile) */}
            <button 
              onClick={() => setStep(1)} 
              className="absolute top-4 left-4 z-30 flex size-10 items-center justify-center rounded-full bg-surface shadow-sm border border-border lg:hidden"
            >
              <ArrowLeft className="size-5" />
            </button>
            
            <div className="lg:mt-0 mt-16 flex-1 flex flex-col min-h-0">
              <SearchStep 
                pickup={pickup}
                drop={drop}
                activePoint={activePoint}
                onSelectPickup={(loc) => {
                  setPickup(loc);
                  setActivePoint("drop");
                }}
                onSelectDrop={(loc) => {
                  setDrop(loc);
                  setStep(3);
                }}
                onEditPickup={() => setActivePoint("pickup")}
                onEditDrop={() => setActivePoint("drop")}
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col h-full animate-in fade-in duration-300 lg:animate-none relative">
            <button 
              onClick={() => setStep(2)} 
              className="absolute top-4 left-4 z-30 flex size-10 items-center justify-center rounded-full bg-surface shadow-sm border border-border hidden lg:flex"
            >
              <ArrowLeft className="size-5" />
            </button>
            <div className="flex flex-1 flex-col overflow-y-auto pb-28 lg:pb-0 lg:mt-16 min-h-0">
              <section className="p-4 sm:p-5 space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-foreground">Choose your ride</h2>
                  <StatusPill label={`${selectedVehicle.arrivalMinutes} min away`} tone="info" />
                </div>

                <div className="grid gap-2">
                  {vehicleOptions.map((vehicle) => (
                    <VehicleOptionCard key={vehicle.value} vehicle={vehicle} active={vehicleType === vehicle.value} onClick={() => setVehicleType(vehicle.value)} />
                  ))}
                </div>

                <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-3">
                  <div className="flex items-center gap-3">
                    <Wallet className="size-5 text-muted-foreground" />
                    <select 
                      className="bg-transparent text-sm font-bold text-foreground outline-none cursor-pointer"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as "CASH" | "ONLINE" | "WALLET")}
                    >
                      {PAYMENTS.map((method) => (
                        <option key={method} value={method}>{method}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-4 w-px bg-border"></div>
                    <button className="flex items-center gap-1 text-sm font-bold text-primary">
                      Offers
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-surface-muted p-3">
                  <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <IndianRupee className="size-4" aria-hidden="true" /> Estimated fare
                  </p>
                  <p className="mt-1 text-2xl font-bold text-foreground">₹{selectedFare.toFixed(0)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {estimate.data ? `${estimate.data.distanceKm} km with ${estimate.data.surgeMultiplier}x surge` : estimate.isLoading ? "Checking live route pricing..." : "Preview fare shown until live route pricing connects."}
                  </p>
                </div>

                <details className="group rounded-xl border border-border bg-surface p-3 mb-6">
                  <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground list-none flex justify-between items-center">
                    <span>View cancellation policy & disclaimer</span>
                    <span className="transition-transform group-open:rotate-180">▾</span>
                  </summary>
                  <div className="mt-3 pt-3 border-t border-border space-y-3">
                    <CancellationPolicyCard serviceType="RIDE" />
                    <ServiceDisclaimer serviceType="RIDE" compact />
                  </div>
                </details>
              </section>
            </div>

            {/* Book button fixed at bottom of this container */}
            {!created && (
              <div className="absolute lg:sticky bottom-0 left-0 right-0 z-50 border-t border-border bg-surface p-4 shadow-[0_-8px_16px_-8px_rgb(0,0,0,0.1)] lg:shadow-none lg:mt-auto">
                <Button type="button" className="w-full text-base font-bold py-6 rounded-xl" disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>
                  {createMutation.isPending ? "Finding drivers..." : `Book ${selectedVehicle.label}`}
                </Button>
                {createMutation.error ? <p role="status" className="mt-2 text-center text-sm text-destructive">{createMutation.error instanceof Error ? createMutation.error.message : "Ride could not be created"}</p> : null}
              </div>
            )}
          </div>
        )}
        
        {created && (
          <div className="fixed lg:absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <section className="w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-lg">
              <StatusPill label="Ride requested" tone="success" />
              <h3 className="mt-3 text-xl font-bold text-foreground">Drivers offered: {created.offeredDrivers}</h3>
              <div className="mt-5 flex flex-col gap-2">
                <Button asChild className="w-full py-5 rounded-xl font-bold"><Link href={`/customer/rides/${created.ride.id}`}>Track ride</Link></Button>
                <Button asChild variant="secondary" className="w-full py-5 rounded-xl font-bold" onClick={() => { setCreated(null); setStep(1); setDrop(null); }}><Link href="/customer/rides">Book another</Link></Button>
              </div>
            </section>
          </div>
        )}
      </div>

    </div>
  );
}

function SearchStep({ pickup, drop, activePoint, onSelectPickup, onSelectDrop, onEditPickup, onEditDrop }: { pickup: SelectedLocation, drop: SelectedLocation | null, activePoint: "pickup" | "drop", onSelectPickup: (loc: SelectedLocation) => void, onSelectDrop: (loc: SelectedLocation) => void, onEditPickup: () => void, onEditDrop: () => void }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<MapSuggestion[]>([]);
  const [, setIsLoading] = useState(false);


  useEffect(() => {
    setQuery("");
    setSuggestions([]);
  }, [activePoint]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setIsLoading(true);
      try {
        const results = await autocompleteLocations(trimmed, { lat: pickup.lat, lng: pickup.lng });
        if (!controller.signal.aborted) setSuggestions(results);
      } catch {
        if (!controller.signal.aborted) setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [query, pickup.lat, pickup.lng]);

  async function handleSelectSuggestion(placeId: string) {
    setIsLoading(true);
    try {
      const suggestion = suggestions.find(s => s.placeId === placeId);
      if (suggestion) {
        const selected = await geocodeAddress(suggestion.description);
        if (activePoint === "pickup") onSelectPickup(selected);
        else onSelectDrop(selected);
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGeocodeFallback(text: string) {
    if (text.length < 3) return;
    setIsLoading(true);
    try {
      const selected = await geocodeAddress(text);
      if (activePoint === "pickup") onSelectPickup(selected);
      else onSelectDrop(selected);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col bg-surface overflow-hidden min-h-0">
      <div className="px-4 py-4 lg:py-0 border-b border-border shadow-sm z-10 bg-surface">
        <div className="relative pl-8">
          <div className="absolute left-[0.6rem] top-[1.4rem] bottom-[1.4rem] w-0.5 bg-border"></div>
          
          {/* Pickup Field */}
          <div className="relative py-2 flex items-center">
            <div className="absolute -left-[1.25rem] flex size-3 items-center justify-center rounded-full bg-ride/20">
              <div className="size-1.5 rounded-full bg-ride"></div>
            </div>
            {activePoint === "pickup" ? (
              <input 
                autoFocus
                className="w-full bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search pickup location"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleGeocodeFallback(query);
                }}
              />
            ) : (
              <div className="flex w-full items-center justify-between cursor-pointer py-1" onClick={onEditPickup}>
                <span className="text-sm font-medium truncate pr-2">{pickup.address}</span>
                <Pencil className="size-3.5 text-muted-foreground shrink-0" />
              </div>
            )}
          </div>
          
          <div className="border-t border-border my-1"></div>
          
          {/* Drop Field */}
          <div className="relative py-2 flex items-center">
            <div className="absolute -left-[1.3rem] flex size-4 items-center justify-center bg-surface">
              <MapPin className="size-4 text-primary" fill="currentColor" />
            </div>
            {activePoint === "drop" ? (
              <input 
                autoFocus
                className="w-full bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Where to?"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleGeocodeFallback(query);
                }}
              />
            ) : (
              <div className="flex w-full items-center justify-between cursor-pointer py-1" onClick={onEditDrop}>
                <span className="text-sm font-medium truncate text-muted-foreground">{drop ? drop.address : "Where to?"}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-surface">
        {query.length > 1 && suggestions.length > 0 ? (
          <ul className="divide-y divide-border">
            {suggestions.map((suggestion) => (
              <li key={suggestion.placeId}>
                <button
                  type="button"
                  className="flex w-full items-center gap-4 px-4 py-3.5 text-left transition hover:bg-surface-muted"
                  onClick={() => handleSelectSuggestion(suggestion.placeId)}
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-muted">
                    <MapIcon className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-foreground">{suggestion.mainText}</span>
                    {suggestion.secondaryText && (
                      <span className="block truncate text-xs text-muted-foreground">{suggestion.secondaryText}</span>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-4">
            <div className="flex gap-2 mb-4">
              <button className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border bg-surface-muted py-2 text-xs font-semibold text-foreground transition hover:bg-border">
                <MapIcon className="size-3.5" /> Select on map
              </button>
              <button className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border bg-surface-muted py-2 text-xs font-semibold text-foreground transition hover:bg-border">
                <Plus className="size-3.5" /> Add stop
              </button>
            </div>
            
            <button className="flex w-full items-center gap-4 py-3 text-left transition hover:bg-surface-muted px-2 rounded-lg -mx-2">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Navigation className="size-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-primary">Use current location</p>
              </div>
            </button>
            
            <button className="flex w-full items-center gap-4 py-3 text-left transition hover:bg-surface-muted px-2 rounded-lg -mx-2 mt-1" onClick={() => handleGeocodeFallback("Indiranagar, Bengaluru")}>
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-muted">
                <Heart className="size-4 text-foreground" fill="currentColor" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">Home</p>
                <p className="truncate text-xs text-muted-foreground">Indiranagar, Bengaluru</p>
              </div>
            </button>
            
            <button className="flex w-full items-center gap-4 py-3 text-left transition hover:bg-surface-muted px-2 rounded-lg -mx-2" onClick={() => handleGeocodeFallback("Koramangala, Bengaluru")}>
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-muted">
                <Heart className="size-4 text-foreground" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">Work</p>
                <p className="truncate text-xs text-muted-foreground">Koramangala, Bengaluru</p>
              </div>
            </button>

            <button className="flex w-full items-center gap-4 py-3 text-left transition hover:bg-surface-muted px-2 rounded-lg -mx-2" onClick={() => handleGeocodeFallback("Kempegowda International Airport, Bengaluru")}>
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-muted">
                <Clock className="size-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">Kempegowda International Airport</p>
                <p className="truncate text-xs text-muted-foreground">Bengaluru, Karnataka</p>
              </div>
              <Heart className="size-4 text-muted-foreground ml-auto" />
            </button>
          </div>
        )}
      </div>
    </div>
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
        "flex items-center gap-3 rounded-xl border bg-surface p-3 text-left transition hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
        active ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border",
      )}
    >
      <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-lg", active ? "bg-primary text-primary-foreground" : "bg-ride/10 text-ride")}>
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-foreground text-base">{vehicle.label}</span>
          {vehicle.label === "Bike" && (
            <span className="rounded bg-ride/10 px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-ride">Fastest</span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
          <span>{vehicle.arrivalMinutes} min</span>
          <span className="size-1 rounded-full bg-muted-foreground/50"></span>
          <span>{vehicle.capacity}</span>
        </div>
      </div>
      <div className="text-right">
        <span className="block text-lg font-bold text-foreground">₹{vehicle.price.toFixed(0)}</span>
      </div>
    </button>
  );
}

function calculateRoutePreview(pickup: SelectedLocation | null, drop: SelectedLocation | null) {
  if (!pickup || !drop) return { distanceKm: 0, durationMinutes: 0 };
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
