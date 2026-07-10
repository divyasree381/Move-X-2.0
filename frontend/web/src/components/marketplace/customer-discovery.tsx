"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Home, LocateFixed, MapPin, Search, SlidersHorizontal, X } from "lucide-react";

import { CategoryGrid } from "./category-grid";
import { StoreCard } from "./store-card";
import { Button, EmptyState, Input, Skeleton } from "@/components/ui";
import { QueryState } from "@/providers/query-state";
import { geocodeAddress, listStores, searchStores, type StoreListItem } from "@/lib/api";
import { publicServices } from "@/lib/public-site-data";

type LocationState = { address: string; lat?: number; lng?: number };
type StoreSortMode = "recommended" | "rating" | "fastest" | "nearest" | "min-order";

const recentSearches = ["biryani", "milk", "medicine", "bike ride"];
const popularSearches: Array<{ label: string; query: string; type?: StoreListItem["type"] }> = [
  { label: "Dinner near me", query: "biryani", type: "FOOD" },
  { label: "Daily staples", query: "milk", type: "GROCERY" },
  { label: "Pharmacy nearby", query: "medicine", type: "PHARMACY" },
];
const savedAddresses = [
  { label: "Home", detail: "Indiranagar, Bengaluru", lat: 12.9784, lng: 77.6408 },
  { label: "Work", detail: "MG Road, Bengaluru", lat: 12.9756, lng: 77.6068 },
];
const quickServiceIds = new Set(["rides", "courier", "home"]);
const quickServices = publicServices.filter((service) => quickServiceIds.has(service.id)).map((service) => ({
  ...service,
  href: service.id === "rides" ? "/customer/rides" : service.href,
}));

