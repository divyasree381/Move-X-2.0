"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock3, Home, LocateFixed, MapPin, Search, ShieldCheck, SlidersHorizontal, WalletCards } from "lucide-react";

import { QueryState } from "@/providers/query-state";
import { Button, EmptyState, Input, Skeleton, StatusPill } from "@/components/ui";
import { geocodeAddress, listStores, searchStores, type StoreListItem } from "@/lib/api";
import { CategoryGrid } from "./category-grid";
import { StoreCard } from "./store-card";

type LocationState = {
  address: string;
  lat?: number;
  lng?: number;
};

type StoreSortMode = "recommended" | "rating" | "fastest" | "nearest" | "min-order";

const quickPicks = ["Food", "Grocery", "Pharmacy", "Rides", "Courier", "Home Services"];
const recentSearches = ["biryani", "milk", "medicine", "bike ride"];
const popularSearches: Array<{ label: string; query: string; type?: StoreListItem["type"] }> = [
  { label: "Dinner near me", query: "biryani", type: "FOOD" },
  { label: "Daily staples", query: "milk", type: "GROCERY" },
  { label: "Prescription-ready", query: "medicine", type: "PHARMACY" },
  { label: "Fast stores", query: "", type: undefined },
];
const savedAddresses = [
  { label: "Home", detail: "Indiranagar, Bengaluru", lat: 12.9784, lng: 77.6408 },
  { label: "Work", detail: "MG Road, Bengaluru", lat: 12.9756, lng: 77.6068 },
];

