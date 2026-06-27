"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock3, LocateFixed, MapPin, Navigation, Search, ShieldCheck, SlidersHorizontal, Sparkles, WalletCards } from "lucide-react";

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

export function CustomerDiscovery() {
  const [selectedType, setSelectedType] = useState<StoreListItem["type"] | undefined>();
  const [query, setQuery] = useState("");
  const [radiusKm, setRadiusKm] = useState(6);
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

  const stores = storesQuery.data?.items ?? [];

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-lg border border-[#111827]/10 bg-[#111827] text-white shadow-[0_24px_80px_rgb(17_24_39_/_0.18)]">
        <div className="grid gap-0 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="p-5 sm:p-7 lg:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill label="Live in Bengaluru" tone="success" className="border-white/15 bg-white/10 text-white" />
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-xs font-semibold text-white/82">
                <Sparkles className="size-3.5 text-brand" aria-hidden={true} /> Food, rides, courier, home care
              </span>
            </div>
            <h1 className="mt-6 max-w-2xl text-4xl font-black leading-[1.05] tracking-normal sm:text-5xl">Everything nearby, moving on one MoveX loop.</h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/70 sm:text-base">Pick your location once. Discover stores, book rides, send parcels, and track every job from the same customer home.</p>

            <div className="mt-6 rounded-lg border border-white/12 bg-white/[0.07] p-3 backdrop-blur">
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <label className="relative block" htmlFor="super-search">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/45" aria-hidden={true} />
                  <Input
                    id="super-search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search biryani, milk, medicines, stores"
                    className="min-h-12 border-white/10 bg-white text-base text-[#111827] placeholder:text-slate-500"
                  />
                </label>
                <Button type="button" className="min-h-12 px-5" onClick={() => setSelectedType(undefined)}>
                  Search nearby
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/70">
                <MapPin className="size-3.5 text-brand" aria-hidden={true} />
                <span className="font-medium text-white">{location.address}</span>
                {location.lat !== undefined && location.lng !== undefined ? <span>{location.lat.toFixed(4)}, {location.lng.toFixed(4)}</span> : null}
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 bg-white/[0.05] p-5 sm:p-7 lg:border-l lg:border-t-0 lg:p-8">
            <div className="rounded-lg bg-white p-4 text-[#111827] shadow-[0_18px_60px_rgb(0_0_0_/_0.24)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand">Pinned Location</p>
                  <h2 className="mt-2 text-lg font-black">{location.address}</h2>
                </div>
                <span className="flex size-10 items-center justify-center rounded-md bg-brand/10 text-brand">
                  <Navigation size={18} aria-hidden={true} />
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

              <div className="mt-4 grid grid-cols-3 gap-2">
                <MiniMetric icon={Clock3} label="ETA" value="18m" />
                <MiniMetric icon={WalletCards} label="Wallet" value="Rs 0" />
                <MiniMetric icon={ShieldCheck} label="Support" value="24/7" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <CategoryGrid selectedType={selectedType} onSelectType={setSelectedType} />

      <section className="rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-5" aria-labelledby="stores-heading">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand">Marketplace</p>
            <h2 id="stores-heading" className="mt-1 text-2xl font-black tracking-normal text-foreground">Stores near you</h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(14rem,1fr)_9rem] lg:w-[32rem]">
            <label className="block text-sm font-semibold text-foreground" htmlFor="store-search">
              <span className="mb-1 flex items-center gap-2"><Search className="size-4 text-muted-foreground" aria-hidden={true} /> Search</span>
              <Input id="store-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Biryani, milk, pharmacy" />
            </label>
            <label className="block text-sm font-semibold text-foreground" htmlFor="radius-filter">
              <span className="mb-1 flex items-center gap-2"><SlidersHorizontal className="size-4 text-muted-foreground" aria-hidden={true} /> Radius</span>
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
            {stores.length > 0 ? (
              <div className="grid gap-3 xl:grid-cols-2">
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

function MiniMetric({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface-muted p-3">
      <Icon className="size-4 text-brand" aria-hidden={true} />
      <p className="mt-2 text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-black">{value}</p>
    </div>
  );
}