"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Clock3, ReceiptText } from "lucide-react";

import { QueryState } from "@/providers/query-state";
import { Button, EmptyState, StatusPill } from "@/components/ui";
import { listOrders } from "@/lib/api";

export function OrderHistoryPage() {
  const ordersQuery = useQuery({ queryKey: ["orders"], queryFn: () => listOrders({ limit: 20 }) });
  const orders = ordersQuery.data?.items ?? [];

  return (
    <section className="rounded-md border border-border bg-surface p-4" aria-labelledby="orders-heading">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="orders-heading" className="text-base font-semibold text-foreground">Orders</h2>
          <p className="mt-1 text-sm text-muted-foreground">Track delivery orders and payment state.</p>
        </div>
        <ReceiptText className="size-5 text-brand" aria-hidden="true" />
      </div>
      <div className="mt-4">
        <QueryState isLoading={ordersQuery.isLoading} isError={ordersQuery.isError} error={ordersQuery.error} onRetry={() => ordersQuery.refetch()}>
          {orders.length > 0 ? (
            <div className="grid gap-3">
              {orders.map((order) => (
                <Link key={order.id} href={`/customer/orders/${order.id}`} className="rounded-md border border-border p-3 transition hover:border-brand/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{order.store?.name ?? "Store"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Order {order.id}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusPill label={order.status} tone={order.status === "CANCELLED" ? "danger" : order.status === "DELIVERED" ? "success" : "info"} />
                      <StatusPill label={order.paymentStatus} tone={order.paymentStatus === "PAID" ? "success" : "warning"} />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Clock3 className="size-4" aria-hidden="true" /> {new Date(order.createdAt).toLocaleString()}</span>
                    <span className="font-semibold text-foreground">Rs {Number(order.total).toFixed(0)}</span>
                  </div>
                </Link>
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