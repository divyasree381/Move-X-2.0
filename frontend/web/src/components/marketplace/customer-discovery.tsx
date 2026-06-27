"use client";

import { FormEvent, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LocateFixed, Search, SlidersHorizontal } from "lucide-react";

import { QueryState } from "@/providers/query-state";
import { Button, EmptyState, Input, Skeleton } from "@/components/ui";
import { geocodeAddress, listStores, searchStores, type StoreListItem } from "@/lib/api";
import { CategoryGrid } from "./category-grid";
import { StoreCard } from "./store-card";

type LocationState = {
  address: string;
  lat?: number;
  lng?: number;
};

export function CustomerDiscovery() {
  const [selectedType, setSelectedType] = useState<StoreListItem["type"] | undefined>();
  const [query, setQuery] = useState("");
  const [radiusKm, setRadiusKm] = useState(6);
  const [location, setLocation] = useState<LocationState>({ address: "Choose a delivery location" });
  const [addressInput, setAddressInput] = useState("");
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
    queryFn: () =>
      marketplaceParams.q
        ? searchStores({ ...marketplaceParams, q: marketplaceParams.q })
        : listStores(marketplaceParams),
  });

  async function useGps() {
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError("GPS is not available in this browser. Use the typed address fallback.");
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
      setLocationError(error instanceof Error ? error.message : "Could not geocode that address. Showing top-rated stores instead.");
    } finally {
      setIsLocating(false);
    }
  }

  const stores = storesQuery.data?.items ?? [];

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-border bg-surface p-4">
        <div className="grid gap-4 lg:grid-cols-[1fr_19rem]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand">Delivering to</p>
            <h2 className="mt-1 text-xl font-semibold text-foreground">{location.address}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {location.lat !== undefined && location.lng !== undefined ? "Nearby stores are sorted by distance and rating." : "Pick a location for nearby results, or browse top-rated partners."}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
            <Button type="button" variant="secondary" onClick={useGps} disabled={isLocating}>
              <LocateFixed className="size-4" aria-hidden="true" />
              {isLocating ? "Locating" : "Use GPS"}
            </Button>
            <form className="flex min-w-0 gap-2" onSubmit={useTypedAddress}>
              <label className="sr-only" htmlFor="delivery-address">Delivery address</label>
              <Input id="delivery-address" value={addressInput} onChange={(event) => setAddressInput(event.target.value)} placeholder="Type address" />
              <Button type="submit" variant="secondary" aria-label="Use typed address">Set</Button>
            </form>
          </div>
        </div>
        {locationError ? <p className="mt-3 text-sm text-destructive" role="status">{locationError}</p> : null}
      </section>

      <CategoryGrid selectedType={selectedType} onSelectType={setSelectedType} />

      <section className="rounded-md border border-border bg-surface p-4" aria-labelledby="stores-heading">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 id="stores-heading" className="text-base font-semibold text-foreground">Stores near you</h2>
            <p className="mt-1 text-sm text-muted-foreground">Search names, menu items, or tags with filters that stay keyboard accessible.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(12rem,1fr)_9rem] lg:w-[30rem]">
            <label className="block text-sm font-medium text-foreground" htmlFor="store-search">
              <span className="mb-1 flex items-center gap-2"><Search className="size-4 text-muted-foreground" aria-hidden="true" /> Search</span>
              <Input id="store-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Biryani, milk, pharmacy" />
            </label>
            <label className="block text-sm font-medium text-foreground" htmlFor="radius-filter">
              <span className="mb-1 flex items-center gap-2"><SlidersHorizontal className="size-4 text-muted-foreground" aria-hidden="true" /> Radius</span>
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

        <div className="mt-4">
          <QueryState isLoading={storesQuery.isLoading} isError={storesQuery.isError} error={storesQuery.error} onRetry={() => storesQuery.refetch()}>
            {stores.length > 0 ? (
              <div className="grid gap-3">
                {stores.map((store) => <StoreCard key={store.id} store={store} />)}
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