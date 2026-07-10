"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MapSuggestion, SelectedLocation } from "@movex/shared";
import { useMutation, useQueries } from "@tanstack/react-query";
import { ArrowLeft, Banknote, Bike, CarFront, CarTaxiFront, Check, ChevronDown, CircleCheck, Clock, CreditCard, Heart, LoaderCircle, LocateFixed, MapIcon, MapPin, Navigation, Pencil, Search, ShieldCheck, UserRound, UsersRound, Wallet } from "lucide-react";

import { CancellationPolicyCard, ServiceDisclaimer } from "@/components/trust";
import { Button, StatusPill } from "@/components/ui";
import { autocompleteLocations, createRide, estimateRide, geocodeAddress, reverseGeocode, type RideCreateResponse, type RideEstimate } from "@/lib/api";
import { cn } from "@/lib/utils";
import { RideMap } from "./ride-map";

const DEFAULT_PICKUP: SelectedLocation = { address: "Indiranagar, Bengaluru", lat: 12.9784, lng: 77.6408, source: "gps" };

const VEHICLES = [
  { value: "BIKE", label: "Bike", helper: "Quickest through traffic", capacity: "1 rider", icon: Bike, tone: "bg-ride-soft text-ride", badge: "Fast pickup" },
  { value: "AUTO", label: "Auto", helper: "Easy everyday travel", capacity: "3 seats", icon: CarTaxiFront, tone: "bg-warning/10 text-warning", badge: "Popular" },
  { value: "CAB", label: "Cab", helper: "Air-conditioned comfort", capacity: "4 seats", icon: CarFront, tone: "bg-info/10 text-info", badge: "Comfort" },
] as const;

const PAYMENTS = [
  { value: "CASH", label: "Cash", icon: Banknote },
  { value: "WALLET", label: "Wallet", icon: Wallet },
  { value: "ONLINE", label: "Online", icon: CreditCard },
] as const;

const SAVED_DESTINATIONS = [
  { label: "Home", address: "Indiranagar, Bengaluru", icon: Heart },
  { label: "Work", address: "Koramangala, Bengaluru", icon: UserRound },
  { label: "Airport", address: "Kempegowda International Airport, Bengaluru", icon: Clock },
] as const;

const currencyFormatter = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

type ActivePoint = "pickup" | "drop";
type VehicleType = (typeof VEHICLES)[number]["value"];
type PaymentMethod = (typeof PAYMENTS)[number]["value"];

