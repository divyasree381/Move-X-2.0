"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { Heart, Minus, PackageX, Plus, Search, ShoppingBag, SlidersHorizontal } from "lucide-react";

import { Button, EmptyState, Input, Skeleton, StatusPill, useToast } from "@/components/ui";
import {
  addCartItem,
  getCart,
  removeCartItem,
  saveFavorite,
  updateCartItemQty,
  type CartResponse,
  type MarketplaceMenuItem,
  type StoreListItem,
} from "@/lib/api";
import { dietaryLabels, resolveDietaryType, type DietaryType } from "@/lib/dietary";
import { cn } from "@/lib/utils";
import { CustomizationModal } from "./customization-modal";

const ITEM_IMAGE_FALLBACK = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='240' viewBox='0 0 320 240'%3E%3Crect width='320' height='240' fill='%23f8fafc'/%3E%3Ccircle cx='240' cy='60' r='70' fill='%23dcfce7'/%3E%3Crect x='52' y='82' width='216' height='92' rx='18' fill='%23ff6b00' opacity='.16'/%3E%3Cpath d='M90 146h140v18H90zM110 112h100v18H110z' fill='%2316a34a'/%3E%3C/svg%3E";
const CART_QUERY_KEY = ["cart"] as const;

type SortMode = "recommended" | "price-asc" | "price-desc" | "popular";
type DietaryFilter = "ALL" | "VEG" | "NON_VEG";

