import Image from "next/image";
import Link from "next/link";
import { Clock3, MapPin, Star } from "lucide-react";

import type { StoreListItem } from "@/lib/api";

const STORE_IMAGE_FALLBACK = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='420' viewBox='0 0 640 420'%3E%3Crect width='640' height='420' fill='%23fff1e6'/%3E%3Ccircle cx='500' cy='90' r='130' fill='%23e7f8ec'/%3E%3Crect x='70' y='120' width='500' height='210' rx='24' fill='%23c2410c' opacity='.16'/%3E%3Cpath d='M130 270h380v30H130zM160 230h320v24H160zM190 190h260v24H190z' fill='%23c2410c'/%3E%3C/svg%3E";
const typeLabel: Record<StoreListItem["type"], string> = { FOOD: "Food", GROCERY: "Grocery", PHARMACY: "Pharmacy" };

export function StoreCard({ store }: { store: StoreListItem }) {
  const distance = store.distanceKm !== undefined ? `${store.distanceKm.toFixed(1)} km` : `${Number(store.deliveryRadiusKm).toFixed(0)} km radius`;

  return (
    <Link href={`/customer/stores/${store.id}`} className="group block overflow-hidden rounded-lg border border-border bg-surface shadow-sm transition hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
      <div className="relative aspect-[16/10] overflow-hidden bg-surface-muted">
        <Image src={store.imageUrl || STORE_IMAGE_FALLBACK} alt="" fill unoptimized sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px" className="object-cover transition duration-300 group-hover:scale-[1.035]" />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-foreground/65 to-transparent" aria-hidden="true" />
        <span className="absolute left-3 top-3 rounded-full bg-surface/92 px-2.5 py-1 text-xs font-semibold text-foreground shadow-sm">{typeLabel[store.type]}</span>
        <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-surface/94 px-2.5 py-1 text-xs font-bold text-foreground shadow-sm"><Star className="size-3.5 fill-warning text-warning" aria-hidden="true" />{Number(store.ratingAverage).toFixed(1)} <span className="font-medium text-muted-foreground">({store.ratingCount})</span></span>
        {!store.isOpen ? <span className="absolute right-3 top-3 rounded-full bg-foreground/85 px-2.5 py-1 text-xs font-semibold text-background">Closed</span> : null}
      </div>
      <div className="p-3.5">
        <h3 className="truncate text-base font-bold text-foreground">{store.name}</h3>
        <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{store.description}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Clock3 className="size-3.5 text-primary" aria-hidden="true" />{store.etaMinutes}-{store.etaMinutes + 8} min</span>
          <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" aria-hidden="true" />{distance}</span>
          <span>Min. Rs {Number(store.minOrder).toFixed(0)}</span>
        </div>
      </div>
    </Link>
  );
}
