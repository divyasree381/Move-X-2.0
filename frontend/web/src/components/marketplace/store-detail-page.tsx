"use client";

import Image from "next/image";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Clock3, Heart, MapPin, Star } from "lucide-react";

import { QueryState } from "@/providers/query-state";
import { Button, StatusPill } from "@/components/ui";
import { getStore, getStoreMenu, saveFavorite } from "@/lib/api";
import { StoreMenu } from "./store-menu";

const DETAIL_IMAGE_FALLBACK = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='960' height='420' viewBox='0 0 960 420'%3E%3Crect width='960' height='420' fill='%23fff7ed'/%3E%3Ccircle cx='790' cy='80' r='170' fill='%23fed7aa'/%3E%3Crect x='100' y='110' width='650' height='210' rx='28' fill='%23ff6b00' opacity='.18'/%3E%3Cpath d='M180 260h500v34H180zM220 210h410v30H220zM260 160h330v30H260z' fill='%23ff6b00'/%3E%3C/svg%3E";

export function StoreDetailPage({ storeId }: { storeId: string }) {
  const storeQuery = useQuery({ queryKey: ["store", storeId], queryFn: () => getStore(storeId) });
  const favoriteMutation = useMutation({ mutationFn: () => saveFavorite({ type: "STORE", targetId: storeId }) });
  const menuQuery = useQuery({ queryKey: ["store-menu", storeId], queryFn: () => getStoreMenu(storeId) });
  const store = storeQuery.data;

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link href="/customer"><ArrowLeft className="size-4" aria-hidden="true" /> Back to discovery</Link>
      </Button>

      <QueryState isLoading={storeQuery.isLoading} isError={storeQuery.isError} error={storeQuery.error} onRetry={() => storeQuery.refetch()}>
        {store ? (
          <>
            <section className="overflow-hidden rounded-md border border-border bg-surface">
              <div className="relative h-52 bg-surface-muted sm:h-64">
                <Image src={store.imageUrl || DETAIL_IMAGE_FALLBACK} alt="" fill sizes="(max-width: 768px) 100vw, 960px" className="object-cover" priority unoptimized={!store.imageUrl} />
              </div>
              <div className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-brand">{store.type.toLowerCase()}</p>
                    <h1 className="mt-1 text-2xl font-semibold text-foreground">{store.name}</h1>
                    <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{store.description}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" size="sm" onClick={() => favoriteMutation.mutate()} disabled={favoriteMutation.isPending}>
                      <Heart className="size-4" aria-hidden="true" /> Save
                    </Button>
                    <StatusPill label={store.isOpen ? "Open" : "Closed"} tone={store.isOpen ? "success" : "warning"} />
                  </div>
                </div>
                <div className="mt-4 grid gap-3 text-sm text-muted-foreground sm:grid-cols-4">
                  <span className="inline-flex items-center gap-2"><Star className="size-4 text-warning" aria-hidden="true" /> {Number(store.ratingAverage).toFixed(1)} rating</span>
                  <span className="inline-flex items-center gap-2"><Clock3 className="size-4" aria-hidden="true" /> {store.etaMinutes} min ETA</span>
                  <span>Min Rs {Number(store.minOrder).toFixed(0)}</span>
                  <span className="inline-flex items-center gap-2"><MapPin className="size-4" aria-hidden="true" /> {Number(store.deliveryRadiusKm).toFixed(0)} km radius</span>
                </div>
              </div>
            </section>

            <section className="rounded-md border border-border bg-surface p-4" aria-labelledby="menu-heading">
              <h2 id="menu-heading" className="text-base font-semibold text-foreground">Menu</h2>
              <div className="mt-4">
                <QueryState isLoading={menuQuery.isLoading} isError={menuQuery.isError} error={menuQuery.error} onRetry={() => menuQuery.refetch()}>
                  <StoreMenu items={menuQuery.data ?? []} storeType={store.type} />
                </QueryState>
              </div>
            </section>
          </>
        ) : null}
      </QueryState>
    </div>
  );
}
