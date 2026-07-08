"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Clock3, Minus, Plus, ReceiptText, ShoppingBag, Ticket, Trash2 } from "lucide-react";

import { Button, Drawer, DrawerContent, DrawerTrigger, EmptyState, Input, RetryButton, Skeleton, StatusPill } from "@/components/ui";
import { ApiError, addCartItem, applyCartCoupon, clearCart, getCart, getStoreMenu, removeCartCoupon, removeCartItem, updateCartItemQty, type CartResponse, type MarketplaceMenuItem } from "@/lib/api";

const CART_QUERY_KEY = ["cart"] as const;
const CART_IMAGE_FALLBACK = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Crect width='160' height='160' rx='20' fill='%23ecfdf5'/%3E%3Ccircle cx='112' cy='42' r='36' fill='%23a7f3d0'/%3E%3Crect x='34' y='64' width='92' height='54' rx='14' fill='%23059669' opacity='.2'/%3E%3Cpath d='M50 101h60v10H50zM60 80h42v10H60z' fill='%23059669'/%3E%3C/svg%3E";

export function CartDrawer() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
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
    <>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <Button variant="secondary" size="icon" className="relative" aria-label={`Cart with ${itemCount} items`}>
            <ShoppingBag className="size-4" aria-hidden="true" />
            {itemCount > 0 ? (
              <span className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[0.65rem] font-semibold leading-5 text-primary-foreground shadow-sm" aria-hidden="true">
                {itemCount > 9 ? "9+" : itemCount}
              </span>
            ) : null}
          </Button>
        </DrawerTrigger>
        <DrawerContent title="Cart" description={cart?.store ? cart.store.name : "Delivery checkout"} className="flex flex-col">
          <div className="mt-5 flex min-h-0 flex-1 flex-col gap-4">
            {cartQuery.isLoading ? (
              <div className="space-y-3" aria-busy="true" aria-live="polite">
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
              </div>
            ) : cartQuery.isError ? (
              <EmptyState title="Cart unavailable" description="We could not load your cart." action={<RetryButton onRetry={() => cartQuery.refetch()} />} />
            ) : !cart || cart.items.length === 0 ? (
              <EmptyState title="Your cart is empty" description="Add items from a nearby store to start checkout." />
            ) : (
              <>
                <div className="rounded-lg border border-primary/15 bg-primary/10 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="flex items-center gap-2 text-lg font-semibold text-foreground"><Clock3 className="size-5 text-primary" aria-hidden="true" /> Delivery in {etaMinutes} minutes</p>
                      <p className="mt-1 text-sm text-muted-foreground">Shipment of {itemCount} item{itemCount === 1 ? "" : "s"} from {cart.store?.name ?? "selected store"}</p>
                    </div>
                    {cart.store?.isOpen ? <StatusPill label="Open" tone="success" /> : <StatusPill label="Closed" tone="warning" />}
                  </div>
                  {minimumRemaining > 0 ? <p className="mt-3 rounded-md bg-surface px-3 py-2 text-sm text-primary">Add products worth Rs {minimumRemaining.toFixed(0)} more to meet the store minimum.</p> : null}
                </div>

                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                  {cart.items.map((item) => (
                    <article key={item.menuItemId} className="grid grid-cols-[4.5rem_1fr] gap-3 rounded-lg border border-border bg-surface p-3 shadow-sm">
                      <div className="relative h-20 overflow-hidden rounded-md bg-surface-muted">
                        <Image src={item.imageUrl || CART_IMAGE_FALLBACK} alt="" fill sizes="72px" className="object-cover" unoptimized={!item.imageUrl} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-semibold text-foreground">{item.name}</h3>
                            <p className="mt-1 text-xs text-muted-foreground">{item.description || `${item.section} item`}</p>
                          </div>
                          <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${item.name}`} onClick={() => removeMutation.mutate(item.menuItemId)}>
                            <Trash2 className="size-4" aria-hidden="true" />
                          </Button>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div className="inline-flex min-h-9 items-center overflow-hidden rounded-md bg-primary text-primary-foreground shadow-sm">
                            <button type="button" className="grid size-9 place-items-center transition hover:bg-primary-hover disabled:opacity-50" aria-label={`Decrease ${item.name}`} disabled={quantityMutation.isPending || removeMutation.isPending} onClick={() => (item.quantity <= 1 ? removeMutation.mutate(item.menuItemId) : quantityMutation.mutate({ menuItemId: item.menuItemId, quantity: item.quantity - 1 }))}>
                              <Minus className="size-4" aria-hidden="true" />
                            </button>
                            <span className="min-w-8 text-center text-sm font-semibold" aria-live="polite">{item.quantity}</span>
                            <button type="button" className="grid size-9 place-items-center transition hover:bg-primary-hover disabled:opacity-50" aria-label={`Increase ${item.name}`} disabled={quantityMutation.isPending || (item.stock !== -1 && item.quantity >= item.stock)} onClick={() => quantityMutation.mutate({ menuItemId: item.menuItemId, quantity: item.quantity + 1 })}>
                              <Plus className="size-4" aria-hidden="true" />
                            </button>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-foreground">Rs {Number(item.lineTotal).toFixed(0)}</p>
                            <p className="text-xs text-muted-foreground">Rs {Number(item.price).toFixed(0)} each</p>
                          </div>
                        </div>
                        {!item.available ? <p className="mt-2 text-xs text-destructive" role="status">This item is no longer available.</p> : null}
                      </div>
                    </article>
                  ))}
                </div>

                {addOns.length > 0 ? (
                  <section className="rounded-lg border border-border bg-surface p-3" aria-labelledby="cart-addons-heading">
                    <div className="flex items-center justify-between gap-3">
                      <h3 id="cart-addons-heading" className="text-base font-semibold text-foreground">You might also like</h3>
                      <span className="text-xs font-medium text-muted-foreground">Quick add-ons</span>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {addOns.map((item) => (
                        <button key={item.id} type="button" className="grid grid-cols-[3.75rem_1fr_auto] items-center gap-3 rounded-md border border-border bg-surface-muted p-2 text-left transition hover:border-primary/35 hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30" onClick={() => addOnMutation.mutate(item)} disabled={addOnMutation.isPending}>
                          <span className="relative block size-14 overflow-hidden rounded-md bg-surface">
                            <Image src={item.imageUrl || CART_IMAGE_FALLBACK} alt="" fill sizes="56px" className="object-cover" unoptimized={!item.imageUrl} />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-foreground">{item.name}</span>
                            <span className="block text-xs text-muted-foreground">Rs {Number(item.price).toFixed(0)}</span>
                          </span>
                          <span className="rounded-md border border-primary/30 bg-surface px-2 py-1 text-xs font-semibold text-primary">ADD</span>
                        </button>
                      ))}
                    </div>
                  </section>
                ) : null}

                <form
                  className="rounded-lg border border-border bg-surface p-3"
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
                      <span>Applied: {cart.couponCode}</span>
                      <button type="button" className="font-medium text-primary" onClick={() => removeCouponMutation.mutate()}>Remove</button>
                    </div>
                  ) : null}
                  {couponError || cart.couponError ? <p id="cart-coupon-error" className="mt-2 text-xs text-destructive">{couponError ?? cart.couponError}</p> : null}
                </form>

                <div className="space-y-2 rounded-lg border border-border bg-surface p-3 text-sm">
                  <p className="flex items-center gap-2 text-base font-semibold text-foreground"><ReceiptText className="size-4 text-primary" aria-hidden="true" /> Bill details</p>
                  <PriceRow label="Items total" value={cart.pricing.subtotal} />
                  <PriceRow label="Delivery charge" value={cart.pricing.deliveryFee} />
                  <PriceRow label="Discount" value={cart.pricing.discount} prefix="- " />
                  <PriceRow label="Estimated taxes" value={cart.pricing.taxes} />
                  <div className="border-t border-border pt-2">
                    <PriceRow label="Grand total" value={cart.pricing.total} strong />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Button asChild className="min-h-12">
                    <Link href="/customer/checkout">Checkout<ArrowRight className="size-4" aria-hidden="true" /></Link>
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => clearMutation.mutate()} disabled={clearMutation.isPending}>Clear cart</Button>
                </div>
              </>
            )}
          </div>
        </DrawerContent>
      </Drawer>
      {hasItems ? (
        <button
          type="button"
          className="fixed inset-x-4 bottom-4 z-40 flex min-h-16 items-center justify-between gap-3 rounded-full border border-primary/20 bg-primary px-4 text-left text-primary-foreground shadow-[var(--shadow-shell)] transition hover:-translate-y-0.5 md:left-auto md:right-6 md:w-[24rem]"
          onClick={() => setOpen(true)}
          aria-label={`View cart with ${itemCount} items totaling Rs ${Number(cartTotal).toFixed(0)}`}
        >
          <span className="flex min-w-0 items-center gap-3">
            <CartImageStack cart={cart} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">View cart</span>
              <span className="block text-xs text-primary-foreground/78">{itemCount} item{itemCount === 1 ? "" : "s"} - Rs {Number(cartTotal).toFixed(0)}</span>
            </span>
          </span>
          <ArrowRight className="size-5 shrink-0" aria-hidden="true" />
        </button>
      ) : null}
    </>
  );
}

function CartImageStack({ cart }: { cart?: CartResponse }) {
  const items = cart?.items.slice(0, 3) ?? [];

  return (
    <span className="flex -space-x-2">
      {items.length > 0 ? items.map((item) => (
        <span key={item.menuItemId} className="relative block size-10 overflow-hidden rounded-full border-2 border-primary bg-surface">
          <Image src={item.imageUrl || CART_IMAGE_FALLBACK} alt="" fill sizes="40px" className="object-cover" unoptimized={!item.imageUrl} />
        </span>
      )) : <span className="grid size-10 place-items-center rounded-full bg-primary-hover"><ShoppingBag className="size-5" aria-hidden="true" /></span>}
    </span>
  );
}

function PriceRow({ label, value, prefix = "", strong = false }: { label: string; value: string; prefix?: string; strong?: boolean }) {
  return (
    <div className={strong ? "flex items-center justify-between text-base font-semibold text-foreground" : "flex items-center justify-between text-muted-foreground"}>
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