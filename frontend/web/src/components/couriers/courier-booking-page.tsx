"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MapSuggestion, SelectedLocation } from "@movex/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Banknote, Check, Clock, CreditCard, LoaderCircle, LocateFixed, MapIcon, MapPin, PackageCheck, Pencil, Search, ShieldCheck, UserRound, Wallet } from "lucide-react";

import { RideMap } from "@/components/rides";
import { CancellationPolicyCard } from "@/components/trust";
import { Button, Input, StatusPill } from "@/components/ui";
import { autocompleteLocations, createCourier, estimateCourier, geocodeAddress, getPlaceDetails, reverseGeocode, type CourierContactInput, type CourierCreateResponse, type CourierEstimate } from "@/lib/api";
import { cn } from "@/lib/utils";

const DEFAULT_PICKUP: SelectedLocation = { address: "Indiranagar, Bengaluru", lat: 12.9784, lng: 77.6408, source: "gps" };
const PAYMENTS = [
  { value: "CASH", label: "Cash", icon: Banknote },
  { value: "WALLET", label: "Wallet", icon: Wallet },
  { value: "ONLINE", label: "Online", icon: CreditCard },
] as const;
const QUICK_DESTINATIONS = ["Koramangala, Bengaluru", "HSR Layout, Bengaluru", "MG Road, Bengaluru"] as const;
const currencyFormatter = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

type ActivePoint = "pickup" | "drop";
type BookingStage = "route" | "pin" | "details";
type PaymentMethod = (typeof PAYMENTS)[number]["value"];

