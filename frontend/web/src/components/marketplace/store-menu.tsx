"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import Image from "next/image";
import { Heart, PackageX, Plus } from "lucide-react";

import { Button, EmptyState, Skeleton, StatusPill } from "@/components/ui";
import { saveFavorite, type MarketplaceMenuItem, type StoreListItem } from "@/lib/api";
import { dietaryLabels, resolveDietaryType, type DietaryType } from "@/lib/dietary";
import { cn } from "@/lib/utils";
import { CustomizationModal } from "./customization-modal";

const ITEM_IMAGE_FALLBACK = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='240' viewBox='0 0 320 240'%3E%3Crect width='320' height='240' fill='%23f8fafc'/%3E%3Ccircle cx='240' cy='60' r='70' fill='%23dcfce7'/%3E%3Crect x='52' y='82' width='216' height='92' rx='18' fill='%23ff6b00' opacity='.16'/%3E%3Cpath d='M90 146h140v18H90zM110 112h100v18H110z' fill='%2316a34a'/%3E%3C/svg%3E";

export function StoreMenu({ items, isLoading = false, storeType }: { items: MarketplaceMenuItem[]; isLoading?: boolean; storeType?: StoreListItem["type"] }) {
  const [selectedItem, setSelectedItem] = useState<MarketplaceMenuItem | null>(null);
  const favoriteMutation = useMutation({ mutationFn: (targetId: string) => saveFavorite({ type: "MENU_ITEM", targetId }) });
  const grouped = useMemo(() => groupBySection(items), [items]);

  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-live="polite">
        <Skeleton className="h-12" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
    );
  }

  if (items.length === 0) {
    return <EmptyState title="Menu is being prepared" description="Available items will appear as soon as this partner publishes them." />;
  }

  return (
    <div className="space-y-5">
      {grouped.map(([section, sectionItems]) => (
        <section key={section} aria-labelledby={`section-${section}`} className="space-y-3">
          <h2 id={`section-${section}`} className="text-base font-semibold text-foreground">{section}</h2>
          <div className="grid gap-3">
            {sectionItems.map((item) => {
              const outOfStock = item.stock === 0;

              return (
                <article key={item.id} className="grid grid-cols-[5.5rem_1fr] overflow-hidden rounded-md border border-border bg-surface sm:grid-cols-[7rem_1fr]">
                  <div className="relative min-h-28 bg-surface-muted">
                    <Image src={item.imageUrl || ITEM_IMAGE_FALLBACK} alt="" fill sizes="112px" className="object-cover" unoptimized={!item.imageUrl} />
                  </div>
                  <div className="flex min-w-0 flex-col gap-2 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <h3 className="truncate text-sm font-semibold text-foreground">{item.name}</h3>
                          <DietaryBadge type={resolveDietaryType(item, storeType)} />
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
                      </div>
                      {outOfStock ? <StatusPill label="Out" tone="danger" /> : <StatusPill label="Available" tone="success" />}
                    </div>
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-foreground">Rs {Number(item.price).toFixed(0)}</div>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="ghost" size="icon" aria-label={`Save ${item.name}`} disabled={favoriteMutation.isPending} onClick={() => favoriteMutation.mutate(item.id)}>
                          <Heart className="size-4" aria-hidden="true" />
                        </Button>
                        <Button type="button" variant="secondary" size="sm" disabled={outOfStock} onClick={() => setSelectedItem(item)}>
                          {outOfStock ? <PackageX className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
                          {outOfStock ? "Unavailable" : "Customize"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
      <CustomizationModal item={selectedItem} open={selectedItem !== null} onOpenChange={(open) => !open && setSelectedItem(null)} />
    </div>
  );
}

const dietaryTone: Record<DietaryType, string> = {
  VEG: "border-success/35 bg-success/10 text-success",
  NON_VEG: "border-destructive/35 bg-destructive/10 text-destructive",
  EGG: "border-warning/35 bg-warning/10 text-warning",
};

function DietaryBadge({ type }: { type: DietaryType | null }) {
  if (!type) {
    return null;
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium", dietaryTone[type])} aria-label={`${dietaryLabels[type]} item`}>
      <span className="grid size-3 place-items-center rounded-[3px] border border-current" aria-hidden={true}>
        <span className="size-1.5 rounded-full bg-current" />
      </span>
      {dietaryLabels[type]}
    </span>
  );
}
function groupBySection(items: MarketplaceMenuItem[]): Array<[string, MarketplaceMenuItem[]]> {
  const sections = new Map<string, MarketplaceMenuItem[]>();

  items.forEach((item) => {
    const current = sections.get(item.section) ?? [];
    current.push(item);
    sections.set(item.section, current);
  });

  return Array.from(sections.entries());
}