export function StoreMenu({ items, isLoading = false, storeType }: { items: MarketplaceMenuItem[]; isLoading?: boolean; storeType?: StoreListItem["type"] }) {
  const [selectedItem, setSelectedItem] = useState<MarketplaceMenuItem | null>(null);
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("recommended");
  const [dietaryFilter, setDietaryFilter] = useState<DietaryFilter>("ALL");
  const [availableOnly, setAvailableOnly] = useState(true);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const favoriteMutation = useMutation({ mutationFn: (targetId: string) => saveFavorite({ type: "MENU_ITEM", targetId }) });
  const cartQuery = useQuery({ queryKey: CART_QUERY_KEY, queryFn: getCart, retry: false });
  const cartQuantities = useMemo(() => {
    const quantities = new Map<string, number>();
    cartQuery.data?.items.forEach((line) => quantities.set(line.menuItemId, line.quantity));
    return quantities;
  }, [cartQuery.data]);

  const addMutation = useMutation({
    mutationFn: (item: MarketplaceMenuItem) => addCartItem({ menuItemId: item.id, quantity: 1, substitutionPreference: { allow: storeType === "GROCERY" || storeType === "PHARMACY" } }),
    onSuccess: (cart, item) => {
      queryClient.setQueryData(CART_QUERY_KEY, cart);
      toast({ title: "Added to cart", description: `${item.name} is ready in your cart.`, kind: "success" });
    },
    onError: (caught) => toast({ title: "Could not add item", description: caught instanceof Error ? caught.message : "Please try again.", kind: "error" }),
  });

  const quantityMutation = useMutation({
    mutationFn: ({ item, quantity }: { item: MarketplaceMenuItem; quantity: number }) =>
      quantity <= 0 ? removeCartItem(item.id) : updateCartItemQty(item.id, quantity),
    onMutate: async ({ item, quantity }) => {
      await queryClient.cancelQueries({ queryKey: CART_QUERY_KEY });
      const previous = queryClient.getQueryData<CartResponse>(CART_QUERY_KEY);

      if (previous) {
        queryClient.setQueryData<CartResponse>(CART_QUERY_KEY, optimisticMenuQuantity(previous, item, quantity));
      }

      return { previous };
    },
    onError: (caught, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(CART_QUERY_KEY, context.previous);
      }
      toast({ title: "Cart update failed", description: caught instanceof Error ? caught.message : "Please try again.", kind: "error" });
    },
    onSuccess: (cart) => queryClient.setQueryData(CART_QUERY_KEY, cart),
    onSettled: () => queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY }),
  });

  const visibleItems = useMemo(() => filterAndSortItems(items, storeType, query, sortMode, dietaryFilter, availableOnly), [availableOnly, dietaryFilter, items, query, sortMode, storeType]);
  const grouped = useMemo(() => groupBySection(visibleItems), [visibleItems]);
  const resultLabel = `${visibleItems.length} item${visibleItems.length === 1 ? "" : "s"}`;

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
      <div className="rounded-lg border border-border bg-surface-muted p-3 sm:p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
          <label className="relative block" htmlFor="menu-search">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input id="menu-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search biryani, milk, medicines, brands" className="min-h-11 pl-9" />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground"><SlidersHorizontal className="size-4" aria-hidden="true" /> Sort</span>
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} className="min-h-10 rounded-md border border-border bg-surface px-3 text-sm font-medium text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25" aria-label="Sort menu items">
              <option value="recommended">Recommended</option>
              <option value="popular">Popular</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
            </select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <FilterButton active={dietaryFilter === "ALL"} onClick={() => setDietaryFilter("ALL")}>All</FilterButton>
          <FilterButton active={dietaryFilter === "VEG"} onClick={() => setDietaryFilter("VEG")}>Veg</FilterButton>
          <FilterButton active={dietaryFilter === "NON_VEG"} onClick={() => setDietaryFilter("NON_VEG")}>Non-veg</FilterButton>
          <FilterButton active={availableOnly} onClick={() => setAvailableOnly((value) => !value)}>Available only</FilterButton>
          <span className="ml-auto text-sm font-medium text-muted-foreground">{resultLabel}</span>
        </div>
      </div>

      {visibleItems.length === 0 ? (
        <EmptyState title="No matching items" description="Try another search, remove a dietary filter, or show unavailable items." />
      ) : (
        grouped.map(([section, sectionItems]) => (
          <section key={section} aria-labelledby={`section-${section}`} className="space-y-3">
            <h2 id={`section-${section}`} className="text-base font-semibold text-foreground">{section}</h2>
            <div className="grid gap-3">
              {sectionItems.map((item) => {
                const outOfStock = item.stock === 0 || !item.available;
                const quantity = cartQuantities.get(item.id) ?? 0;
                const hasCustomizations = hasCustomizationGroups(item.customizations);

                return (
                  <article key={item.id} className="grid grid-cols-[6rem_1fr] overflow-hidden rounded-lg border border-border bg-surface shadow-sm transition hover:border-primary/30 hover:shadow-md sm:grid-cols-[8rem_1fr]">
                    <div className="relative min-h-32 bg-surface-muted">
                      <Image src={item.imageUrl || ITEM_IMAGE_FALLBACK} alt="" fill sizes="128px" className="object-cover" unoptimized={!item.imageUrl} />
                      {outOfStock ? <div className="absolute inset-0 bg-background/55 backdrop-blur-[1px]" aria-hidden="true" /> : null}
                    </div>
                    <div className="flex min-w-0 flex-col gap-3 p-3 sm:p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <h3 className="text-sm font-semibold text-foreground sm:text-base">{item.name}</h3>
                            <DietaryBadge type={resolveDietaryType(item, storeType)} />
                            {item.tags.includes("popular") ? <StatusPill label="Popular" tone="success" /> : null}
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground sm:text-sm">{item.description}</p>
                        </div>
                        {outOfStock ? <StatusPill label="Unavailable" tone="danger" /> : <StatusPill label={item.stock > 0 && item.stock <= 5 ? `${item.stock} left` : "Available"} tone={item.stock > 0 && item.stock <= 5 ? "warning" : "success"} />}
                      </div>
                      <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-base font-semibold text-foreground">Rs {Number(item.price).toFixed(0)}</div>
                          {hasCustomizations ? <p className="mt-0.5 text-xs text-muted-foreground">Custom options available</p> : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button type="button" variant="ghost" size="icon" aria-label={`Save ${item.name}`} disabled={favoriteMutation.isPending} onClick={() => favoriteMutation.mutate(item.id)}>
                            <Heart className="size-4" aria-hidden="true" />
                          </Button>
                          {hasCustomizations ? (
                            <Button type="button" variant="secondary" size="sm" disabled={outOfStock} onClick={() => setSelectedItem(item)}>Customize</Button>
                          ) : null}
                          <MenuCartControl
                            item={item}
                            quantity={quantity}
                            disabled={outOfStock || addMutation.isPending || quantityMutation.isPending}
                            onAdd={() => addMutation.mutate(item)}
                            onDecrease={() => quantityMutation.mutate({ item, quantity: quantity - 1 })}
                            onIncrease={() => quantityMutation.mutate({ item, quantity: quantity + 1 })}
                          />
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))
      )}
      <CustomizationModal item={selectedItem} open={selectedItem !== null} onOpenChange={(open) => !open && setSelectedItem(null)} />
    </div>
  );
}

function MenuCartControl({ item, quantity, disabled, onAdd, onDecrease, onIncrease }: { item: MarketplaceMenuItem; quantity: number; disabled: boolean; onAdd: () => void; onDecrease: () => void; onIncrease: () => void }) {
  const maxed = item.stock !== -1 && quantity >= item.stock;

  if (quantity > 0) {
    return (
      <div className="inline-flex min-h-10 items-center overflow-hidden rounded-md border border-primary/30 bg-primary/10 text-primary shadow-sm" aria-label={`${item.name} quantity ${quantity}`}>
        <button type="button" className="grid size-10 place-items-center transition hover:bg-primary/15 disabled:opacity-50" onClick={onDecrease} disabled={disabled} aria-label={`Decrease ${item.name}`}>
          <Minus className="size-4" aria-hidden="true" />
        </button>
        <span className="min-w-9 px-2 text-center text-sm font-semibold" aria-live="polite">{quantity}</span>
        <button type="button" className="grid size-10 place-items-center transition hover:bg-primary/15 disabled:opacity-50" onClick={onIncrease} disabled={disabled || maxed} aria-label={`Increase ${item.name}`}>
          <Plus className="size-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <Button type="button" size="sm" disabled={disabled} onClick={onAdd}>
      {item.stock === 0 ? <PackageX className="size-4" aria-hidden="true" /> : <ShoppingBag className="size-4" aria-hidden="true" />}
      Add
    </Button>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-9 items-center rounded-full border px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
        active ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-surface text-muted-foreground hover:border-primary/30 hover:text-foreground",
      )}
    >
      {children}
    </button>
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

function filterAndSortItems(items: MarketplaceMenuItem[], storeType: StoreListItem["type"] | undefined, query: string, sortMode: SortMode, dietaryFilter: DietaryFilter, availableOnly: boolean) {
  const normalized = query.trim().toLowerCase();

  return [...items]
    .filter((item) => {
      if (availableOnly && (!item.available || item.stock === 0)) {
        return false;
      }

      const dietaryType = resolveDietaryType(item, storeType);
      if (dietaryFilter !== "ALL" && dietaryType !== dietaryFilter) {
        return false;
      }

      if (!normalized) {
        return true;
      }

      const haystack = [item.name, item.description, item.section, ...item.tags].join(" ").toLowerCase();
      return haystack.includes(normalized);
    })
    .sort((a, b) => {
      if (sortMode === "price-asc") {
        return Number(a.price) - Number(b.price);
      }
      if (sortMode === "price-desc") {
        return Number(b.price) - Number(a.price);
      }
      if (sortMode === "popular") {
        return scorePopularity(b) - scorePopularity(a);
      }
      return scoreRecommendation(b) - scoreRecommendation(a);
    });
}

function scorePopularity(item: MarketplaceMenuItem) {
  return (item.tags.includes("popular") ? 5 : 0) + (item.tags.includes("best-seller") ? 4 : 0) + (item.available ? 1 : 0);
}

function scoreRecommendation(item: MarketplaceMenuItem) {
  return scorePopularity(item) + (item.stock === -1 ? 2 : Math.min(Math.max(item.stock, 0), 8) / 8);
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

function hasCustomizationGroups(customizations: unknown) {
  if (!customizations || typeof customizations !== "object") {
    return false;
  }

  const groups = (customizations as { groups?: unknown }).groups;
  return Array.isArray(groups) && groups.length > 0;
}

function optimisticMenuQuantity(cart: CartResponse, item: MarketplaceMenuItem, quantity: number): CartResponse {
  if (quantity <= 0) {
    return { ...cart, items: cart.items.filter((line) => line.menuItemId !== item.id) };
  }

  const existing = cart.items.find((line) => line.menuItemId === item.id);
  if (!existing) {
    return cart;
  }

  return {
    ...cart,
    items: cart.items.map((line) => {
      if (line.menuItemId !== item.id) {
        return line;
      }

      return { ...line, quantity, lineTotal: String(Number(line.price) * quantity) };
    }),
  };
}