export function CourierBookingPage() {
  const [pickup, setPickup] = useState<SelectedLocation>(DEFAULT_PICKUP);
  const [drop, setDrop] = useState<SelectedLocation | null>(null);
  const [stage, setStage] = useState<BookingStage>("route");
  const [activePoint, setActivePoint] = useState<ActivePoint>("drop");
  const [pinMode, setPinMode] = useState<ActivePoint | null>(null);
  const [pinDraft, setPinDraft] = useState<SelectedLocation | null>(null);
  const [pinAddressBusy, setPinAddressBusy] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [packageDescription, setPackageDescription] = useState("Documents / small parcel");
  const [packageWeightKg, setPackageWeightKg] = useState("1");
  const [sender, setSender] = useState<CourierContactInput>({ name: "Sender", phone: "+919900000001" });
  const [recipient, setRecipient] = useState<CourierContactInput>({ name: "Recipient", phone: "+919900000002" });
  const [created, setCreated] = useState<CourierCreateResponse | null>(null);
  const reverseLookupId = useRef(0);

  const weight = Number(packageWeightKg);
  const estimateInput = useMemo(() => drop ? {
    pickup,
    drop,
    packageDescription,
    packageWeightKg: Number.isFinite(weight) && weight > 0 ? weight : undefined,
  } : null, [drop, packageDescription, pickup, weight]);

  const estimate = useQuery({
    queryKey: ["courier-estimate", pickup.lat, pickup.lng, drop?.lat, drop?.lng, packageDescription, estimateInput?.packageWeightKg],
    queryFn: () => estimateCourier(estimateInput!),
    enabled: Boolean(estimateInput && packageDescription.trim().length > 1 && stage !== "pin"),
    retry: false,
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: () => {
      if (!estimateInput || !estimate.data) throw new Error("A live courier route and fare are required before booking.");
      return createCourier({ ...estimateInput, sender, recipient, paymentMethod });
    },
    onSuccess: setCreated,
  });

  const routeLabel = estimate.data
    ? `${Number(estimate.data.distanceKm).toFixed(1)} km - ${estimate.data.durationMinutes} min delivery`
    : estimate.isFetching ? "Calculating courier route..." : "Choose delivery location";

  function beginPinning(point: ActivePoint, location: SelectedLocation) {
    reverseLookupId.current += 1;
    setActivePoint(point);
    setPinMode(point);
    setPinDraft({ ...location, source: "map-click" });
    setPinAddressBusy(false);
    setLocationError(null);
    setStage("pin");
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
          setLocationError("The pin is saved, but its address is temporarily unavailable.");
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
    setStage("route");
  }

  function confirmPinnedLocation() {
    if (!pinMode || !pinDraft) return;
    if (pinMode === "pickup") {
      setPickup(pinDraft);
      if (!drop) setActivePoint("drop");
    } else {
      setDrop(pinDraft);
    }
    setPinMode(null);
    setPinDraft(null);
    setPinAddressBusy(false);
    setLocationError(null);
    setStage("route");
  }

  function editLocation(point: ActivePoint) {
    setActivePoint(point);
    setStage("route");
  }

  return (
    <div className="relative h-[calc(100dvh-4rem)] min-h-[36rem] overflow-hidden bg-surface-muted">
      <RideMap
        phase="booking"
        pickup={pickup}
        drop={drop}
        routeLabel={routeLabel}
        routePolyline={pinMode ? null : estimate.data?.polyline}
        pinMode={stage === "pin" ? pinMode : null}
        pinLocation={pinDraft}
        onPinCenterChange={updatePinCenter}
      />

      <aside className={cn(
        "absolute inset-x-0 bottom-0 z-20 flex w-full flex-col overflow-hidden rounded-t-lg border-t border-border bg-surface shadow-[0_-12px_32px_rgb(17,24,39,0.16)] motion-safe:animate-[content-in_180ms_ease-out]",
        "lg:left-auto lg:right-4 lg:w-[28rem] lg:rounded-lg lg:border lg:shadow-[0_18px_48px_rgb(17,24,39,0.16)]",
        stage === "pin" ? "max-h-[21rem] lg:bottom-4 lg:max-h-[23rem]" : "h-[min(78dvh,48rem)] lg:inset-y-4 lg:h-auto",
      )} aria-label="Courier booking">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border lg:hidden" aria-hidden="true" />
        {stage === "route" ? <CourierRoutePanel pickup={pickup} drop={drop} activePoint={activePoint} estimate={estimate.data} estimateLoading={estimate.isFetching} estimateError={estimate.isError} onActivePointChange={setActivePoint} onSelectLocation={beginPinning} onContinue={() => setStage("details")} /> : null}
        {stage === "pin" && pinMode && pinDraft ? <CourierPinPanel point={pinMode} location={pinDraft} addressBusy={pinAddressBusy} error={locationError} onBack={cancelPinning} onConfirm={confirmPinnedLocation} /> : null}
        {stage === "details" ? <CourierDetailsPanel pickup={pickup} drop={drop!} estimate={estimate.data} estimateLoading={estimate.isFetching} sender={sender} recipient={recipient} packageDescription={packageDescription} packageWeightKg={packageWeightKg} paymentMethod={paymentMethod} booking={createMutation.isPending} bookingError={createMutation.error} onBack={() => setStage("route")} onEditLocation={editLocation} onSenderChange={setSender} onRecipientChange={setRecipient} onPackageDescriptionChange={setPackageDescription} onPackageWeightChange={setPackageWeightKg} onPaymentChange={setPaymentMethod} onBook={() => createMutation.mutate()} /> : null}
      </aside>

      {created ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <section className="w-full max-w-sm rounded-lg border border-border bg-surface p-5 shadow-lg" aria-live="polite">
            <StatusPill label="Courier Requested" tone="success" />
            <h2 className="mt-3 text-xl font-bold text-foreground">Finding a delivery partner</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{created.offeredPartners > 0 ? `${created.offeredPartners} nearby partners received your parcel request.` : "We are expanding the search around your pickup."}</p>
            {created.devOtps ? <p className="mt-3 rounded-md border border-warning/30 bg-warning/10 p-3 text-xs text-foreground">Development OTPs: pickup {created.devOtps.pickup}, delivery {created.devOtps.delivery}</p> : null}
            <div className="mt-5 flex flex-col gap-2">
              <Button asChild className="w-full"><Link href={`/customer/couriers/${created.courier.id}`}>Track Parcel</Link></Button>
              <Button variant="secondary" className="w-full" onClick={() => { setCreated(null); setDrop(null); setStage("route"); }}>Send Another Parcel</Button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function CourierRoutePanel({ pickup, drop, activePoint, estimate, estimateLoading, estimateError, onActivePointChange, onSelectLocation, onContinue }: {
  pickup: SelectedLocation;
  drop: SelectedLocation | null;
  activePoint: ActivePoint;
  estimate?: CourierEstimate;
  estimateLoading: boolean;
  estimateError: boolean;
  onActivePointChange: (point: ActivePoint) => void;
  onSelectLocation: (point: ActivePoint, location: SelectedLocation) => void;
  onContinue: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-b border-border px-5 pb-4 pt-4">
        <div>
          <p className="text-sm font-semibold text-courier">Parcel Delivery</p>
          <h1 className="mt-1 text-2xl font-bold text-foreground">Where should we deliver?</h1>
        </div>
        <div className="mt-4">
          <CourierLocationFields pickup={pickup} drop={drop} activePoint={activePoint} onEdit={onActivePointChange} />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <CourierLocationSearch activePoint={activePoint} pickup={pickup} onSelect={(location) => onSelectLocation(activePoint, location)} />

        <div className="mt-5 border-t border-border pt-4" aria-live="polite">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Delivery Estimate</p>
          {estimateLoading ? (
            <div className="mt-2 flex min-h-14 items-center gap-3 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin text-courier" aria-hidden="true" />Calculating the road route...</div>
          ) : estimate ? (
            <div className="mt-2 grid grid-cols-3 gap-2">
              <EstimateMetric label="Distance" value={`${Number(estimate.distanceKm).toFixed(1)} km`} />
              <EstimateMetric label="ETA" value={`${estimate.durationMinutes} min`} />
              <EstimateMetric label="Fare" value={currencyFormatter.format(Number(estimate.estimatedFare))} />
            </div>
          ) : (
            <p className={cn("mt-2 text-sm", estimateError ? "text-destructive" : "text-muted-foreground")}>{estimateError ? "Route pricing is unavailable. Try the address again." : "Add the delivery location to see distance, ETA, and fare."}</p>
          )}
        </div>
      </div>

      <div className="border-t border-border bg-surface p-4">
        <Button type="button" className="w-full text-base" disabled={!drop || !estimate || estimateLoading} onClick={onContinue}>
          {estimate ? `Continue - ${currencyFormatter.format(Number(estimate.estimatedFare))}` : "Continue"}
        </Button>
        <p className="mt-2 text-center text-xs text-muted-foreground">Pickup and delivery are protected by separate OTPs.</p>
      </div>
    </div>
  );
}

function CourierLocationFields({ pickup, drop, activePoint, onEdit }: {
  pickup: SelectedLocation;
  drop: SelectedLocation | null;
  activePoint: ActivePoint;
  onEdit: (point: ActivePoint) => void;
}) {
  return (
    <div className="relative rounded-lg border border-border bg-surface p-3 shadow-sm">
      <span className="absolute bottom-[2.15rem] left-[1.47rem] top-[2.15rem] w-px bg-border" aria-hidden="true" />
      <button type="button" className={cn("relative flex min-h-12 w-full items-center gap-3 rounded-md px-1 text-left hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30", activePoint === "pickup" && "bg-courier-soft/50")} onClick={() => onEdit("pickup")}>
        <span className="z-10 flex size-4 shrink-0 items-center justify-center rounded-full bg-courier-soft"><span className="size-2 rounded-full bg-courier" /></span>
        <span className="min-w-0 flex-1"><span className="block text-xs font-medium text-muted-foreground">Parcel Pickup</span><span className="block truncate text-sm font-semibold text-foreground">{pickup.address}</span></span>
        <Pencil className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>
      <div className="my-1 ml-7 border-t border-border" />
      <button type="button" className={cn("relative flex min-h-12 w-full items-center gap-3 rounded-md px-1 text-left hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30", activePoint === "drop" && "bg-surface-muted")} onClick={() => onEdit("drop")}>
        <MapPin className="z-10 size-4 shrink-0 fill-destructive text-destructive" aria-hidden="true" />
        <span className="min-w-0 flex-1"><span className="block text-xs font-medium text-muted-foreground">Deliver To</span><span className={cn("block truncate font-semibold", drop ? "text-sm text-foreground" : "text-base text-muted-foreground")}>{drop?.address ?? "Search delivery address"}</span></span>
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>
    </div>
  );
}

function CourierLocationSearch({ activePoint, pickup, onSelect }: {
  activePoint: ActivePoint;
  pickup: SelectedLocation;
  onSelect: (location: SelectedLocation) => void;
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<MapSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setQuery("");
    setSuggestions([]);
    setError(null);
  }, [activePoint]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const results = await autocompleteLocations(trimmed, { lat: pickup.lat, lng: pickup.lng });
        if (!controller.signal.aborted) setSuggestions(results);
      } catch {
        if (!controller.signal.aborted) {
          setSuggestions([]);
          setError("Location suggestions are unavailable. Enter the complete address.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [pickup.lat, pickup.lng, query]);

  async function selectSuggestion(placeId: string) {
    setLoading(true);
    setError(null);
    try {
      onSelect(await getPlaceDetails(placeId));
    } catch {
      setError("That location could not be loaded. Try entering the full address.");
    } finally {
      setLoading(false);
    }
  }

  async function selectTypedAddress(address: string) {
    if (address.trim().length < 3) return;
    setLoading(true);
    setError(null);
    try {
      onSelect(await geocodeAddress(address.trim()));
    } catch {
      setError("We could not find that address. Check it and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function selectCurrentLocation() {
    if (!("geolocation" in navigator)) {
      setError("Location access is not supported. Search for the pickup address instead.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 });
      });
      const { latitude: lat, longitude: lng } = position.coords;
      let address = "Current location";
      try {
        address = await reverseGeocode(lat, lng);
      } catch {
        // Exact coordinates remain the source of truth when an address is unavailable.
      }
      onSelect({ address, lat, lng, source: "gps" });
    } catch {
      setError("We could not access your location. Check browser permission or search manually.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <label className="block text-xs font-semibold uppercase text-muted-foreground" htmlFor={`courier-${activePoint}-search`}>{activePoint === "pickup" ? "Find Pickup" : "Find Delivery Location"}</label>
      <div className="mt-2 flex min-h-12 items-center gap-3 rounded-lg border border-border bg-surface px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/20">
        {loading ? <LoaderCircle className="size-4 shrink-0 animate-spin text-courier" aria-hidden="true" /> : <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
        <input id={`courier-${activePoint}-search`} autoComplete="off" className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground" value={query} placeholder={activePoint === "pickup" ? "Search pickup address" : "Where should we deliver?"} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void selectTypedAddress(query); }} />
      </div>

      {suggestions.length > 0 ? (
        <ul className="mt-2 divide-y divide-border" aria-label="Location suggestions">
          {suggestions.map((suggestion) => (
            <li key={suggestion.placeId}>
              <button type="button" className="flex min-h-12 w-full items-center gap-3 rounded-md px-2 text-left hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30" onClick={() => void selectSuggestion(suggestion.placeId)}>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-muted text-muted-foreground"><MapIcon className="size-4" aria-hidden="true" /></span>
                <span className="min-w-0"><span className="block truncate text-sm font-semibold text-foreground">{suggestion.mainText}</span>{suggestion.secondaryText ? <span className="block truncate text-xs text-muted-foreground">{suggestion.secondaryText}</span> : null}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {loading && query.trim().length >= 2 ? (
        <div className="mt-2 space-y-1" aria-hidden="true">
          {[0, 1].map((item) => (
            <div key={item} className="flex min-h-12 animate-pulse items-center gap-3 px-2">
              <span className="size-8 shrink-0 rounded-md bg-surface-muted" />
              <span className="space-y-2"><span className="block h-3 w-40 rounded bg-surface-muted" /><span className="block h-2.5 w-28 rounded bg-surface-muted" /></span>
            </div>
          ))}
        </div>
      ) : null}

      {!loading && query.trim().length < 2 ? (
        <div className="mt-2 divide-y divide-border">
          {activePoint === "pickup" ? (
            <button type="button" className="flex min-h-12 w-full items-center gap-3 rounded-md px-2 text-left text-primary hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30" onClick={() => void selectCurrentLocation()}>
              <span className="flex size-8 items-center justify-center rounded-md bg-primary/10"><LocateFixed className="size-4" aria-hidden="true" /></span><span className="text-sm font-semibold">Use Current Location</span>
            </button>
          ) : QUICK_DESTINATIONS.map((address) => (
            <button key={address} type="button" className="flex min-h-12 w-full items-center gap-3 rounded-md px-2 text-left hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30" onClick={() => void selectTypedAddress(address)}>
              <span className="flex size-8 items-center justify-center rounded-md bg-surface-muted text-muted-foreground"><Clock className="size-4" aria-hidden="true" /></span><span className="truncate text-sm font-semibold text-foreground">{address}</span>
            </button>
          ))}
        </div>
      ) : null}
      {error ? <p className="mt-2 rounded-md border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive" role="status">{error}</p> : null}
    </div>
  );
}

function EstimateMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface-muted p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-bold tabular-nums text-foreground">{value}</p>
    </div>
  );
}
function CourierPinPanel({ point, location, addressBusy, error, onBack, onConfirm }: {
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
          <Button type="button" variant="ghost" size="icon" onClick={onBack} aria-label="Back to courier location search"><ArrowLeft className="size-5" aria-hidden="true" /></Button>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-courier">Set Exact Location</p>
            <h2 className="truncate text-lg font-bold text-foreground">Confirm {pickup ? "Parcel Pickup" : "Delivery Point"}</h2>
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
            <span className="block text-xs font-medium text-muted-foreground">{addressBusy ? "Finding address" : pickup ? "Pickup entrance" : "Delivery entrance"}</span>
            <span className="mt-0.5 block text-sm font-semibold leading-5 text-foreground">{location.address}</span>
          </span>
        </div>
        {error ? <p className="mt-2 text-xs leading-5 text-warning" role="status">{error}</p> : null}
      </div>

      <div className="border-t border-border bg-surface p-4">
        <Button type="button" className="w-full text-base" disabled={addressBusy} onClick={onConfirm}>
          <Check className="size-4" aria-hidden="true" /> Confirm {pickup ? "Pickup" : "Delivery"}
        </Button>
      </div>
    </div>
  );
}

function CourierDetailsPanel({ pickup, drop, estimate, estimateLoading, sender, recipient, packageDescription, packageWeightKg, paymentMethod, booking, bookingError, onBack, onEditLocation, onSenderChange, onRecipientChange, onPackageDescriptionChange, onPackageWeightChange, onPaymentChange, onBook }: {
  pickup: SelectedLocation;
  drop: SelectedLocation;
  estimate?: CourierEstimate;
  estimateLoading: boolean;
  sender: CourierContactInput;
  recipient: CourierContactInput;
  packageDescription: string;
  packageWeightKg: string;
  paymentMethod: PaymentMethod;
  booking: boolean;
  bookingError: Error | null;
  onBack: () => void;
  onEditLocation: (point: ActivePoint) => void;
  onSenderChange: (contact: CourierContactInput) => void;
  onRecipientChange: (contact: CourierContactInput) => void;
  onPackageDescriptionChange: (value: string) => void;
  onPackageWeightChange: (value: string) => void;
  onPaymentChange: (method: PaymentMethod) => void;
  onBook: () => void;
}) {
  const valid = Boolean(estimate && sender.name.trim() && sender.phone.trim() && recipient.name.trim() && recipient.phone.trim() && packageDescription.trim() && Number(packageWeightKg) > 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-b border-border px-4 pb-4 pt-3">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="icon" onClick={onBack} aria-label="Back to courier route"><ArrowLeft className="size-5" aria-hidden="true" /></Button>
          <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-courier">Parcel Details</p><h2 className="truncate text-lg font-bold text-foreground">Review and Request</h2></div>
          <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground"><ShieldCheck className="size-4 text-success" aria-hidden="true" />OTP Secured</span>
        </div>
        <div className="mt-3"><CourierLocationFields pickup={pickup} drop={drop} activePoint="drop" onEdit={onEditLocation} /></div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-28 pt-4">
        <fieldset className="border-b border-border pb-5">
          <legend className="flex items-center gap-2 text-sm font-bold text-foreground"><PackageCheck className="size-4 text-courier" aria-hidden="true" />Parcel</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_7rem]">
            <label className="space-y-1 text-xs font-medium text-muted-foreground"><span>Contents</span><Input value={packageDescription} onChange={(event) => onPackageDescriptionChange(event.target.value)} placeholder="Documents, medicines, clothes" /></label>
            <label className="space-y-1 text-xs font-medium text-muted-foreground"><span>Weight (kg)</span><Input inputMode="decimal" value={packageWeightKg} onChange={(event) => onPackageWeightChange(event.target.value)} placeholder="1" /></label>
          </div>
        </fieldset>

        <fieldset className="border-b border-border py-5">
          <legend className="flex items-center gap-2 text-sm font-bold text-foreground"><UserRound className="size-4 text-courier" aria-hidden="true" />Contacts</legend>
          <div className="mt-3 space-y-4">
            <ContactFields title="Sender" value={sender} onChange={onSenderChange} />
            <ContactFields title="Recipient" value={recipient} onChange={onRecipientChange} />
          </div>
        </fieldset>

        <fieldset className="border-b border-border py-5">
          <legend className="text-sm font-bold text-foreground">Payment</legend>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {PAYMENTS.map((method) => {
              const Icon = method.icon;
              const active = paymentMethod === method.value;
              return (
                <button key={method.value} type="button" aria-pressed={active} className={cn("flex min-h-11 items-center justify-center gap-2 rounded-md border px-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30", active ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface text-muted-foreground hover:bg-surface-muted")} onClick={() => onPaymentChange(method.value)}>
                  <Icon className="size-4" aria-hidden="true" />{method.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="py-5"><CancellationPolicyCard serviceType="COURIER" /></div>
        {bookingError ? <p className="rounded-md border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive" role="status">{bookingError.message || "The courier could not be requested. Check your connection and try again."}</p> : null}
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10 border-t border-border bg-surface p-4 shadow-[0_-10px_24px_rgb(17,24,39,0.10)]">
        <Button type="button" className="w-full text-base" disabled={!valid || estimateLoading || booking} onClick={onBook}>
          {booking ? "Finding Delivery Partners..." : estimate ? `Request Courier - ${currencyFormatter.format(Number(estimate.estimatedFare))}` : "Checking Courier Fare..."}
        </Button>
        <p className="mt-2 text-center text-xs text-muted-foreground">Final fare is confirmed server-side before matching.</p>
      </div>
    </div>
  );
}

function ContactFields({ title, value, onChange }: { title: string; value: CourierContactInput; onChange: (contact: CourierContactInput) => void }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-muted-foreground">{title}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <Input value={value.name} onChange={(event) => onChange({ ...value, name: event.target.value })} placeholder={`${title} name`} aria-label={`${title} name`} />
        <Input value={value.phone} onChange={(event) => onChange({ ...value, phone: event.target.value })} placeholder="Phone number" aria-label={`${title} phone number`} />
      </div>
      <Input className="mt-2" value={value.note ?? ""} onChange={(event) => onChange({ ...value, note: event.target.value })} placeholder="Landmark or delivery note (optional)" aria-label={`${title} note`} />
    </div>
  );
}