export function CustomerDiscovery() {
  const [selectedType, setSelectedType] = useState<StoreListItem["type"] | undefined>();
  const [query, setQuery] = useState("");
  const [radiusKm, setRadiusKm] = useState(6);
  const [storeSort, setStoreSort] = useState<StoreSortMode>("recommended");
  const [location, setLocation] = useState<LocationState>({ address: "Bengaluru, Karnataka", lat: 12.930656, lng: 77.638097 });
  const [addressInput, setAddressInput] = useState("Indiranagar, Bengaluru");
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const trimmedQuery = query.trim();
  const marketplaceParams = useMemo(
    () => ({
      q: trimmedQuery.length >= 2 ? trimmedQuery : undefined,
      lat: location.lat,
      lng: location.lng,
      radiusKm: location.lat !== undefined && location.lng !== undefined ? radiusKm : undefined,
      type: selectedType,
      limit: 20,
    }),
    [location.lat, location.lng, radiusKm, selectedType, trimmedQuery],
  );

  const storesQuery = useQuery({
    queryKey: ["marketplace", marketplaceParams],
    queryFn: () => (marketplaceParams.q ? searchStores({ ...marketplaceParams, q: marketplaceParams.q }) : listStores(marketplaceParams)),
  });

  async function useGps() {
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError("GPS is unavailable. Type an address instead.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          address: "Current GPS location",
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setIsLocating(false);
      },
      () => {
        setLocationError("Unable to read GPS. Type an address instead.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  async function useTypedAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const address = addressInput.trim();

    if (address.length < 4) {
      setLocationError("Enter a more specific address.");
      return;
    }

    try {
      setIsLocating(true);
      setLocationError(null);
      const selected = await geocodeAddress(address);
      setLocation({ address: selected.address, lat: selected.lat, lng: selected.lng });
    } catch (error) {
      setLocation({ address });
      setLocationError(error instanceof Error ? error.message : "Showing city-wide results.");
    } finally {
      setIsLocating(false);
    }
  }

  function applySuggestedSearch(nextQuery: string, nextType?: StoreListItem["type"]) {
    setQuery(nextQuery);
    setSelectedType(nextType);
  }

  function applySavedAddress(address: (typeof savedAddresses)[number]) {
    setAddressInput(address.detail);
    setLocation({ address: address.detail, lat: address.lat, lng: address.lng });
    setLocationError(null);
  }

  const stores = storesQuery.data?.items ?? [];
  const sortedStores = useMemo(() => sortStores(stores, storeSort), [storeSort, stores]);

  return (
    <div className="space-y-5">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]" aria-labelledby="customer-home-heading">
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Customer home</p>
              <h1 id="customer-home-heading" className="mt-2 text-3xl font-black leading-tight tracking-normal text-foreground sm:text-4xl">
                Search, order, ride, send.
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                One pinned location powers stores, dishes, products, rides, courier pickup, and home services.
              </p>
            </div>
            <StatusPill label="Live in Bengaluru" tone="success" className="w-fit" />
          </div>

          <div className="mt-5 rounded-lg border border-border bg-surface-muted p-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <label className="relative block" htmlFor="super-search">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden={true} />
                <Input
                  id="super-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search stores, dishes, products, services"
                  className="min-h-12 bg-surface pl-10 text-base"
                />
              </label>
              <Button type="button" className="min-h-12 px-5" onClick={() => setSelectedType(undefined)}>
                Search nearby
              </Button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="size-3.5 text-primary" aria-hidden={true} />
              <span className="font-medium text-foreground">{location.address}</span>
              <span>Serviceable area</span>
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <SearchChips title="Recent searches" items={recentSearches.map((label) => ({ label, query: label }))} onPick={applySuggestedSearch} />
            <SearchChips title="Popular now" items={popularSearches} onPick={applySuggestedSearch} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2" aria-label="Available services">
            {quickPicks.map((pick) => (
              <span key={pick} className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                {pick}
              </span>
            ))}
          </div>
        </div>

        <aside className="rounded-lg border border-border bg-surface p-4 shadow-sm" aria-label="Pinned location">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Pinned location</p>
              <h2 className="mt-2 text-lg font-black text-foreground">{location.address}</h2>
              <p className="mt-1 text-sm text-muted-foreground">Change this once, then browse everything nearby.</p>
            </div>
            <span className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <MapPin size={18} aria-hidden={true} />
            </span>
          </div>

          <form className="mt-4 grid gap-2" onSubmit={useTypedAddress}>
            <label className="sr-only" htmlFor="delivery-address">Delivery address</label>
            <Input id="delivery-address" value={addressInput} onChange={(event) => setAddressInput(event.target.value)} placeholder="Type area or address" />
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="secondary" onClick={useGps} disabled={isLocating}>
                <LocateFixed className="size-4" aria-hidden={true} />
                {isLocating ? "Locating" : "Use GPS"}
              </Button>
              <Button type="submit" variant="secondary">Set location</Button>
            </div>
          </form>

          {locationError ? <p className="mt-3 text-sm text-destructive" role="status">{locationError}</p> : null}

          <div className="mt-4 rounded-md border border-success/20 bg-success/10 p-3 text-sm text-foreground">
            <p className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-4 text-success" aria-hidden={true} /> Serviceable in this area</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Food, grocery, pharmacy, rides, courier, and home-service slots can be checked from this pinned location.</p>
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Saved addresses</p>
            {savedAddresses.map((address) => (
              <button key={address.label} type="button" className="flex min-h-12 w-full items-center gap-3 rounded-md border border-border bg-surface-muted px-3 text-left transition hover:border-primary/35 hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30" onClick={() => applySavedAddress(address)}>
                <Home className="size-4 text-primary" aria-hidden={true} />
                <span>
                  <span className="block text-sm font-semibold text-foreground">{address.label}</span>
                  <span className="block text-xs text-muted-foreground">{address.detail}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <MiniMetric icon={Clock3} label="ETA" value="18m" />
            <MiniMetric icon={WalletCards} label="Wallet" value="Rs 0" />
            <MiniMetric icon={ShieldCheck} label="Support" value="24/7" />
          </div>
        </aside>
      </section>

      <CategoryGrid selectedType={selectedType} onSelectType={setSelectedType} />

      <section className="rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-5" aria-labelledby="stores-heading">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Marketplace</p>
            <h2 id="stores-heading" className="mt-1 text-2xl font-black tracking-normal text-foreground">Stores near you</h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(14rem,1fr)_10rem_9rem] lg:w-[42rem]">
            <label className="block text-sm font-semibold text-foreground" htmlFor="store-search">
              <span className="mb-1 flex items-center gap-2"><Search className="size-4 text-muted-foreground" aria-hidden={true} /> Search</span>
              <Input id="store-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Biryani, milk, pharmacy" />
            </label>
            <label className="block text-sm font-semibold text-foreground" htmlFor="store-sort">
              <span className="mb-1 flex items-center gap-2"><SlidersHorizontal className="size-4 text-muted-foreground" aria-hidden={true} /> Sort</span>
              <select
                id="store-sort"
                value={storeSort}
                onChange={(event) => setStoreSort(event.target.value as StoreSortMode)}
                className="min-h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground shadow-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
              >
                <option value="recommended">Recommended</option>
                <option value="rating">Top rated</option>
                <option value="fastest">Fastest</option>
                <option value="nearest">Nearest</option>
                <option value="min-order">Low minimum</option>
              </select>
            </label>
            <label className="block text-sm font-semibold text-foreground" htmlFor="radius-filter">
              <span className="mb-1 flex items-center gap-2"><MapPin className="size-4 text-muted-foreground" aria-hidden={true} /> Radius</span>
              <select
                id="radius-filter"
                value={radiusKm}
                onChange={(event) => setRadiusKm(Number(event.target.value))}
                className="min-h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground shadow-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
              >
                <option value={3}>3 km</option>
                <option value={6}>6 km</option>
                <option value={10}>10 km</option>
                <option value={15}>15 km</option>
              </select>
            </label>
          </div>
        </div>

        <div className="mt-5">
          <QueryState isLoading={storesQuery.isLoading} isError={storesQuery.isError} error={storesQuery.error} onRetry={() => storesQuery.refetch()}>
            {sortedStores.length > 0 ? (
              <div className="grid gap-3 xl:grid-cols-2">
                {sortedStores.map((store) => <StoreCard key={store.id} store={store} />)}
              </div>
            ) : (
              <EmptyState title="No stores found" description="Try a wider radius, a different category, or a broader search term." />
            )}
          </QueryState>
        </div>
      </section>

      {storesQuery.isFetching && !storesQuery.isLoading ? <Skeleton className="h-1" /> : null}
    </div>
  );
}

function SearchChips({ title, items, onPick }: { title: string; items: Array<{ label: string; query: string; type?: StoreListItem["type"] }>; onPick: (query: string, type?: StoreListItem["type"]) => void }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{title}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <button key={`${title}-${item.label}`} type="button" className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-primary/35 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30" onClick={() => onPick(item.query, item.type)}>
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function sortStores(stores: StoreListItem[], sortMode: StoreSortMode) {
  return [...stores].sort((a, b) => {
    if (sortMode === "rating") {
      return Number(b.ratingAverage) - Number(a.ratingAverage) || b.ratingCount - a.ratingCount;
    }
    if (sortMode === "fastest") {
      return a.etaMinutes - b.etaMinutes;
    }
    if (sortMode === "nearest") {
      return (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY);
    }
    if (sortMode === "min-order") {
      return Number(a.minOrder) - Number(b.minOrder);
    }

    return Number(b.ratingAverage) - Number(a.ratingAverage) || a.etaMinutes - b.etaMinutes;
  });
}

function MiniMetric({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface-muted p-3">
      <Icon className="size-4 text-primary" aria-hidden={true} />
      <p className="mt-2 text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-black text-foreground">{value}</p>
    </div>
  );
}