"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Clock3, Minus, Plus, ReceiptText, Ticket, Trash2 } from "lucide-react";

import { Button, Input, StatusPill } from "@/components/ui";
import { QueryState } from "@/providers/query-state";
import { ApiError, addCartItem, applyCartCoupon, clearCart, getCart, getStoreMenu, removeCartCoupon, removeCartItem, updateCartItemQty, type CartResponse, type MarketplaceMenuItem } from "@/lib/api";

const CART_QUERY_KEY = ["cart"] as const;
const CART_IMAGE_FALLBACK = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Crect width='160' height='160' rx='20' fill='%23ecfdf5'/%3E%3Ccircle cx='112' cy='42' r='36' fill='%23a7f3d0'/%3E%3Crect x='34' y='64' width='92' height='54' rx='14' fill='%23059669' opacity='.2'/%3E%3Cpath d='M50 101h60v10H50zM60 80h42v10H60z' fill='%23059669'/%3E%3C/svg%3E";

export function CartPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState<string | null>(null);

  const cartQuery = useQuery({ queryKey: CART_QUERY_KEY, queryFn: getCart });
  const cart = cartQuery.data;

  const quantityMutation = useMutation({
    mutationFn: ({ menuItemId, quantity }: { menuItemId: string; quantity: number }) => updateCartItemQty(menuItemId, quantity),
    onMutate: async ({ menuItemId, quantity }) => {
      await queryClient.cancelQueries({ queryKey: CART_QUERY_KEY });
      const previous = queryClient.getQueryData<CartResponse>(CART_QUERY_KEY);

      if (previous) {
        queryClient.setQueryData<CartResponse>(CART_QUERY_KEY, optimisticQuantity(previous, menuItemId, quantity));
      }

      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(CART_QUERY_KEY, context.previous);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY }),
  });

  const removeMutation = useMutation({
    mutationFn: removeCartItem,
    onSuccess: (nextCart) => queryClient.setQueryData(CART_QUERY_KEY, nextCart),
    onSettled: () => queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY }),
  });

  const clearMutation = useMutation({
    mutationFn: clearCart,
    onSuccess: (nextCart) => queryClient.setQueryData(CART_QUERY_KEY, nextCart),
  });

  const couponMutation = useMutation({
    mutationFn: applyCartCoupon,
    onMutate: () => setCouponError(null),
    onSuccess: (nextCart) => {
      setCouponInput("");
      queryClient.setQueryData(CART_QUERY_KEY, nextCart);
    },
    onError: (error) => setCouponError(error instanceof ApiError ? error.message : "Coupon could not be applied"),
  });

  const removeCouponMutation = useMutation({
    mutationFn: removeCartCoupon,
    onSuccess: (nextCart) => queryClient.setQueryData(CART_QUERY_KEY, nextCart),
  });

  const addOnMutation = useMutation({
    mutationFn: (item: MarketplaceMenuItem) => addCartItem({ menuItemId: item.id, quantity: 1, substitutionPreference: { allow: cart?.store?.type === "GROCERY" || cart?.store?.type === "PHARMACY" } }),
    onSuccess: (nextCart) => queryClient.setQueryData(CART_QUERY_KEY, nextCart),
    onSettled: () => queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY }),
  });

  const addOnsQuery = useQuery({
    queryKey: ["cart-addons", cart?.store?.id],
    queryFn: () => getStoreMenu(cart?.store?.id ?? ""),
    enabled: Boolean(cart?.store?.id && cart.items.length > 0),
    retry: false,
  });

  const itemCount = useMemo(() => cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0, [cart]);
  const hasItems = Boolean(cart && cart.items.length > 0);
  const cartTotal = cart?.pricing.total ?? "0";
  const etaMinutes = cart?.store?.etaMinutes ?? 18;
  const minimumRemaining = Number(cart?.pricing.minimumRemaining ?? 0);
  const addOns = useMemo(() => {
    const existing = new Set(cart?.items.map((item) => item.menuItemId) ?? []);
    return (addOnsQuery.data ?? []).filter((item) => item.available && item.stock !== 0 && !existing.has(item.id)).slice(0, 4);
  }, [addOnsQuery.data, cart?.items]);

  return (
    <div className="w-full">
      {/* Header and Back Button */}
      <div className="mb-6 flex items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Button onClick={() => router.back()} variant="ghost" size="icon" aria-label="Go back">
            <ArrowLeft className="size-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">My Cart</h1>
            {hasItems && cart?.store ? (
              <p className="text-xs text-muted-foreground">From {cart.store.name}</p>
            ) : null}
          </div>
        </div>

        {hasItems ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => clearMutation.mutate()} disabled={clearMutation.isPending} className="text-muted-foreground hover:text-destructive">
            Clear cart
          </Button>
        ) : null}
      </div>

      <QueryState isLoading={cartQuery.isLoading} isError={cartQuery.isError} error={cartQuery.error} onRetry={() => cartQuery.refetch()}>
        {!cart || cart.items.length === 0 ? (
          /* Empty Cart State with SVG Illustration */
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="relative mb-6 flex h-36 w-36 items-center justify-center rounded-full bg-primary/10 text-primary">
              <svg className="size-20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Your cart is empty</h2>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Add products from a store nearby to start checkout and get fast delivery.
            </p>
            <Button asChild className="mt-6 min-h-11 px-8">
              <Link href="/customer">Continue Shopping</Link>
            </Button>
          </div>
        ) : (
          /* Main Cart Content Grid */
          <div className="mx-auto max-w-3xl space-y-6 pb-24 md:pb-8">
              {/* Delivery ETA banner */}
              <div className="rounded-lg border border-primary/15 bg-primary/10 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 text-lg font-semibold text-foreground">
                      <Clock3 className="size-5 text-primary" aria-hidden="true" /> Delivery in {etaMinutes} minutes
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground font-medium">
                      Shipment of {itemCount} item{itemCount === 1 ? "" : "s"} from {cart.store?.name ?? "selected store"}
                    </p>
                  </div>
                  {cart.store?.isOpen ? (
                    <StatusPill label="Open" tone="success" />
                  ) : (
                    <StatusPill label="Closed" tone="warning" />
                  )}
                </div>
                {minimumRemaining > 0 ? (
                  <p className="mt-3 rounded-md bg-surface px-3 py-2 text-sm font-medium text-primary">
                    Add products worth Rs {minimumRemaining.toFixed(0)} more to meet the store minimum.
                  </p>
                ) : null}
              </div>

              {/* Cart Items List */}
              <div className="space-y-3">
                {cart.items.map((item) => (
                  <article key={item.menuItemId} className="grid grid-cols-[5.5rem_1fr] gap-4 rounded-lg border border-border bg-surface p-4 shadow-sm hover:border-primary/15 transition-all">
                    <div className="relative h-24 overflow-hidden rounded-md bg-surface-muted border border-border/50">
                      <Image src={item.imageUrl || CART_IMAGE_FALLBACK} alt={item.name} fill sizes="88px" className="object-cover" unoptimized={!item.imageUrl} />
                    </div>
                    <div className="flex flex-col justify-between min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-semibold text-foreground">{item.name}</h3>
                          <p className="mt-1 text-xs text-muted-foreground">{item.description || `${item.section} item`}</p>
                        </div>
                        <Button type="button" variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive hover:bg-destructive/10" aria-label={`Remove ${item.name}`} onClick={() => removeMutation.mutate(item.menuItemId)}>
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      </div>
                      
                      <div className="mt-3 flex items-end justify-between gap-3 flex-wrap">
                        {/* Quantity controls */}
                        <div className="inline-flex min-h-9 items-center overflow-hidden rounded-md bg-primary text-primary-foreground shadow-sm">
                          <button type="button" className="grid size-9 place-items-center transition hover:bg-primary-hover disabled:opacity-50" aria-label={`Decrease ${item.name}`} disabled={quantityMutation.isPending || removeMutation.isPending} onClick={() => (item.quantity <= 1 ? removeMutation.mutate(item.menuItemId) : quantityMutation.mutate({ menuItemId: item.menuItemId, quantity: item.quantity - 1 }))}>
                            <Minus className="size-4" aria-hidden="true" />
                          </button>
                          <span className="min-w-8 text-center text-sm font-semibold" aria-live="polite">{item.quantity}</span>
                          <button type="button" className="grid size-9 place-items-center transition hover:bg-primary-hover disabled:opacity-50" aria-label={`Increase ${item.name}`} disabled={quantityMutation.isPending || (item.stock !== -1 && item.quantity >= item.stock)} onClick={() => quantityMutation.mutate({ menuItemId: item.menuItemId, quantity: item.quantity + 1 })}>
                            <Plus className="size-4" aria-hidden="true" />
                          </button>
                        </div>
                        
                        {/* Price Details */}
                        <div className="text-right">
                          <p className="text-base font-bold text-foreground">Rs {Number(item.lineTotal).toFixed(0)}</p>
                          <p className="text-xs text-muted-foreground">Rs {Number(item.price).toFixed(0)} each</p>
                        </div>
                      </div>
                      {!item.available ? (
                        <p className="mt-2 text-xs text-destructive font-semibold" role="status">This item is no longer available.</p>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>

              {/* Addons suggestions */}
              {addOns.length > 0 ? (
                <section className="rounded-lg border border-border bg-surface p-4" aria-labelledby="cart-addons-heading">
                  <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
                    <h3 id="cart-addons-heading" className="text-base font-semibold text-foreground">You might also like</h3>
                    <span className="text-xs font-medium text-muted-foreground">Quick add-ons</span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {addOns.map((item) => (
                      <button key={item.id} type="button" className="grid grid-cols-[3.75rem_1fr_auto] items-center gap-3 rounded-md border border-border bg-surface-muted p-2.5 text-left transition hover:border-primary/35 hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30" onClick={() => addOnMutation.mutate(item)} disabled={addOnMutation.isPending}>
                        <span className="relative block size-14 overflow-hidden rounded-md bg-surface">
                          <Image src={item.imageUrl || CART_IMAGE_FALLBACK} alt={item.name} fill sizes="56px" className="object-cover" unoptimized={!item.imageUrl} />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-foreground">{item.name}</span>
                          <span className="block text-xs text-muted-foreground">Rs {Number(item.price).toFixed(0)}</span>
                        </span>
                        <span className="rounded-md border border-primary/30 bg-surface px-2.5 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/5">ADD</span>
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              {/* Coupons Form */}
              <form
                className="rounded-lg border border-border bg-surface p-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (couponInput.trim()) {
                    couponMutation.mutate(couponInput.trim());
                  }
                }}
              >
                <label className="text-sm font-medium text-foreground" htmlFor="cart-coupon">Apply coupon</label>
                <div className="mt-2 flex gap-2">
                  <Input id="cart-coupon" value={couponInput} onChange={(event) => setCouponInput(event.target.value)} placeholder="TRYMOVE" aria-invalid={Boolean(couponError || cart.couponError)} aria-describedby="cart-coupon-error" />
                  <Button type="submit" variant="secondary" disabled={couponMutation.isPending}>
                    <Ticket className="size-4" aria-hidden="true" />
                    Apply
                  </Button>
                </div>
                {cart.couponCode ? (
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>Applied: <strong className="text-primary font-semibold">{cart.couponCode}</strong></span>
                    <button type="button" className="font-semibold text-primary hover:underline" onClick={() => removeCouponMutation.mutate()}>Remove</button>
                  </div>
                ) : null}
                {couponError || cart.couponError ? <p id="cart-coupon-error" className="mt-2 text-xs text-destructive font-medium">{couponError ?? cart.couponError}</p> : null}
              </form>

              {/* Bill details */}
              <div className="space-y-4 rounded-lg border border-border bg-surface p-5 text-sm shadow-sm">
                <p className="flex items-center gap-2 text-base font-semibold text-foreground border-b border-border pb-3">
                  <ReceiptText className="size-4 text-primary" aria-hidden="true" /> Bill details
                </p>
                
                <div className="space-y-2.5">
                  <PriceRow label="Items total" value={cart.pricing.subtotal} />
                  <PriceRow label="Delivery charge" value={cart.pricing.deliveryFee} />
                  <PriceRow label="Discount" value={cart.pricing.discount} prefix="- " />
                  <PriceRow label="Estimated taxes" value={cart.pricing.taxes} />
                  
                  <div className="border-t border-border pt-3 mt-3">
                    <PriceRow label="Grand total" value={cart.pricing.total} strong />
                  </div>
                </div>

                {/* Desktop Checkout button */}
                <Button asChild className="hidden md:flex min-h-12 w-full mt-6 text-base font-semibold">
                  <Link href="/customer/checkout">
                    Proceed to Checkout
                    <ArrowRight className="size-5 ml-1" aria-hidden="true" />
                  </Link>
                </Button>
              </div>

              {/* Mobile View Sticky Proceed Button */}
              <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/96 p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] backdrop-blur-md md:hidden">
                <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
                  <div className="min-w-0">
                    <span className="block text-xs text-muted-foreground font-semibold">Grand Total</span>
                    <span className="text-xl font-bold text-foreground">Rs {Number(cartTotal).toFixed(0)}</span>
                  </div>
                  <Button asChild className="flex-1 min-h-12 text-sm font-semibold max-w-[200px]">
                    <Link href="/customer/checkout">
                      Checkout
                      <ArrowRight className="size-4 ml-1" aria-hidden="true" />
                    </Link>
                  </Button>
                </div>
              </div>
          </div>
        )}
      </QueryState>
    </div>
  );
}

function PriceRow({ label, value, prefix = "", strong = false }: { label: string; value: string; prefix?: string; strong?: boolean }) {
  return (
    <div className={strong ? "flex items-center justify-between text-base font-bold text-foreground" : "flex items-center justify-between text-muted-foreground font-medium"}>
      <span>{label}</span>
      <span>{prefix}Rs {Number(value).toFixed(0)}</span>
    </div>
  );
}

function optimisticQuantity(cart: CartResponse, menuItemId: string, quantity: number): CartResponse {
  return {
    ...cart,
    items: cart.items.map((item) => {
      if (item.menuItemId !== menuItemId) {
        return item;
      }

      const lineTotal = Number(item.price) * quantity;
      return { ...item, quantity, lineTotal: String(lineTotal) };
    }),
  };
}