export function CustomerDiscovery() {
  const [selectedType, setSelectedType] = useState<StoreListItem["type"] | undefined>();
  const [query, setQuery] = useState("");
  const [radiusKm, setRadiusKm] = useState(6);
  const [storeSort, setStoreSort] = useState<StoreSortMode>("recommended");
  const [location, setLocation] = useState<LocationState>({ address: "Indiranagar, Bengaluru", lat: 12.930656, lng: 77.638097 });
  const [addressInput, setAddressInput] = useState("Indiranagar, Bengaluru");
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [showLocationPanel, setShowLocationPanel] = useState(false);

  const trimmedQuery = query.trim();
  const marketplaceParams = useMemo(() => ({
    q: trimmedQuery.length >= 2 ? trimmedQuery : undefined,
    lat: location.lat,
    lng: location.lng,
    radiusKm: location.lat !== undefined && location.lng !== undefined ? radiusKm : undefined,
    type: selectedType,
    limit: 20,
  }), [location.lat, location.lng, radiusKm, selectedType, trimmedQuery]);

  const storesQuery = useQuery({
    queryKey: ["marketplace", marketplaceParams],
    queryFn: () => marketplaceParams.q ? searchStores({ ...marketplaceParams, q: marketplaceParams.q }) : listStores(marketplaceParams),
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
        setLocation({ address: "Current GPS location", lat: position.coords.latitude, lng: position.coords.longitude });
        setIsLocating(false);
        setShowLocationPanel(false);
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
      setShowLocationPanel(false);
    } catch (error) {
      setLocation({ address });
      setLocationError(error instanceof Error ? error.message : "Showing city-wide results.");
    } finally {
      setIsLocating(false);
    }
  }

  function applySavedAddress(address: (typeof savedAddresses)[number]) {
    setAddressInput(address.detail);
    setLocation({ address: address.detail, lat: address.lat, lng: address.lng });
    setLocationError(null);
    setShowLocationPanel(false);
  }

  function applySuggestedSearch(nextQuery: string, nextType?: StoreListItem["type"]) {
    setQuery(nextQuery);
    setSelectedType(nextType);
  }

  const sortedStores = useMemo(() => sortStores(storesQuery.data?.items ?? [], storeSort), [storeSort, storesQuery.data?.items]);

  return (
    <div className="space-y-9">
      <section aria-labelledby="customer-home-heading">
        <button id="location" type="button" className="inline-flex max-w-full items-center gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30" onClick={() => setShowLocationPanel((open) => !open)} aria-expanded={showLocationPanel}>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><MapPin className="size-4" aria-hidden="true" /></span>
          <span className="min-w-0"><span className="block text-xs font-semibold text-muted-foreground">Services near</span><span className="block truncate text-sm font-bold text-foreground">{location.address}</span></span>
          <span className="text-xs font-semibold text-primary">Change</span>
        </button>

        <div className="mt-5 max-w-3xl">
          <h1 id="customer-home-heading" className="text-3xl font-bold leading-tight text-foreground sm:text-4xl">What can we get moving?</h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">Food, essentials, rides, parcels, and trusted help around your location.</p>
        </div>

        <div id="search" className="mt-5 flex max-w-4xl items-center gap-2 rounded-lg border border-border bg-surface p-2 shadow-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/20">
          <Search className="ml-2 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <Input id="super-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search biryani, groceries, medicine, or services" className="min-h-11 flex-1 border-0 bg-transparent px-1 text-base shadow-none focus-visible:ring-0" />
          {query ? <Button type="button" variant="ghost" size="icon" onClick={() => setQuery("")} aria-label="Clear search"><X className="size-4" aria-hidden="true" /></Button> : null}
          <Button type="button" className="hidden min-h-11 px-5 sm:inline-flex" onClick={() => setSelectedType(undefined)}>Search</Button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2" aria-label="Suggested searches">
          {recentSearches.slice(0, 3).map((item) => <SearchChip key={item} label={item} onClick={() => applySuggestedSearch(item)} />)}
          {popularSearches.map((item) => <SearchChip key={item.label} label={item.label} onClick={() => applySuggestedSearch(item.query, item.type)} />)}
        </div>
      </section>

      {showLocationPanel ? (
        <section className="border-y border-border bg-surface py-5" aria-label="Change delivery location">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <p className="text-sm font-bold text-foreground">Choose your location</p>
              <form className="mt-3 flex max-w-2xl flex-col gap-2 sm:flex-row" onSubmit={useTypedAddress}>
                <Input value={addressInput} onChange={(event) => setAddressInput(event.target.value)} placeholder="Type area, landmark, or address" className="min-h-11 flex-1" />
                <Button type="submit" disabled={isLocating}>Set Location</Button>
                <Button type="button" variant="secondary" disabled={isLocating} onClick={useGps}><LocateFixed className="size-4" aria-hidden="true" />Use GPS</Button>
              </form>
              {locationError ? <p className="mt-2 text-sm text-destructive" role="status">{locationError}</p> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {savedAddresses.map((address) => (
                <button key={address.label} type="button" className="flex min-h-11 items-center gap-2 rounded-md border border-border bg-background px-3 text-left hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30" onClick={() => applySavedAddress(address)}>
                  <Home className="size-4 text-primary" aria-hidden="true" /><span><span className="block text-xs font-bold text-foreground">{address.label}</span><span className="block text-xs text-muted-foreground">{address.detail}</span></span>
                </button>
              ))}
            </div>
          </div>
          <p className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-success"><CheckCircle2 className="size-4" aria-hidden="true" />Food, rides, courier, pharmacy, and service slots are available in this area.</p>
        </section>
      ) : null}

      <CategoryGrid selectedType={selectedType} onSelectType={setSelectedType} />

      <section aria-labelledby="quick-book-heading">
        <div>
          <p className="text-sm font-semibold text-primary">Quick Booking</p>
          <h2 id="quick-book-heading" className="mt-1 text-2xl font-bold text-foreground">More ways to move</h2>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {quickServices.map((service) => (
            <Link key={service.id} href={service.href} className="group grid min-h-36 overflow-hidden rounded-lg border border-border bg-surface shadow-sm transition hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 sm:grid-cols-[8rem_1fr] md:grid-cols-1 xl:grid-cols-[8rem_1fr]">
              <span className="relative min-h-32 overflow-hidden bg-surface-muted md:min-h-36 xl:min-h-32">
                <Image src={service.imageUrl} alt="" fill unoptimized sizes="(max-width: 768px) 128px, (max-width: 1280px) 33vw, 128px" className="object-cover transition duration-300 group-hover:scale-[1.04]" />
              </span>
              <span className="flex min-w-0 flex-col justify-center p-4">
                <span className="text-base font-bold text-foreground">{service.label}</span>
                <span className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">{service.description}</span>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">Open <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden="true" /></span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-t border-border pt-8" aria-labelledby="stores-heading">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-primary">Near {location.address}</p>
            <h2 id="stores-heading" className="mt-1 text-2xl font-bold text-foreground">Popular stores</h2>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            {selectedType ? <Button type="button" variant="secondary" size="sm" onClick={() => setSelectedType(undefined)}>Clear Category</Button> : null}
            <label className="text-xs font-semibold text-muted-foreground" htmlFor="store-sort"><span className="mb-1 flex items-center gap-1"><SlidersHorizontal className="size-3.5" aria-hidden="true" />Sort</span><select id="store-sort" value={storeSort} onChange={(event) => setStoreSort(event.target.value as StoreSortMode)} className="min-h-10 rounded-md border border-border bg-surface px-3 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"><option value="recommended">Recommended</option><option value="rating">Top Rated</option><option value="fastest">Fastest</option><option value="nearest">Nearest</option><option value="min-order">Low Minimum</option></select></label>
            <label className="text-xs font-semibold text-muted-foreground" htmlFor="radius-filter"><span className="mb-1 flex items-center gap-1"><MapPin className="size-3.5" aria-hidden="true" />Distance</span><select id="radius-filter" value={radiusKm} onChange={(event) => setRadiusKm(Number(event.target.value))} className="min-h-10 rounded-md border border-border bg-surface px-3 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"><option value={3}>Within 3 km</option><option value={6}>Within 6 km</option><option value={10}>Within 10 km</option><option value={15}>Within 15 km</option></select></label>
          </div>
        </div>

        <div className="mt-5">
          <QueryState isLoading={storesQuery.isLoading} isError={storesQuery.isError} error={storesQuery.error} onRetry={() => storesQuery.refetch()}>
            {sortedStores.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {sortedStores.map((store) => <StoreCard key={store.id} store={store} />)}
              </div>
            ) : (
              <EmptyState title="No stores found" description="Try a wider distance, another category, or a broader search." />
            )}
          </QueryState>
        </div>
      </section>

      {storesQuery.isFetching && !storesQuery.isLoading ? <Skeleton className="h-1" /> : null}
    </div>
  );
}

function SearchChip({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-primary/35 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30" onClick={onClick}>{label}</button>;
}

function sortStores(stores: StoreListItem[], sortMode: StoreSortMode) {
  return [...stores].sort((a, b) => {
    if (sortMode === "rating") return Number(b.ratingAverage) - Number(a.ratingAverage) || b.ratingCount - a.ratingCount;
    if (sortMode === "fastest") return a.etaMinutes - b.etaMinutes;
    if (sortMode === "nearest") return (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY);
    if (sortMode === "min-order") return Number(a.minOrder) - Number(b.minOrder);
    return Number(b.ratingAverage) - Number(a.ratingAverage) || a.etaMinutes - b.etaMinutes;
  });
}