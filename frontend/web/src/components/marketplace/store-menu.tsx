"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { BadgePercent, Clock3, Heart, Minus, PackageX, Plus, Search, ShoppingBag, SlidersHorizontal, Star } from "lucide-react";

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

type StoreMenuProps = {
  items: MarketplaceMenuItem[];
  isLoading?: boolean;
  storeType?: StoreListItem["type"];
  storeRating?: string;
  storeRatingCount?: number;
  storeEtaMinutes?: number;
};

export function StoreMenu({ items, isLoading = false, storeType, storeRating, storeRatingCount, storeEtaMinutes }: StoreMenuProps) {
  const [selectedItem, setSelectedItem] = useState<MarketplaceMenuItem | null>(null);
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("recommended");
  const [dietaryFilter, setDietaryFilter] = useState<DietaryFilter>("ALL");
  const [availableOnly, setAvailableOnly] = useState(true);
  const [bestsellerOnly, setBestsellerOnly] = useState(false);
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

  const visibleItems = useMemo(() => filterAndSortItems(items, storeType, query, sortMode, dietaryFilter, availableOnly, bestsellerOnly), [availableOnly, bestsellerOnly, dietaryFilter, items, query, sortMode, storeType]);
  const grouped = useMemo(() => groupBySection(visibleItems), [visibleItems]);
  const resultLabel = `${visibleItems.length} item${visibleItems.length === 1 ? "" : "s"}`;
  const ratingLabel = storeRating ? `${Number(storeRating).toFixed(1)} (${storeRatingCount ?? 0})` : null;
  const isProductGrid = storeType === "GROCERY" || storeType === "PHARMACY";

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
          <FilterButton active={bestsellerOnly} onClick={() => setBestsellerOnly((value) => !value)}>Bestseller</FilterButton>
          <FilterButton active={availableOnly} onClick={() => setAvailableOnly((value) => !value)}>Available only</FilterButton>
          {ratingLabel ? <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning"><Star className="size-3.5 fill-current" aria-hidden="true" /> {ratingLabel}</span> : null}
          <span className="ml-auto text-sm font-medium text-muted-foreground">{resultLabel}</span>
        </div>
      </div>

      {visibleItems.length === 0 ? (
        <EmptyState title="No matching items" description="Try another search, remove a dietary filter, or show unavailable items." />
      ) : isProductGrid ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleItems.map((item) => {
            const quantity = cartQuantities.get(item.id) ?? 0;
            const outOfStock = item.stock === 0 || !item.available;

            return (
              <ProductGridCard
                key={item.id}
                item={item}
                storeType={storeType}
                storeRating={storeRating}
                storeRatingCount={storeRatingCount}
                etaMinutes={storeEtaMinutes}
                quantity={quantity}
                disabled={outOfStock || addMutation.isPending || quantityMutation.isPending}
                onAdd={() => addMutation.mutate(item)}
                onDecrease={() => quantityMutation.mutate({ item, quantity: quantity - 1 })}
                onIncrease={() => quantityMutation.mutate({ item, quantity: quantity + 1 })}
                onSave={() => favoriteMutation.mutate(item.id)}
              />
            );
          })}
        </div>
      ) : (
        grouped.map(([section, sectionItems]) => (
          <section key={section} aria-labelledby={`section-${section}`} className="space-y-3">
            <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
              <h2 id={`section-${section}`} className="text-lg font-semibold text-foreground">{section}</h2>
              <span className="text-sm text-muted-foreground">{sectionItems.length} items</span>
            </div>
            <div className="grid gap-4">
              {sectionItems.map((item) => {
                const outOfStock = item.stock === 0 || !item.available;
                const quantity = cartQuantities.get(item.id) ?? 0;
                const hasCustomizations = hasCustomizationGroups(item.customizations);
                const lowStock = item.stock > 0 && item.stock <= 5;
                const rating = itemRating(item, storeRating);
                const ratingCount = itemRatingCount(item, storeRatingCount);

                return (
                  <article key={item.id} className="grid gap-4 rounded-lg border border-border bg-surface p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md sm:grid-cols-[minmax(0,1fr)_10rem]">
                    <div className="min-w-0 py-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <DietaryBadge type={resolveDietaryType(item, storeType)} />
                        {isBestseller(item) ? <StatusPill label="Bestseller" tone="success" /> : null}
                        {lowStock ? <StatusPill label={`${item.stock} left`} tone="warning" /> : null}
                      </div>
                      <h3 className="mt-3 text-base font-semibold leading-6 text-foreground">{item.name}</h3>
                      <p className="mt-1 text-base font-semibold text-foreground">Rs {Number(item.price).toFixed(0)}</p>
                      <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-success">
                        <Star className="size-3.5 fill-current" aria-hidden="true" /> {rating.toFixed(1)} ({ratingCount})
                      </p>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Button type="button" variant="ghost" size="sm" aria-label={`Save ${item.name}`} disabled={favoriteMutation.isPending} onClick={() => favoriteMutation.mutate(item.id)}>
                          <Heart className="size-4" aria-hidden="true" /> Save
                        </Button>
                        {hasCustomizations ? (
                          <Button type="button" variant="secondary" size="sm" disabled={outOfStock} onClick={() => setSelectedItem(item)}>Customize</Button>
                        ) : null}
                        {outOfStock ? <StatusPill label="Unavailable" tone="danger" /> : null}
                      </div>
                    </div>
                    <div className="relative min-h-40 overflow-hidden rounded-lg bg-surface-muted sm:min-h-36">
                      <Image src={item.imageUrl || ITEM_IMAGE_FALLBACK} alt="" fill sizes="160px" className="object-cover" unoptimized={!item.imageUrl} />
                      {outOfStock ? <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px]" aria-hidden="true" /> : null}
                      <div className="absolute inset-x-3 bottom-3 flex justify-center">
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

function ProductGridCard({ item, storeType, storeRating, storeRatingCount, etaMinutes, quantity, disabled, onAdd, onDecrease, onIncrease, onSave }: { item: MarketplaceMenuItem; storeType?: StoreListItem["type"]; storeRating?: string; storeRatingCount?: number; etaMinutes?: number; quantity: number; disabled: boolean; onAdd: () => void; onDecrease: () => void; onIncrease: () => void; onSave: () => void }) {
  const outOfStock = item.stock === 0 || !item.available;
  const price = Number(item.price);
  const mrp = Math.ceil(price * 1.14);
  const discount = Math.max(1, Math.round(((mrp - price) / mrp) * 100));
  const rating = itemRating(item, storeRating);
  const ratingCount = itemRatingCount(item, storeRatingCount);

  return (
    <article className="group overflow-hidden rounded-lg border border-border bg-surface shadow-sm transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md">
      <div className="relative aspect-[4/3] bg-surface-muted">
        <Image src={item.imageUrl || ITEM_IMAGE_FALLBACK} alt="" fill sizes="(max-width: 768px) 50vw, 240px" className="object-cover transition duration-300 group-hover:scale-[1.03]" unoptimized={!item.imageUrl} />
        <button type="button" className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-surface/90 text-muted-foreground shadow-sm backdrop-blur transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30" aria-label={`Save ${item.name}`} onClick={onSave}>
          <Heart className="size-4" aria-hidden="true" />
        </button>
        <div className="absolute inset-x-3 bottom-3 flex justify-end">
          <MenuCartControl item={item} quantity={quantity} disabled={disabled} onAdd={onAdd} onDecrease={onDecrease} onIncrease={onIncrease} />
        </div>
        {outOfStock ? <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px]" aria-hidden="true" /> : null}
      </div>
      <div className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <DietaryBadge type={resolveDietaryType(item, storeType)} />
          {isBestseller(item) ? <StatusPill label="Bestseller" tone="success" /> : null}
          {outOfStock ? <StatusPill label="Out of stock" tone="danger" /> : item.stock > 0 && item.stock <= 5 ? <StatusPill label={`${item.stock} left`} tone="warning" /> : null}
        </div>
        <p className="mt-3 text-xs font-semibold text-muted-foreground">{packSizeLabel(item)}</p>
        <h3 className="mt-1 line-clamp-2 min-h-12 text-base font-semibold leading-6 text-foreground">{item.name}</h3>
        <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">{item.description}</p>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-xl font-black text-foreground">Rs {price.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground"><span className="line-through">Rs {mrp}</span> <span className="font-semibold text-info">{discount}% off</span></p>
          </div>
          <p className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-xs font-semibold text-success"><Clock3 className="size-3.5" aria-hidden="true" /> {etaMinutes ?? 8} min</p>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 text-success"><Star className="size-3.5 fill-current" aria-hidden="true" /> {rating.toFixed(1)} ({ratingCount})</span>
          <span className="inline-flex items-center gap-1"><BadgePercent className="size-3.5" aria-hidden="true" /> Fresh price</span>
        </div>
      </div>
    </article>
  );
}

function MenuCartControl({ item, quantity, disabled, onAdd, onDecrease, onIncrease }: { item: MarketplaceMenuItem; quantity: number; disabled: boolean; onAdd: () => void; onDecrease: () => void; onIncrease: () => void }) {
  const maxed = item.stock !== -1 && quantity >= item.stock;

  if (quantity > 0) {
    return (
      <div className="inline-flex min-h-10 items-center overflow-hidden rounded-md bg-primary text-primary-foreground shadow-md" aria-label={`${item.name} quantity ${quantity}`}>
        <button type="button" className="grid size-10 place-items-center transition hover:bg-primary-hover disabled:opacity-50" onClick={onDecrease} disabled={disabled} aria-label={`Decrease ${item.name}`}>
          <Minus className="size-4" aria-hidden="true" />
        </button>
        <span className="min-w-10 px-2 text-center text-sm font-semibold" aria-live="polite">{quantity}</span>
        <button type="button" className="grid size-10 place-items-center transition hover:bg-primary-hover disabled:opacity-50" onClick={onIncrease} disabled={disabled || maxed} aria-label={`Increase ${item.name}`}>
          <Plus className="size-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <Button type="button" size="sm" variant="secondary" className="min-w-24 border-primary/30 bg-surface text-primary shadow-md hover:bg-primary/10" disabled={disabled} onClick={onAdd}>
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

function filterAndSortItems(items: MarketplaceMenuItem[], storeType: StoreListItem["type"] | undefined, query: string, sortMode: SortMode, dietaryFilter: DietaryFilter, availableOnly: boolean, bestsellerOnly: boolean) {
  const normalized = query.trim().toLowerCase();

  return [...items]
    .filter((item) => {
      if (availableOnly && (!item.available || item.stock === 0)) {
        return false;
      }

      if (bestsellerOnly && !isBestseller(item)) {
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
  return (isBestseller(item) ? 5 : 0) + (item.tags.includes("popular") ? 3 : 0) + (item.available ? 1 : 0);
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

function isBestseller(item: MarketplaceMenuItem) {
  return item.tags.some((tag) => ["popular", "best-seller", "bestseller"].includes(tag.toLowerCase()));
}

function packSizeLabel(item: MarketplaceMenuItem) {
  const match = item.description.match(/\b\d+(?:\.\d+)?\s?(?:g|kg|ml|l|tabs|tablets|pcs|pack)\b/i) ?? item.name.match(/\b\d+(?:\.\d+)?\s?(?:g|kg|ml|l|tabs|tablets|pcs|pack)\b/i);
  return match?.[0] ?? "1 pack";
}

function itemRating(item: MarketplaceMenuItem, storeRating?: string) {
  const base = Number(storeRating ?? "4.6");
  const boost = isBestseller(item) ? 0.1 : 0;
  return Math.min(4.9, Math.max(4.1, base + boost));
}

function itemRatingCount(item: MarketplaceMenuItem, storeRatingCount?: number) {
  const seed = item.name.length % 7;
  return Math.max(18, Math.round((storeRatingCount ?? 180) / (seed + 4)));
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