"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, ShoppingBag, Ticket, Trash2 } from "lucide-react";

import { Button, Drawer, DrawerContent, DrawerTrigger, EmptyState, Input, RetryButton, Skeleton, StatusPill } from "@/components/ui";
import { ApiError, applyCartCoupon, clearCart, getCart, removeCartCoupon, removeCartItem, updateCartItemQty, type CartResponse } from "@/lib/api";

const CART_QUERY_KEY = ["cart"] as const;

export function CartDrawer() {
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

  const itemCount = useMemo(() => cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0, [cart]);

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="secondary" size="icon" aria-label={`Cart with ${itemCount} items`}>
          <ShoppingBag className="size-4" aria-hidden="true" />
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
              <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-muted p-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{cart.store?.name ?? "Store"}</p>
                  <p className="text-xs text-muted-foreground">{itemCount} item{itemCount === 1 ? "" : "s"}</p>
                </div>
                {cart.store?.isOpen ? <StatusPill label="Open" tone="success" /> : <StatusPill label="Closed" tone="warning" />}
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                {cart.items.map((item) => (
                  <article key={item.menuItemId} className="rounded-md border border-border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-foreground">{item.name}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">Rs {Number(item.price).toFixed(0)} each</p>
                      </div>
                      <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${item.name}`} onClick={() => removeMutation.mutate(item.menuItemId)}>
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="secondary" size="icon" aria-label={`Decrease ${item.name}`} disabled={item.quantity <= 1 || quantityMutation.isPending} onClick={() => quantityMutation.mutate({ menuItemId: item.menuItemId, quantity: item.quantity - 1 })}>
                          <Minus className="size-4" aria-hidden="true" />
                        </Button>
                        <span className="w-8 text-center text-sm font-semibold" aria-live="polite">{item.quantity}</span>
                        <Button type="button" variant="secondary" size="icon" aria-label={`Increase ${item.name}`} disabled={quantityMutation.isPending || (item.stock !== -1 && item.quantity >= item.stock)} onClick={() => quantityMutation.mutate({ menuItemId: item.menuItemId, quantity: item.quantity + 1 })}>
                          <Plus className="size-4" aria-hidden="true" />
                        </Button>
                      </div>
                      <div className="text-sm font-semibold text-foreground">Rs {Number(item.lineTotal).toFixed(0)}</div>
                    </div>
                    {!item.available ? <p className="mt-2 text-xs text-destructive" role="status">This item is no longer available.</p> : null}
                  </article>
                ))}
              </div>

              <form
                className="rounded-md border border-border p-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (couponInput.trim()) {
                    couponMutation.mutate(couponInput.trim());
                  }
                }}
              >
                <label className="text-sm font-medium text-foreground" htmlFor="cart-coupon">Coupon</label>
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
                    <button type="button" className="font-medium text-brand" onClick={() => removeCouponMutation.mutate()}>Remove</button>
                  </div>
                ) : null}
                {couponError || cart.couponError ? <p id="cart-coupon-error" className="mt-2 text-xs text-destructive">{couponError ?? cart.couponError}</p> : null}
              </form>

              <div className="space-y-2 rounded-md border border-border bg-surface-muted p-3 text-sm">
                <PriceRow label="Subtotal" value={cart.pricing.subtotal} />
                <PriceRow label="Discount" value={cart.pricing.discount} prefix="- " />
                <PriceRow label="Taxes" value={cart.pricing.taxes} />
                <div className="border-t border-border pt-2">
                  <PriceRow label="Cart total" value={cart.pricing.total} strong />
                </div>
              </div>

              <div className="grid gap-2">
                <Button asChild>
                  <Link href="/customer/checkout">Checkout</Link>
                </Button>
                <Button type="button" variant="ghost" onClick={() => clearMutation.mutate()} disabled={clearMutation.isPending}>Clear cart</Button>
              </div>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function PriceRow({ label, value, prefix = "", strong = false }: { label: string; value: string; prefix?: string; strong?: boolean }) {
  return (
    <div className={strong ? "flex items-center justify-between font-semibold text-foreground" : "flex items-center justify-between text-muted-foreground"}>
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