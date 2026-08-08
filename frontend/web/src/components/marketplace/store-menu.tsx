"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { BadgePercent, Clock3, Heart, Minus, PackageX, Plus, Search, ShoppingBag, SlidersHorizontal, Star } from "lucide-react";

import { Button, EmptyState, Input, Skeleton, StatusPill, useToast } from "@/components/ui";
import {
  addCartItem,
  getCart,
  listFavorites,
  removeCartItem,
  removeFavorite,
  saveFavorite,
  updateCartItemQty,
  type CartResponse,
  type MarketplaceMenuItem,
  type StoreListItem,
} from "@/lib/api";
import { dietaryLabels, resolveDietaryType, type DietaryType } from "@/lib/dietary";
import { cn } from "@/lib/utils";
import { CustomizationModal } from "./customization-modal";


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
  const favoritesQuery = useQuery({ queryKey: ["favorites"], queryFn: () => listFavorites(), retry: false });
  const favoriteIds = useMemo(() => new Set(favoritesQuery.data?.items.map((f) => f.targetId) ?? []), [favoritesQuery.data]);

  const toggleFavoriteMutation = useMutation({
    mutationFn: async (targetId: string) => {
      if (favoriteIds.has(targetId)) {
        await removeFavorite({ type: "MENU_ITEM", targetId });
        return { targetId, action: "removed" as const };
      } else {
        await saveFavorite({ type: "MENU_ITEM", targetId });
        return { targetId, action: "added" as const };
      }
    },
    onSuccess: ({ action }) => {
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
      toast({
        title: action === "added" ? "Saved to favorites" : "Removed from favorites",
        description: action === "added" ? "Item saved to your wishlist in profile." : "Item removed from your wishlist.",
        kind: "info",
      });
    },
    onError: (caught) => toast({ title: "Could not update favorites", description: caught instanceof Error ? caught.message : "Please try again.", kind: "error" }),
  });
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
                isSaved={favoriteIds.has(item.id)}
                onAdd={() => addMutation.mutate(item)}
                onDecrease={() => quantityMutation.mutate({ item, quantity: quantity - 1 })}
                onIncrease={() => quantityMutation.mutate({ item, quantity: quantity + 1 })}
                onSave={() => toggleFavoriteMutation.mutate(item.id)}
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
                  <article key={item.id} className="group flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md sm:flex-row sm:items-start">
                    <div className="relative h-40 w-full shrink-0 overflow-hidden rounded-lg bg-surface-muted sm:h-32 sm:w-32">
                      <Image src={item.imageUrl || getProductImage(item.name, storeType)} alt={item.name} fill sizes="(max-width: 640px) 100vw, 128px" className="object-cover transition duration-300 group-hover:scale-105" unoptimized={!item.imageUrl} />
                      {outOfStock ? <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px]" aria-hidden="true" /> : null}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex flex-wrap items-center gap-2">
                        <DietaryBadge type={resolveDietaryType(item, storeType)} />
                        {isBestseller(item) ? <StatusPill label="Bestseller" tone="success" /> : null}
                        {lowStock ? <StatusPill label={`${item.stock} left`} tone="warning" /> : null}
                      </div>
                      <h3 className="mt-2 text-base font-semibold leading-6 text-foreground">{item.name}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-3">
                        <p className="text-base font-semibold text-foreground">Rs {Number(item.price).toFixed(0)}</p>
                        <p className="inline-flex items-center gap-1 text-xs font-medium text-success">
                          <Star className="size-3.5 fill-current" aria-hidden="true" /> {rating.toFixed(1)} ({ratingCount})
                        </p>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm leading-5 text-muted-foreground">{item.description}</p>
                      
                      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button type="button" variant="ghost" size="sm" aria-label={`Save ${item.name}`} disabled={toggleFavoriteMutation.isPending} onClick={() => toggleFavoriteMutation.mutate(item.id)}>
                            <Heart className={cn("size-4", favoriteIds.has(item.id) && "fill-destructive text-destructive")} aria-hidden="true" /> {favoriteIds.has(item.id) ? "Saved" : "Save"}
                          </Button>
                          {hasCustomizations ? (
                            <Button type="button" variant="secondary" size="sm" disabled={outOfStock} onClick={() => setSelectedItem(item)}>Customize</Button>
                          ) : null}
                          {outOfStock ? <StatusPill label="Unavailable" tone="danger" /> : null}
                        </div>
                        <div className="shrink-0">
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