export function RideBookingPage() {
  const [pickup, setPickup] = useState<SelectedLocation>(DEFAULT_PICKUP);
  const [drop, setDrop] = useState<SelectedLocation | null>(null);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [activePoint, setActivePoint] = useState<ActivePoint>("drop");
  const [pinMode, setPinMode] = useState<ActivePoint | null>(null);
  const [pinDraft, setPinDraft] = useState<SelectedLocation | null>(null);
  const [pinAddressBusy, setPinAddressBusy] = useState(false);
  const [vehicleType, setVehicleType] = useState<VehicleType>("BIKE");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [created, setCreated] = useState<RideCreateResponse | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationBusy, setLocationBusy] = useState(false);
  const reverseLookupId = useRef(0);

  const estimates = useQueries({
    queries: VEHICLES.map((vehicle) => ({
      queryKey: ["ride-estimate", pickup.lat, pickup.lng, drop?.lat, drop?.lng, vehicle.value],
      queryFn: () => estimateRide({ pickup, drop: drop!, vehicleType: vehicle.value }),
      enabled: Boolean(drop && step === 3),
      retry: false,
      staleTime: 30_000,
    })),
  });

  const selectedIndex = VEHICLES.findIndex((vehicle) => vehicle.value === vehicleType);
  const selectedEstimate = estimates[selectedIndex] ?? estimates[0];
  const routeEstimate = selectedEstimate?.data ?? estimates.find((estimate) => estimate.data)?.data;
  const selectedFare = selectedEstimate?.data ? Number(selectedEstimate.data.estimatedFare) : null;
  const routeLabel = routeEstimate
    ? `${Number(routeEstimate.distanceKm).toFixed(1)} km - ${routeEstimate.durationMinutes} min trip`
    : step === 3
      ? estimates.some((estimate) => estimate.isFetching) ? "Calculating the road route..." : "Live route unavailable"
      : "Set your destination";

  const estimateInput = useMemo(() => drop ? { pickup, drop, vehicleType } : null, [drop, pickup, vehicleType]);

  const createMutation = useMutation({
    mutationFn: () => {
      if (!estimateInput || !selectedEstimate?.data) throw new Error("Live route pricing is required before booking.");
      return createRide({ ...estimateInput, paymentMethod });
    },
    onSuccess: setCreated,
  });

  function beginPinning(point: ActivePoint, location: SelectedLocation) {
    reverseLookupId.current += 1;
    setActivePoint(point);
    setPinMode(point);
    setPinDraft({ ...location, source: "map-click" });
    setPinAddressBusy(false);
    setLocationError(null);
    setStep(4);
  }

  async function chooseSavedDestination(address: string) {
    setLocationBusy(true);
    setLocationError(null);
    try {
      beginPinning("drop", await geocodeAddress(address));
    } catch {
      setLocationError("We could not find that destination. Search for the address instead.");
    } finally {
      setLocationBusy(false);
    }
  }

  function editPoint(point: ActivePoint) {
    setActivePoint(point);
    setLocationError(null);
    setStep(2);
  }

  function updatePinCenter(lat: number, lng: number) {
    const requestId = reverseLookupId.current + 1;
    reverseLookupId.current = requestId;
    const nextLocation: SelectedLocation = { address: "Finding exact address...", lat, lng, source: "marker-drag" };

    setPinDraft(nextLocation);
    setPinAddressBusy(true);
    setLocationError(null);
    void reverseGeocode(lat, lng)
      .then((address) => {
        if (reverseLookupId.current === requestId) setPinDraft({ ...nextLocation, address });
      })
      .catch(() => {
        if (reverseLookupId.current === requestId) {
          setPinDraft({ ...nextLocation, address: "Pinned map location" });
          setLocationError("The pin is saved, but the address lookup is temporarily unavailable.");
        }
      })
      .finally(() => {
        if (reverseLookupId.current === requestId) setPinAddressBusy(false);
      });
  }

  function cancelPinning() {
    reverseLookupId.current += 1;
    setPinMode(null);
    setPinDraft(null);
    setPinAddressBusy(false);
    setLocationError(null);
    setStep(2);
  }

  function confirmPinnedLocation() {
    if (!pinMode || !pinDraft) return;

    if (pinMode === "pickup") {
      setPickup(pinDraft);
      if (drop) {
        setStep(3);
      } else {
        setActivePoint("drop");
        setStep(2);
      }
    } else {
      setDrop(pinDraft);
      setStep(3);
    }

    setPinMode(null);
    setPinDraft(null);
    setPinAddressBusy(false);
    setLocationError(null);
  }

  return (
    <div className="relative h-[calc(100dvh-4rem)] min-h-[36rem] overflow-hidden bg-surface-muted">
      <RideMap
        phase="booking"
        pickup={pickup}
        drop={drop}
        routeLabel={routeLabel}
        routePolyline={pinMode ? null : routeEstimate?.polyline}
        pinMode={step === 4 ? pinMode : null}
        pinLocation={pinDraft}
        onPinCenterChange={updatePinCenter}
      />

      <aside className={cn(
        "absolute inset-x-0 bottom-0 z-20 flex w-full flex-col overflow-hidden rounded-t-lg border-t border-border bg-surface shadow-[0_-12px_32px_rgb(17,24,39,0.16)] motion-safe:animate-[content-in_180ms_ease-out]",
        "lg:left-auto lg:right-4 lg:w-[27rem] lg:rounded-lg lg:border lg:shadow-[0_18px_48px_rgb(17,24,39,0.16)]",
        step === 1 && "max-h-[32rem] lg:inset-y-4 lg:max-h-none",
        (step === 2 || step === 3) && "h-[min(76dvh,46rem)] lg:inset-y-4 lg:h-auto lg:max-h-none",
        step === 4 && "max-h-[22rem] lg:bottom-4 lg:max-h-[24rem]",
      )} aria-label="Ride booking">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border lg:hidden" aria-hidden="true" />
        {step === 1 ? <PlanTripPanel pickup={pickup} locationBusy={locationBusy} locationError={locationError} onEditPickup={() => editPoint("pickup")} onPinPickup={() => beginPinning("pickup", pickup)} onChooseDestination={() => editPoint("drop")} onChooseSaved={(address) => void chooseSavedDestination(address)} /> : null}
        {step === 2 ? <SearchStep pickup={pickup} drop={drop} activePoint={activePoint} onBack={() => setStep(1)} onSelectLocation={beginPinning} onEditPickup={() => setActivePoint("pickup")} onEditDrop={() => setActivePoint("drop")} /> : null}
        {step === 3 ? <RideOptionsPanel pickup={pickup} drop={drop!} vehicleType={vehicleType} paymentMethod={paymentMethod} estimates={estimates} selectedFare={selectedFare} isBooking={createMutation.isPending} bookingError={createMutation.error} onBack={() => setStep(2)} onEditPoint={editPoint} onVehicleChange={setVehicleType} onPaymentChange={setPaymentMethod} onBook={() => createMutation.mutate()} /> : null}
        {step === 4 && pinMode && pinDraft ? <PinLocationPanel point={pinMode} location={pinDraft} addressBusy={pinAddressBusy} error={locationError} onBack={cancelPinning} onConfirm={confirmPinnedLocation} /> : null}
      </aside>

      {created ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <section className="w-full max-w-sm rounded-lg border border-border bg-surface p-5 shadow-lg" aria-live="polite">
            <StatusPill label="Ride requested" tone="success" />
            <h2 className="mt-3 text-xl font-bold text-foreground">Looking for your driver</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{created.offeredDrivers > 0 ? `${created.offeredDrivers} nearby drivers received your request.` : "We are expanding the search around your pickup."}</p>
            <div className="mt-5 flex flex-col gap-2">
              <Button asChild className="w-full"><Link href={`/customer/rides/${created.ride.id}`}>Track Ride</Link></Button>
              <Button variant="secondary" className="w-full" onClick={() => { setCreated(null); setStep(1); setDrop(null); }}>Book Another Ride</Button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
function PlanTripPanel({ pickup, locationBusy, locationError, onEditPickup, onPinPickup, onChooseDestination, onChooseSaved }: {
  pickup: SelectedLocation;
  locationBusy: boolean;
  locationError: string | null;
  onEditPickup: () => void;
  onPinPickup: () => void;
  onChooseDestination: () => void;
  onChooseSaved: (address: string) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-b border-border px-5 pb-4 pt-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-primary">Ride Now</p>
            <h1 className="mt-1 text-2xl font-bold text-foreground text-balance">Where are you going?</h1>
          </div>
          <StatusPill label="Live" tone="success" />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <LocationFields pickup={pickup} drop={null} onEditPickup={onEditPickup} onEditDrop={onChooseDestination} prominentDrop />
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Saved Places</p>
          <div className="mt-2 divide-y divide-border">
            {SAVED_DESTINATIONS.map((destination) => {
              const Icon = destination.icon;
              return (
                <button key={destination.label} type="button" className="flex min-h-14 w-full items-center gap-3 rounded-md px-2 text-left hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50" disabled={locationBusy} onClick={() => onChooseSaved(destination.address)}>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-muted text-foreground"><Icon className="size-4" aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground">{destination.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{destination.address}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        {locationError ? <p className="mt-3 text-sm text-destructive" role="status">{locationError}</p> : null}
      </div>

      <div className="border-t border-border bg-surface-muted px-5 py-3">
        <button type="button" className="flex min-h-10 w-full items-center justify-between gap-3 rounded-md px-2 text-left text-sm font-semibold text-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30" onClick={onPinPickup}>
          <span className="flex items-center gap-2"><LocateFixed className="size-4" aria-hidden="true" /> Adjust Pickup on Map</span>
          <span className="text-xs font-medium text-muted-foreground">Exact entrance</span>
        </button>
      </div>
    </div>
  );
}

function LocationFields({ pickup, drop, onEditPickup, onEditDrop, prominentDrop = false }: {
  pickup: SelectedLocation;
  drop: SelectedLocation | null;
  onEditPickup: () => void;
  onEditDrop: () => void;
  prominentDrop?: boolean;
}) {
  return (
    <div className="relative rounded-lg border border-border bg-surface p-3 shadow-sm">
      <span className="absolute bottom-[2.15rem] left-[1.47rem] top-[2.15rem] w-px bg-border" aria-hidden="true" />
      <button type="button" className="relative flex min-h-12 w-full items-center gap-3 rounded-md px-1 text-left hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30" onClick={onEditPickup}>
        <span className="z-10 flex size-4 shrink-0 items-center justify-center rounded-full bg-ride-soft"><span className="size-2 rounded-full bg-ride" /></span>
        <span className="min-w-0 flex-1"><span className="block text-xs font-medium text-muted-foreground">Pickup</span><span className="block truncate text-sm font-semibold text-foreground">{pickup.address}</span></span>
        <Pencil className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>
      <div className="my-1 ml-7 border-t border-border" />
      <button type="button" className={cn("relative flex min-h-12 w-full items-center gap-3 rounded-md px-1 text-left hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30", prominentDrop && "bg-surface-muted")} onClick={onEditDrop}>
        <MapPin className="z-10 size-4 shrink-0 text-destructive" fill="currentColor" aria-hidden="true" />
        <span className="min-w-0 flex-1"><span className="block text-xs font-medium text-muted-foreground">Destination</span><span className={cn("block truncate font-semibold", drop ? "text-sm text-foreground" : "text-base text-muted-foreground")}>{drop?.address ?? "Search destination"}</span></span>
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>
    </div>
  );
}
function SearchStep({ pickup, drop, activePoint, onBack, onSelectLocation, onEditPickup, onEditDrop }: {
  pickup: SelectedLocation;
  drop: SelectedLocation | null;
  activePoint: ActivePoint;
  onBack: () => void;
  onSelectLocation: (point: ActivePoint, location: SelectedLocation) => void;
  onEditPickup: () => void;
  onEditDrop: () => void;
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<MapSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    setQuery("");
    setSuggestions([]);
    setSearchError(null);
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
      setSearchError(null);
      try {
        const results = await autocompleteLocations(trimmed, { lat: pickup.lat, lng: pickup.lng });
        if (!controller.signal.aborted) setSuggestions(results);
      } catch {
        if (!controller.signal.aborted) {
          setSuggestions([]);
          setSearchError("Location suggestions are unavailable. Try the full address.");
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, 300);
    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [query, pickup.lat, pickup.lng]);

  async function selectAddress(address: string) {
    setIsLoading(true);
    setSearchError(null);
    try {
      onSelectLocation(activePoint, await geocodeAddress(address));
    } catch {
      setSearchError("We could not locate that address. Check the spelling and try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function selectCurrentLocation() {
    if (!("geolocation" in navigator)) {
      setSearchError("Location access is not available in this browser. Search for your pickup instead.");
      return;
    }

    setIsLoading(true);
    setSearchError(null);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 });
      });
      const { latitude: lat, longitude: lng } = position.coords;
      let address = "Current location";
      try {
        address = await reverseGeocode(lat, lng);
      } catch {
        // The pin remains usable even when the provider cannot resolve an address.
      }
      onSelectLocation("pickup", { address, lat, lng, source: "gps" });
    } catch {
      setSearchError("We could not access your current location. Check browser permission or search manually.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-b border-border px-4 pb-4 pt-3">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="icon" onClick={onBack} aria-label="Back to ride map"><ArrowLeft className="size-5" aria-hidden="true" /></Button>
          <div><p className="text-xs font-semibold text-primary">Plan Your Trip</p><h2 className="text-lg font-bold text-foreground">Choose a Location</h2></div>
        </div>

        <div className="relative mt-4 rounded-lg border border-border bg-surface p-3 shadow-sm">
          <span className="absolute bottom-[2.15rem] left-[1.47rem] top-[2.15rem] w-px bg-border" aria-hidden="true" />
          <div className="relative flex min-h-12 items-center gap-3 px-1">
            <span className="z-10 flex size-4 shrink-0 items-center justify-center rounded-full bg-ride-soft"><span className="size-2 rounded-full bg-ride" /></span>
            {activePoint === "pickup" ? (
              <label className="min-w-0 flex-1">
                <span className="sr-only">Search pickup location</span>
                <input name="pickup-search" autoComplete="off" className="w-full bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search pickup location" onKeyDown={(event) => { if (event.key === "Enter" && query.trim().length > 2) void selectAddress(query.trim()); }} />
              </label>
            ) : (
              <button type="button" className="flex min-w-0 flex-1 items-center justify-between text-left" onClick={onEditPickup}><span className="truncate text-sm font-semibold text-foreground">{pickup.address}</span><Pencil className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /></button>
            )}
          </div>
          <div className="my-1 ml-7 border-t border-border" />
          <div className="relative flex min-h-12 items-center gap-3 px-1">
            <MapPin className="z-10 size-4 shrink-0 text-destructive" fill="currentColor" aria-hidden="true" />
            {activePoint === "drop" ? (
              <label className="min-w-0 flex-1">
                <span className="sr-only">Search destination</span>
                <input name="destination-search" autoComplete="off" className="w-full bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Where to?" onKeyDown={(event) => { if (event.key === "Enter" && query.trim().length > 2) void selectAddress(query.trim()); }} />
              </label>
            ) : (
              <button type="button" className="flex min-w-0 flex-1 items-center justify-between text-left" onClick={onEditDrop}><span className="truncate text-sm font-semibold text-foreground">{drop?.address ?? "Search destination"}</span><Pencil className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /></button>
            )}
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4" aria-live="polite">
        {isLoading ? <div className="flex items-center gap-3 rounded-lg bg-surface-muted p-4 text-sm text-muted-foreground"><span className="size-4 animate-spin rounded-full border-2 border-border border-t-primary" aria-hidden="true" />Finding locations...</div> : null}

        {!isLoading && suggestions.length > 0 ? (
          <ul className="divide-y divide-border">
            {suggestions.map((suggestion) => (
              <li key={suggestion.placeId}>
                <button type="button" className="flex min-h-16 w-full items-center gap-3 rounded-md px-2 text-left hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30" onClick={() => void selectAddress(suggestion.description)}>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-muted text-muted-foreground"><MapIcon className="size-4" aria-hidden="true" /></span>
                  <span className="min-w-0"><span className="block truncate text-sm font-semibold text-foreground">{suggestion.mainText}</span>{suggestion.secondaryText ? <span className="block truncate text-xs text-muted-foreground">{suggestion.secondaryText}</span> : null}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {!isLoading && query.length < 2 ? (
          <div>
            {activePoint === "pickup" ? (
              <button type="button" className="flex min-h-14 w-full items-center gap-3 rounded-md px-2 text-left text-primary hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30" onClick={() => void selectCurrentLocation()}>
                <span className="flex size-9 items-center justify-center rounded-md bg-primary/10"><Navigation className="size-4" aria-hidden="true" /></span><span className="text-sm font-semibold">Use Current Location</span>
              </button>
            ) : null}
            <p className="mb-1 mt-3 px-2 text-xs font-semibold uppercase text-muted-foreground">Saved & Recent</p>
            <div className="divide-y divide-border">
              {SAVED_DESTINATIONS.map((destination) => {
                const Icon = destination.icon;
                return (
                  <button key={destination.label} type="button" className="flex min-h-16 w-full items-center gap-3 rounded-md px-2 text-left hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30" onClick={() => void selectAddress(destination.address)}>
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-muted text-foreground"><Icon className="size-4" aria-hidden="true" /></span>
                    <span className="min-w-0"><span className="block text-sm font-semibold text-foreground">{destination.label}</span><span className="block truncate text-xs text-muted-foreground">{destination.address}</span></span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
        {searchError ? <p className="mt-3 rounded-md border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive" role="status">{searchError}</p> : null}
      </div>
    </div>
  );
}
function PinLocationPanel({ point, location, addressBusy, error, onBack, onConfirm }: {
  point: ActivePoint;
  location: SelectedLocation;
  addressBusy: boolean;
  error: string | null;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const pickup = point === "pickup";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-b border-border px-4 pb-3 pt-3">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="icon" onClick={onBack} aria-label="Back to location search">
            <ArrowLeft className="size-5" aria-hidden="true" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-primary">Set Exact Location</p>
            <h2 className="truncate text-lg font-bold text-foreground">Confirm {pickup ? "Pickup" : "Destination"}</h2>
          </div>
          <LocateFixed className="size-5 text-destructive" aria-hidden="true" />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <div className="flex items-start gap-3 rounded-lg border border-border bg-surface-muted p-3" aria-live="polite" aria-busy={addressBusy}>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive">
            {addressBusy ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <MapPin className="size-4 fill-current" aria-hidden="true" />}
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-medium text-muted-foreground">{addressBusy ? "Finding address" : pickup ? "Pickup point" : "Destination point"}</span>
            <span className="mt-0.5 block text-sm font-semibold leading-5 text-foreground">{location.address}</span>
          </span>
        </div>
        {error ? <p className="mt-2 text-xs leading-5 text-warning" role="status">{error}</p> : null}
      </div>

      <div className="border-t border-border bg-surface p-4">
        <Button type="button" className="w-full text-base" disabled={addressBusy} onClick={onConfirm}>
          <Check className="size-4" aria-hidden="true" /> Confirm {pickup ? "Pickup" : "Destination"}
        </Button>
      </div>
    </div>
  );
}
function RideOptionsPanel({ pickup, drop, vehicleType, paymentMethod, estimates, selectedFare, isBooking, bookingError, onBack, onEditPoint, onVehicleChange, onPaymentChange, onBook }: {
  pickup: SelectedLocation;
  drop: SelectedLocation;
  vehicleType: VehicleType;
  paymentMethod: PaymentMethod;
  estimates: Array<{ data?: RideEstimate; isFetching: boolean; isError: boolean }>;
  selectedFare: number | null;
  isBooking: boolean;
  bookingError: Error | null;
  onBack: () => void;
  onEditPoint: (point: ActivePoint) => void;
  onVehicleChange: (vehicle: VehicleType) => void;
  onPaymentChange: (payment: PaymentMethod) => void;
  onBook: () => void;
}) {
  const selectedVehicle = VEHICLES.find((vehicle) => vehicle.value === vehicleType) ?? VEHICLES[0];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-b border-border px-4 pb-4 pt-3">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="icon" onClick={onBack} aria-label="Edit ride locations"><ArrowLeft className="size-5" aria-hidden="true" /></Button>
          <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-primary">Route Ready</p><h2 className="truncate text-lg font-bold text-foreground">Choose Your Ride</h2></div>
          <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground"><ShieldCheck className="size-4 text-success" aria-hidden="true" />Secure</span>
        </div>
        <div className="mt-3"><LocationFields pickup={pickup} drop={drop} onEditPickup={() => onEditPoint("pickup")} onEditDrop={() => onEditPoint("drop")} /></div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-28 pt-4">
        <div className="space-y-2">
          {VEHICLES.map((vehicle, index) => (
            <VehicleOptionCard key={vehicle.value} vehicle={vehicle} estimate={estimates[index]?.data} loading={Boolean(estimates[index]?.isFetching)} unavailable={Boolean(estimates[index]?.isError)} active={vehicleType === vehicle.value} onClick={() => onVehicleChange(vehicle.value)} />
          ))}
        </div>

        <fieldset className="mt-5">
          <legend className="text-xs font-semibold uppercase text-muted-foreground">Pay With</legend>
          <div className="mt-2 grid grid-cols-3 gap-2" aria-label="Payment method">
            {PAYMENTS.map((payment) => {
              const Icon = payment.icon;
              const active = paymentMethod === payment.value;
              return (
                <button key={payment.value} type="button" aria-pressed={active} className={cn("flex min-h-11 items-center justify-center gap-2 rounded-md border px-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30", active ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface text-muted-foreground hover:bg-surface-muted")} onClick={() => onPaymentChange(payment.value)}>
                  <Icon className="size-4" aria-hidden="true" />{payment.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <details className="group mt-5 rounded-lg border border-border bg-surface">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3 text-sm font-semibold text-foreground">
            <span className="flex items-center gap-2"><ShieldCheck className="size-4 text-success" aria-hidden="true" />Safety & Cancellation</span>
            <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="space-y-3 border-t border-border p-3"><CancellationPolicyCard serviceType="RIDE" /><ServiceDisclaimer serviceType="RIDE" compact /></div>
        </details>

        {bookingError ? <p className="mt-4 rounded-md border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive" role="status">{bookingError.message || "The ride could not be booked. Check your connection and try again."}</p> : null}
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10 border-t border-border bg-surface p-4 shadow-[0_-10px_24px_rgb(17,24,39,0.10)]">
        <Button type="button" className="w-full text-base" disabled={isBooking || selectedFare === null} onClick={onBook}>
          {isBooking ? `Finding ${selectedVehicle.label} Drivers...` : selectedFare === null ? `Checking ${selectedVehicle.label} Fare...` : `Book ${selectedVehicle.label} - ${currencyFormatter.format(selectedFare)}`}
        </Button>
        <p className="mt-2 text-center text-xs text-muted-foreground">Final fare is confirmed server-side before matching.</p>
      </div>
    </div>
  );
}

function VehicleOptionCard({ vehicle, estimate, loading, unavailable, active, onClick }: {
  vehicle: (typeof VEHICLES)[number];
  estimate?: RideEstimate;
  loading: boolean;
  unavailable: boolean;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = vehicle.icon;
  return (
    <button type="button" aria-pressed={active} disabled={unavailable} onClick={onClick} className={cn("flex min-h-20 w-full items-center gap-3 rounded-lg border bg-surface p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-55", active ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/45 hover:bg-surface-muted")}>
      <span className={cn("relative flex size-14 shrink-0 items-center justify-center rounded-lg", vehicle.tone)}>
        <Icon className="size-8" strokeWidth={1.8} aria-hidden="true" />
        {active ? <CircleCheck className="absolute -right-1 -top-1 size-5 rounded-full bg-surface text-primary" fill="currentColor" aria-hidden="true" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2"><span className="text-base font-bold text-foreground">{vehicle.label}</span><span className="rounded-full bg-surface-muted px-2 py-0.5 text-[0.68rem] font-semibold text-muted-foreground">{vehicle.badge}</span></span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{vehicle.helper}</span>
        <span className="mt-1 flex items-center gap-2 text-xs font-medium text-muted-foreground"><UsersRound className="size-3.5" aria-hidden="true" />{vehicle.capacity}{estimate ? <><span aria-hidden="true">/</span><Clock className="size-3.5" aria-hidden="true" />{estimate.durationMinutes} min trip</> : null}</span>
      </span>
      <span className="shrink-0 text-right">
        {loading ? <span className="text-xs font-semibold text-muted-foreground">Checking...</span> : null}
        {!loading && estimate ? <span className="block text-lg font-bold tabular-nums text-foreground">{currencyFormatter.format(Number(estimate.estimatedFare))}</span> : null}
        {!loading && unavailable ? <span className="text-xs font-semibold text-destructive">Unavailable</span> : null}
        {!loading && !estimate && !unavailable ? <span className="text-xs text-muted-foreground">Select route</span> : null}
      </span>
    </button>
  );
}