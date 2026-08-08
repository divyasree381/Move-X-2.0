"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3, ReceiptText, RefreshCw, ShoppingBag } from "lucide-react";

import { QueryState } from "@/providers/query-state";
import { Button, EmptyState, StatusPill, useToast } from "@/components/ui";
import { addCartItem, clearCart, listOrders, type OrderSummary } from "@/lib/api";
import { getStoreHeroImage, getProductImage } from "@/components/marketplace/store-menu";

const CART_QUERY_KEY = ["cart"] as const;

export function OrderHistoryPage() {
  const ordersQuery = useQuery({ queryKey: ["orders"], queryFn: () => listOrders({ limit: 20 }) });
  const orders = ordersQuery.data?.items ?? [];

  return (
    <section className="rounded-md border border-border bg-surface p-4" aria-labelledby="orders-heading">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="orders-heading" className="text-base font-semibold text-foreground">Orders</h2>
          <p className="mt-1 text-sm text-muted-foreground">Track delivery orders and reorder your favourites.</p>
        </div>
        <ReceiptText className="size-5 text-brand" aria-hidden="true" />
      </div>
      <div className="mt-4">
        <QueryState isLoading={ordersQuery.isLoading} isError={ordersQuery.isError} error={ordersQuery.error} onRetry={() => ordersQuery.refetch()}>
          {orders.length > 0 ? (
            <div className="grid gap-4">
              {orders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          ) : (
            <EmptyState title="No orders yet" description="Checkout orders will appear here." action={<Button asChild><Link href="/customer">Browse stores</Link></Button>} />
          )}
        </QueryState>
      </div>
    </section>
  );
}

function OrderCard({ order }: { order: OrderSummary }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const items = useMemo(() => parseOrderItems(order.items), [order.items]);
  const storeImageUrl = order.store?.imageUrl || getStoreHeroImage(order.store?.name ?? "Store", order.serviceType);
  const isReorderable = order.status === "DELIVERED" || order.status === "CANCELLED";

  const orderAgainMutation = useMutation({
    mutationFn: async () => {
      // Clear existing cart first, then add items one by one
      await clearCart().catch(() => {/* cart may already be empty */});
      const results: Array<{ name: string; success: boolean }> = [];
      for (const item of items) {
        try {
          await addCartItem({ menuItemId: item.menuItemId, quantity: item.quantity });
          results.push({ name: item.name, success: true });
        } catch {
          results.push({ name: item.name, success: false });
        }
      }
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
      const succeeded = results.filter((r) => r.success);
      const failed = results.filter((r) => !r.success);

      if (succeeded.length > 0 && failed.length === 0) {
        toast({ title: "Items added to cart", description: `${succeeded.length} item${succeeded.length === 1 ? "" : "s"} ready for checkout.`, kind: "success" });
      } else if (succeeded.length > 0 && failed.length > 0) {
        toast({ title: "Some items added", description: `${failed.map((r) => r.name).join(", ")} may no longer be available.`, kind: "info" });
      } else {
        toast({ title: "Could not reorder", description: "These items may no longer be available at this store.", kind: "error" });
      }
    },
    onError: () => {
      toast({ title: "Order Again failed", description: "Please try again or browse the store directly.", kind: "error" });
    },
  });

  const formattedDate = new Date(order.createdAt).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <article className="group overflow-hidden rounded-lg border border-border bg-surface shadow-sm transition hover:border-primary/30 hover:shadow-md">
      {/* Store banner */}
      <div className="relative h-24 bg-surface-muted sm:h-28">
        <Image src={storeImageUrl} alt="" fill sizes="(max-width: 768px) 100vw, 600px" className="object-cover" unoptimized />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" aria-hidden="true" />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-white">{order.store?.name ?? "Store"}</p>
            <p className="mt-0.5 text-xs text-white/70">{formattedDate}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-1.5">
            <StatusPill label={order.status} tone={order.status === "CANCELLED" ? "danger" : order.status === "DELIVERED" ? "success" : "info"} />
            <StatusPill label={order.paymentStatus} tone={order.paymentStatus === "PAID" ? "success" : "warning"} />
          </div>
        </div>
      </div>

      {/* Order items */}
      <div className="p-4">
        {items.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {items.slice(0, 4).map((item, index) => (
              <div key={index} className="flex items-center gap-2.5 rounded-md border border-border bg-surface-muted px-2.5 py-1.5">
                <div className="relative size-8 shrink-0 overflow-hidden rounded">
                  <Image src={item.imageUrl || getProductImage(item.name, order.serviceType)} alt="" fill sizes="32px" className="object-cover" unoptimized />
                </div>
                <span className="text-sm text-foreground">
                  {item.name} <span className="text-muted-foreground">× {item.quantity}</span>
                </span>
              </div>
            ))}
            {items.length > 4 ? (
              <span className="inline-flex items-center rounded-md border border-border bg-surface-muted px-2.5 py-1.5 text-sm text-muted-foreground">
                +{items.length - 4} more
              </span>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Order {order.id.slice(0, 8)}</p>
        )}

        {/* Footer: total + actions */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <div className="flex items-center gap-3 text-sm">
            <span className="font-semibold text-foreground">Rs {Number(order.total).toFixed(0)}</span>
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Clock3 className="size-3.5" aria-hidden="true" /> {formattedDate}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href={`/customer/orders/${order.id}`}>View Details</Link>
            </Button>
            {isReorderable && items.length > 0 ? (
              <Button
                size="sm"
                disabled={orderAgainMutation.isPending}
                onClick={() => orderAgainMutation.mutate()}
                asChild={!orderAgainMutation.isPending && orderAgainMutation.isSuccess}
              >
                {orderAgainMutation.isPending ? (
                  <span className="inline-flex items-center gap-1.5"><RefreshCw className="size-3.5 animate-spin" aria-hidden="true" /> Adding…</span>
                ) : orderAgainMutation.isSuccess ? (
                  <Link href="/cart"><ShoppingBag className="size-3.5" aria-hidden="true" /> View Cart</Link>
                ) : (
                  <span className="inline-flex items-center gap-1.5"><RefreshCw className="size-3.5" aria-hidden="true" /> Order Again</span>
                )}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

type ParsedOrderItem = {
  menuItemId: string;
  name: string;
  quantity: number;
  imageUrl?: string | null;
};

function parseOrderItems(items: unknown): ParsedOrderItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item): item is Record<string, unknown> => item !== null && typeof item === "object")
    .map((item) => ({
      menuItemId: typeof item.menuItemId === "string" ? item.menuItemId : "",
      name: typeof item.name === "string" ? item.name : "Item",
      quantity: typeof item.quantity === "number" ? item.quantity : 1,
      imageUrl: typeof item.imageUrl === "string" ? item.imageUrl : null,
    }))
    .filter((item) => item.menuItemId !== "");
}