function ProductGridCard({ item, storeType, storeRating, storeRatingCount, etaMinutes, quantity, disabled, isSaved, onAdd, onDecrease, onIncrease, onSave }: { item: MarketplaceMenuItem; storeType?: StoreListItem["type"]; storeRating?: string; storeRatingCount?: number; etaMinutes?: number; quantity: number; disabled: boolean; isSaved?: boolean; onAdd: () => void; onDecrease: () => void; onIncrease: () => void; onSave: () => void }) {
  const outOfStock = item.stock === 0 || !item.available;
  const price = Number(item.price);
  const mrp = Math.ceil(price * 1.14);
  const discount = Math.max(1, Math.round(((mrp - price) / mrp) * 100));
  const rating = itemRating(item, storeRating);
  const ratingCount = itemRatingCount(item, storeRatingCount);

  return (
    <article className="group overflow-hidden rounded-lg border border-border bg-surface shadow-sm transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md flex flex-col">
      <div className="relative aspect-[4/3] bg-surface-muted shrink-0">
        <Image src={item.imageUrl || getProductImage(item.name, storeType)} alt="" fill sizes="(max-width: 768px) 50vw, 240px" className="object-cover transition duration-300 group-hover:scale-[1.03]" unoptimized={!item.imageUrl} />
        <button type="button" className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-surface/90 text-muted-foreground shadow-sm backdrop-blur transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30" aria-label={`Save ${item.name}`} onClick={onSave}>
          <Heart className={cn("size-4", isSaved && "fill-destructive text-destructive")} aria-hidden="true" />
        </button>
        {outOfStock ? <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px]" aria-hidden="true" /> : null}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center gap-2">
          <DietaryBadge type={resolveDietaryType(item, storeType)} />
          {isBestseller(item) ? <StatusPill label="Bestseller" tone="success" /> : null}
          {outOfStock ? <StatusPill label="Out of stock" tone="danger" /> : item.stock > 0 && item.stock <= 5 ? <StatusPill label={`${item.stock} left`} tone="warning" /> : null}
        </div>
        <p className="mt-3 text-xs font-semibold text-muted-foreground">{packSizeLabel(item)}</p>
        <h3 className="mt-1 line-clamp-2 min-h-[3rem] text-base font-semibold leading-6 text-foreground">{item.name}</h3>
        <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">{item.description}</p>
        
        <div className="mt-auto pt-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-xl font-black text-foreground">Rs {price.toFixed(0)}</p>
              <p className="text-xs text-muted-foreground"><span className="line-through">Rs {mrp}</span> <span className="font-semibold text-info">{discount}% off</span></p>
            </div>
            <p className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-xs font-semibold text-success"><Clock3 className="size-3.5" aria-hidden="true" /> {etaMinutes ?? 8} min</p>
          </div>
          <div className="mb-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 text-success"><Star className="size-3.5 fill-current" aria-hidden="true" /> {rating.toFixed(1)} ({ratingCount})</span>
            <span className="inline-flex items-center gap-1"><BadgePercent className="size-3.5" aria-hidden="true" /> Fresh price</span>
          </div>
          
          <div className="w-full">
            <MenuCartControl item={item} quantity={quantity} disabled={disabled} onAdd={onAdd} onDecrease={onDecrease} onIncrease={onIncrease} fullWidth />
          </div>
        </div>
      </div>
    </article>
  );
}

