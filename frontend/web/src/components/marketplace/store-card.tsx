import Image from "next/image";
import Link from "next/link";
import { Clock3, MapPin, Star } from "lucide-react";

import { StatusPill } from "@/components/ui";
import type { StoreListItem } from "@/lib/api";

const STORE_IMAGE_FALLBACK = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='420' viewBox='0 0 640 420'%3E%3Crect width='640' height='420' fill='%23fff1e6'/%3E%3Ccircle cx='500' cy='90' r='130' fill='%23e7f8ec'/%3E%3Crect x='70' y='120' width='500' height='210' rx='24' fill='%23c2410c' opacity='.16'/%3E%3Cpath d='M130 270h380v30H130zM160 230h320v24H160zM190 190h260v24H190z' fill='%23c2410c'/%3E%3C/svg%3E";

const typeLabel: Record<StoreListItem["type"], string> = {
  FOOD: "Food",
  GROCERY: "Grocery",
  PHARMACY: "Pharmacy",
};

export function StoreCard({ store }: { store: StoreListItem }) {
  return (
    <Link
      href={`/customer/stores/${store.id}`}
      className="group grid min-h-44 overflow-hidden rounded-lg border border-border bg-surface shadow-sm transition hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 sm:grid-cols-[11rem_1fr]"
    >
      <div className="relative min-h-44 bg-surface-muted">
        <Image
          src={store.imageUrl || STORE_IMAGE_FALLBACK}
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, 176px"
          className="object-cover transition duration-300 group-hover:scale-[1.04]"
          unoptimized={!store.imageUrl}
        />
        <div className="absolute left-3 top-3 rounded-full bg-card/92 px-2.5 py-1 text-xs font-black text-foreground shadow-sm">{typeLabel[store.type]}</div>
      </div>
      <div className="flex min-w-0 flex-col gap-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-black tracking-normal text-foreground">{store.name}</h3>
            <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{store.description}</p>
          </div>
          <StatusPill label={store.isOpen ? "Open" : "Closed"} tone={store.isOpen ? "success" : "warning"} />
        </div>
        <div className="mt-auto grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <Metric icon={Star} label="Rating" value={`${Number(store.ratingAverage).toFixed(1)} (${store.ratingCount})`} accent="text-warning" />
          <Metric icon={Clock3} label="ETA" value={`${store.etaMinutes} min`} accent="text-primary" />
          <Metric label="Minimum" value={`Rs ${Number(store.minOrder).toFixed(0)}`} />
          {store.distanceKm !== undefined ? <Metric icon={MapPin} label="Distance" value={`${store.distanceKm.toFixed(1)} km`} /> : <Metric icon={MapPin} label="Radius" value={`${Number(store.deliveryRadiusKm).toFixed(0)} km`} />}
        </div>
      </div>
    </Link>
  );
}

function Metric({ icon: Icon, label, value, accent = "text-muted-foreground" }: { icon?: typeof Star; label: string; value: string; accent?: string }) {
  return (
    <span className="rounded-md bg-surface-muted px-2.5 py-2">
      <span className="flex items-center gap-1 text-[0.68rem] font-medium text-muted-foreground">
        {Icon ? <Icon className={`size-3.5 ${accent}`} aria-hidden={true} /> : null}
        {label}
      </span>
      <span className="mt-1 block truncate text-xs font-black text-foreground">{value}</span>
    </span>
  );
}