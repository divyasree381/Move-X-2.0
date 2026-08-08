"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Clock3, Heart, MapPin, ReceiptText, Star, Truck, type LucideIcon,
} from "lucide-react";
import { ServiceDisclaimer } from "@/components/trust";
import { QueryState } from "@/providers/query-state";
import { Button, StatusPill, useToast } from "@/components/ui";
import { getStore, getStoreMenu, listFavorites, removeFavorite, saveFavorite } from "@/lib/api";
import { cn } from "@/lib/utils";
import { StoreMenu, getStoreHeroImage } from "./store-menu";



export function StoreDetailPage({ storeId }: { storeId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const storeQuery = useQuery({ queryKey: ["store", storeId], queryFn: () => getStore(storeId) });
  const favoritesQuery = useQuery({ queryKey: ["favorites"], queryFn: () => listFavorites(), retry: false });
  const isStoreSaved = useMemo(() => favoritesQuery.data?.items.some((f) => f.targetId === storeId) ?? false, [favoritesQuery.data, storeId]);

  const favoriteMutation = useMutation({
    mutationFn: async () => {
      if (isStoreSaved) {
        await removeFavorite({ type: "STORE", targetId: storeId });
        return "removed" as const;
      } else {
        await saveFavorite({ type: "STORE", targetId: storeId });
        return "added" as const;
      }
    },
    onSuccess: (action) => {
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
      toast({
        title: action === "added" ? "Store saved" : "Store removed",
        description: action === "added" ? "Store saved to your favorites in profile." : "Store removed from your favorites.",
        kind: "info",
      });
    },
    onError: (caught) => toast({ title: "Could not update store favorite", description: caught instanceof Error ? caught.message : "Please try again.", kind: "error" }),
  });
  const menuQuery = useQuery({ queryKey: ["store-menu", storeId], queryFn: () => getStoreMenu(storeId),
  });
  const store = storeQuery.data;
  const arrivalWindow = store ? `${store.etaMinutes}-${store.etaMinutes + 8} min` : "--";
  const distanceLabel = store?.distanceKm ? `${store.distanceKm.toFixed(1)} km away` : `${Number(store?.deliveryRadiusKm ?? 0).toFixed(0)} km delivery radius`;

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm">
        <Link href="/customer"><ArrowLeft className="size-4" aria-hidden="true" /> Back to discovery</Link>
      </Button>

      <QueryState isLoading={storeQuery.isLoading} isError={storeQuery.isError} error={storeQuery.error} onRetry={() => storeQuery.refetch()}>
        {store ? (
          <>
            <section className="overflow-hidden rounded-lg border border-border bg-surface shadow-[var(--shadow-shell)]">
              <div className="relative min-h-[21rem] bg-surface-muted sm:min-h-[24rem]">
                <Image src={store.imageUrl || getStoreHeroImage(store.name, store.type)} alt="" fill sizes="(max-width: 768px) 100vw, 960px" className="object-cover" priority unoptimized={!store.imageUrl} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/36 to-black/12" aria-hidden="true" />
                <div className="absolute inset-x-0 bottom-0 p-4 text-white sm:p-6">
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div className="max-w-3xl">
                      <span className="inline-flex rounded-full bg-white/16 px-3 py-1 text-xs font-medium backdrop-blur">{store.type.toLowerCase()}</span>
                      <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-normal sm:text-5xl">{store.name}</h1>
                      <p className="mt-3 max-w-2xl text-sm leading-6 text-white/76 sm:text-base">{store.description}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="secondary" size="sm" onClick={() => favoriteMutation.mutate()} disabled={favoriteMutation.isPending} className="bg-white/12 text-white hover:bg-white/18">
                        <Heart className={cn("size-4", isStoreSaved && "fill-destructive text-destructive")} aria-hidden="true" /> {isStoreSaved ? "Saved" : "Save"}
                      </Button>
                      <StatusPill label={store.isOpen ? "Open now" : "Closed"} tone={store.isOpen ? "success" : "warning"} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 border-t border-border bg-surface p-3 sm:grid-cols-2 lg:grid-cols-5 lg:p-4">
                <CommerceMetric icon={Star} label="Rating" value={`${Number(store.ratingAverage).toFixed(1)} (${store.ratingCount})`} tone="text-warning" />
                <CommerceMetric icon={Clock3} label="Arrives in" value={arrivalWindow} tone="text-primary" />
                <CommerceMetric icon={Truck} label="Delivery fee" value="Rs 29" tone="text-primary" />
                <CommerceMetric icon={ReceiptText} label="Min order" value={`Rs ${Number(store.minOrder).toFixed(0)}`} tone="text-foreground" />
                <CommerceMetric icon={MapPin} label="Distance" value={distanceLabel} tone="text-ride" />
              </div>
            </section>

            <div className="grid gap-5">
              <section className="rounded-lg border border-border bg-surface p-4 shadow-sm" aria-labelledby="menu-heading">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-primary">Store catalog</p>
                    <h2 id="menu-heading" className="mt-1 text-2xl font-semibold text-foreground">Search, sort, and add items</h2>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Prices and availability are confirmed again when you place the order.</p>
                  </div>
                  <StatusPill label={`${menuQuery.data?.length ?? 0} products`} tone="info" />
                </div>
                <div className="mt-4">
                  <QueryState isLoading={menuQuery.isLoading} isError={menuQuery.isError} error={menuQuery.error} onRetry={() => menuQuery.refetch()}>
                    <StoreMenu items={menuQuery.data ?? []} storeType={store.type} storeRating={store.ratingAverage} storeRatingCount={store.ratingCount} storeEtaMinutes={store.etaMinutes} />
                  </QueryState>
                </div>
                <div className="mt-4">
                  <ServiceDisclaimer serviceType={store.type} />
                </div>
              </section>
            </div>
          </>
        ) : null}
      </QueryState>
    </div>
  );
}

function CommerceMetric({ icon: Icon, label, value, tone,
}: { icon: LucideIcon; label: string; value: string; tone: string;
}) {
  return (
    <div className="rounded-md border border-border bg-surface-muted p-3">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"><Icon className={`size-4 ${tone}`} aria-hidden="true" /> {label}</p>
      <p className="mt-2 text-base font-semibold text-foreground">{value}</p>
    </div>
  );
}
