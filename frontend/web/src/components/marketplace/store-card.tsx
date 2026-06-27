import Image from "next/image";
import Link from "next/link";
import { MapPin, Star } from "lucide-react";

import { StatusPill } from "@/components/ui";
import type { StoreListItem } from "@/lib/api";

const STORE_IMAGE_FALLBACK = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='420' viewBox='0 0 640 420'%3E%3Crect width='640' height='420' fill='%23fff7ed'/%3E%3Ccircle cx='500' cy='90' r='130' fill='%23ffedd5'/%3E%3Crect x='70' y='120' width='500' height='210' rx='24' fill='%23ff6b00' opacity='.16'/%3E%3Cpath d='M130 270h380v30H130zM160 230h320v24H160zM190 190h260v24H190z' fill='%23ff6b00'/%3E%3C/svg%3E";

export function StoreCard({ store }: { store: StoreListItem }) {
  return (
    <Link href={`/customer/stores/${store.id}`} className="group grid min-h-40 grid-cols-[7rem_1fr] overflow-hidden rounded-md border border-border bg-surface transition hover:border-brand/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 sm:grid-cols-[10rem_1fr]">
      <div className="relative min-h-40 bg-surface-muted">
        <Image
          src={store.imageUrl || STORE_IMAGE_FALLBACK}
          alt=""
          fill
          sizes="(max-width: 640px) 112px, 160px"
          className="object-cover transition duration-200 group-hover:scale-[1.02]"
          unoptimized={!store.imageUrl}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{store.type.toLowerCase()}</p>
            <h3 className="mt-1 truncate text-base font-semibold text-foreground">{store.name}</h3>
          </div>
          <StatusPill label={store.isOpen ? "Open" : "Closed"} tone={store.isOpen ? "success" : "warning"} />
        </div>
        <p className="line-clamp-2 text-sm text-muted-foreground">{store.description}</p>
        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 text-foreground"><Star className="size-3.5 text-warning" aria-hidden="true" /> {Number(store.ratingAverage).toFixed(1)} ({store.ratingCount})</span>
          <span>{store.etaMinutes} min</span>
          <span>Min Rs {Number(store.minOrder).toFixed(0)}</span>
          {store.distanceKm !== undefined ? <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" aria-hidden="true" /> {store.distanceKm.toFixed(1)} km</span> : null}
        </div>
      </div>
    </Link>
  );
}