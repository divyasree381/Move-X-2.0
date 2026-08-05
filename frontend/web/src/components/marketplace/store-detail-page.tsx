"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Bike, Clock3, Heart, MapPin, ReceiptText, Search, Star, Truck, type LucideIcon,
} from "lucide-react";

import { CartButton } from "@/components/orders";
import { ServiceDisclaimer } from "@/components/trust";
import { QueryState } from "@/providers/query-state";
import { Button, StatusPill } from "@/components/ui";
import { getCart, getStore, getStoreMenu, saveFavorite } from "@/lib/api";
import { StoreMenu } from "./store-menu";

const DETAIL_IMAGE_FALLBACK = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='960' height='420' viewBox='0 0 960 420'%3E%3Crect width='960' height='420' fill='%23fff7ed'/%3E%3Ccircle cx='790' cy='80' r='170' fill='%23fed7aa'/%3E%3Crect x='100' y='110' width='650' height='210' rx='28' fill='%23ff6b00' opacity='.18'/%3E%3Cpath d='M180 260h500v34H180zM220 210h410v30H220zM260 160h330v30H260z' fill='%23ff6b00'/%3E%3C/svg%3E";

export function StoreDetailPage({ storeId }: { storeId: string }) {
  const storeQuery = useQuery({ queryKey: ["store", storeId], queryFn: () => getStore(storeId) });
  const favoriteMutation = useMutation({ mutationFn: () => saveFavorite({ type: "STORE", targetId: storeId }),
  });
  const menuQuery = useQuery({ queryKey: ["store-menu", storeId], queryFn: () => getStoreMenu(storeId),
  });
  const cartQuery = useQuery({ queryKey: ["cart"], queryFn: getCart, retry: false });
  const store = storeQuery.data;
  const itemCount = useMemo(() => cartQuery.data?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0, [cartQuery.data],
  );
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
                <Image src={store.imageUrl || DETAIL_IMAGE_FALLBACK} alt="" fill sizes="(max-width: 768px) 100vw, 960px" className="object-cover" priority unoptimized={!store.imageUrl} />
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
                        <Heart className="size-4" aria-hidden="true" /> Save
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

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
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

              <aside className="h-fit rounded-lg border border-border bg-surface p-4 shadow-[var(--shadow-shell)] xl:sticky xl:top-28">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-primary">Your order</p>
                    <h2 className="mt-1 text-xl font-semibold text-foreground">Cart summary</h2>
                  </div>
                  <CartButton />
                </div>
                <div className="mt-4 rounded-md border border-border bg-surface-muted p-3">
                  <p className="text-sm font-medium text-foreground">{itemCount > 0 ? `${itemCount} item${itemCount === 1 ? "" : "s"} added` : "Add items to start"}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Browse first, adjust quantities anytime, then continue to checkout when ready.</p>
                </div>
                <div className="mt-4 grid gap-2 text-sm">
                  <span className="inline-flex items-center gap-2 text-muted-foreground"><Bike className="size-4 text-primary" aria-hidden="true" /> Delivery partner assigned after checkout</span>
                  <span className="inline-flex items-center gap-2 text-muted-foreground"><Search className="size-4 text-primary" aria-hidden="true" /> Coupons and prescription requirements are checked at checkout
                  </span>
                </div>
                {itemCount > 0 ? (
                  <Button asChild className="mt-4 w-full">
                    <Link href="/customer/checkout">Go to checkout</Link>
                  </Button>
                ) : (
                  <Button type="button" className="mt-4 w-full" disabled>
                    Go to checkout
                  </Button>
                )}
              </aside>
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