function MenuCartControl({ item, quantity, disabled, onAdd, onDecrease, onIncrease, fullWidth }: { item: MarketplaceMenuItem; quantity: number; disabled: boolean; onAdd: () => void; onDecrease: () => void; onIncrease: () => void; fullWidth?: boolean }) {
  const maxed = item.stock !== -1 && quantity >= item.stock;

  if (quantity > 0) {
    return (
      <div className={cn("inline-flex min-h-10 items-center overflow-hidden rounded-md bg-primary text-primary-foreground shadow-md", fullWidth && "flex w-full justify-between")} aria-label={`${item.name} quantity ${quantity}`}>
        <button type="button" className={cn("grid size-10 place-items-center transition hover:bg-primary-hover disabled:opacity-50", fullWidth && "w-1/3")} onClick={onDecrease} disabled={disabled} aria-label={`Decrease ${item.name}`}>
          <Minus className="size-4" aria-hidden="true" />
        </button>
        <span className={cn("min-w-10 px-2 text-center text-sm font-semibold", fullWidth && "flex-1")} aria-live="polite">{quantity}</span>
        <button type="button" className={cn("grid size-10 place-items-center transition hover:bg-primary-hover disabled:opacity-50", fullWidth && "w-1/3")} onClick={onIncrease} disabled={disabled || maxed} aria-label={`Increase ${item.name}`}>
          <Plus className="size-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <Button type="button" size="sm" variant="secondary" className={cn("min-w-24 border-primary/30 bg-surface text-primary shadow-md hover:bg-primary/10", fullWidth && "w-full text-base font-semibold min-h-10")} disabled={disabled} onClick={onAdd}>
      {item.stock === 0 ? <PackageX className="size-4" aria-hidden="true" /> : <ShoppingBag className="size-4" aria-hidden="true" />}
      Add to Cart
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

export function getProductImage(name: string, storeType?: string) {
  const lowerName = name.toLowerCase();
  
  const mappings: Array<[string, string]> = [
    // Food — specific combos first
    ["chicken 65", "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=800&q=80"],
    ["chicken biryani", "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&q=80"],
    ["paneer tikka", "https://images.unsplash.com/photo-1599487405270-8159b1523c92?w=800&q=80"],
    ["butter chicken", "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=800&q=80"],
    ["ice cream", "https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=800&q=80"],
    ["fried rice", "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80"],
    ["fish fry", "https://images.unsplash.com/photo-1534766555764-ce878a4e2da1?w=800&q=80"],

    // Food — general
    ["biryani", "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&q=80"],
    ["paneer", "https://images.unsplash.com/photo-1599487405270-8159b1523c92?w=800&q=80"],
    ["tikka", "https://images.unsplash.com/photo-1599487405270-8159b1523c92?w=800&q=80"],
    ["tandoori", "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=800&q=80"],
    ["kebab", "https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=800&q=80"],
    ["chicken", "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800&q=80"],
    ["mutton", "https://images.unsplash.com/photo-1545247181-516773cae754?w=800&q=80"],
    ["fish", "https://images.unsplash.com/photo-1534766555764-ce878a4e2da1?w=800&q=80"],
    ["prawn", "https://images.unsplash.com/photo-1565680018093-ebb6b9ab5460?w=800&q=80"],
    ["burger", "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80"],
    ["pizza", "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=80"],
    ["dosa", "https://images.unsplash.com/photo-1589301760014-d929f39ce9de?w=800&q=80"],
    ["idli", "https://images.unsplash.com/photo-1589301773112-0058bc5b4725?w=800&q=80"],
    ["momos", "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=800&q=80"],
    ["samosa", "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800&q=80"],
    ["paratha", "https://images.unsplash.com/photo-1626200419199-391ae4be7a41?w=800&q=80"],
    ["naan", "https://images.unsplash.com/photo-1626200419199-391ae4be7a41?w=800&q=80"],
    ["roti", "https://images.unsplash.com/photo-1626200419199-391ae4be7a41?w=800&q=80"],
    ["thali", "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&q=80"],
    ["curry", "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80"],
    ["dal", "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&q=80"],
    ["soup", "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&q=80"],
    ["salad", "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80"],
    ["noodles", "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=800&q=80"],
    ["pasta", "https://images.unsplash.com/photo-1563379926898-05f4575a45d8?w=800&q=80"],
    ["roll", "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=800&q=80"],
    ["wrap", "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=800&q=80"],
    ["fries", "https://images.unsplash.com/photo-1576107223126-a979201a0808?w=800&q=80"],
    ["dessert", "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&q=80"],
    ["cake", "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&q=80"],
    ["gulab jamun", "https://images.unsplash.com/photo-1666190077389-52c0b4321d2f?w=800&q=80"],
    ["coffee", "https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=800&q=80"],
    ["tea", "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=800&q=80"],
    ["milkshake", "https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=800&q=80"],
    ["juice", "https://images.unsplash.com/photo-1534353473418-4cfa6c56fd38?w=800&q=80"],
    ["lassi", "https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=800&q=80"],

    // Grocery
    ["rice", "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=800&q=80"],
    ["atta", "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=800&q=80"],
    ["flour", "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=800&q=80"],
    ["milk", "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=800&q=80"],
    ["bread", "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&q=80"],
    ["egg", "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=800&q=80"],
    ["butter", "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=800&q=80"],
    ["cheese", "https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=800&q=80"],
    ["oil", "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=800&q=80"],
    ["sugar", "https://images.unsplash.com/photo-1581268293-24ca21f1e3db?w=800&q=80"],
    ["apple", "https://images.unsplash.com/photo-1560806887-1e4cd0b6fc6c?w=800&q=80"],
    ["banana", "https://images.unsplash.com/photo-1528825871115-3581a5387919?w=800&q=80"],
    ["mango", "https://images.unsplash.com/photo-1553279768-865429fa0078?w=800&q=80"],
    ["tomato", "https://images.unsplash.com/photo-1546470427-e26264be0b0d?w=800&q=80"],
    ["onion", "https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=800&q=80"],
    ["potato", "https://images.unsplash.com/photo-1518977676601-b53f82ber630?w=800&q=80"],
    ["chips", "https://images.unsplash.com/photo-1566478989037-e924e7da00f7?w=800&q=80"],
    ["biscuit", "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=800&q=80"],
    ["chocolate", "https://images.unsplash.com/photo-1481391319762-47dff72954d9?w=800&q=80"],
    ["spice", "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=800&q=80"],
    ["masala", "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=800&q=80"],
    ["pickle", "https://images.unsplash.com/photo-1589135716294-8b5c6f1f1e2e?w=800&q=80"],
    ["jam", "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=800&q=80"],
    ["cereal", "https://images.unsplash.com/photo-1521483451569-e33803c0330c?w=800&q=80"],
    ["oats", "https://images.unsplash.com/photo-1517673400267-0251440c45dc?w=800&q=80"],
    ["water", "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=800&q=80"],
    ["soap", "https://images.unsplash.com/photo-1600857062241-98e5dba7f214?w=800&q=80"],
    ["detergent", "https://images.unsplash.com/photo-1584820927498-cafe3c0b1154?w=800&q=80"],

    // Pharmacy
    ["paracetamol", "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&q=80"],
    ["vitamin", "https://images.unsplash.com/photo-1550572017-edb1eb32c45e?w=800&q=80"],
    ["tablet", "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=800&q=80"],
    ["capsule", "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=800&q=80"],
    ["syrup", "https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=800&q=80"],
    ["drops", "https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=800&q=80"],
    ["cream", "https://images.unsplash.com/photo-1611080626919-7cf5a9dbab5b?w=800&q=80"],
    ["ointment", "https://images.unsplash.com/photo-1611080626919-7cf5a9dbab5b?w=800&q=80"],
    ["bandage", "https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=800&q=80"],
    ["sanitizer", "https://images.unsplash.com/photo-1584744982491-665216d95f8b?w=800&q=80"],
    ["mask", "https://images.unsplash.com/photo-1586942368453-62c2f6d0f507?w=800&q=80"],
    ["thermometer", "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&q=80"],
    ["supplement", "https://images.unsplash.com/photo-1550572017-edb1eb32c45e?w=800&q=80"],
    ["protein", "https://images.unsplash.com/photo-1550572017-edb1eb32c45e?w=800&q=80"],
    ["inhaler", "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&q=80"],
    ["medicine", "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&q=80"],
  ];

  for (const [key, url] of mappings) {
    if (lowerName.includes(key)) {
      return url;
    }
  }

  if (storeType === "PHARMACY") {
    return "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&q=80";
  }
  if (storeType === "GROCERY") {
    return "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&q=80";
  }

  return "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80";
}

export function getStoreHeroImage(storeName: string, storeType?: string) {
  const lowerName = storeName.toLowerCase();

  const storeHeroMappings: Array<[string, string]> = [
    ["biryani", "https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=1200&q=80"],
    ["pizza", "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=1200&q=80"],
    ["burger", "https://images.unsplash.com/photo-1550547660-d9450f859349?w=1200&q=80"],
    ["chinese", "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=1200&q=80"],
    ["south indian", "https://images.unsplash.com/photo-1589301760014-d929f39ce9de?w=1200&q=80"],
    ["cafe", "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=1200&q=80"],
    ["bakery", "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=1200&q=80"],
    ["sweet", "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=1200&q=80"],
    ["kebab", "https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=1200&q=80"],
    ["grill", "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=1200&q=80"],
    ["dhaba", "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=1200&q=80"],
    ["mughlai", "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=1200&q=80"],
  ];

  for (const [key, url] of storeHeroMappings) {
    if (lowerName.includes(key)) {
      return url;
    }
  }

  if (storeType === "PHARMACY") {
    return "https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=1200&q=80";
  }
  if (storeType === "GROCERY") {
    return "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=1200&q=80";
  }

  // Default: a beautiful Indian restaurant interior
  return "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80";
}