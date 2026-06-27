"use client";

import { useState } from "react";
import { UserRole } from "@movex/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3 } from "lucide-react";

import { Button, EmptyState, Input, StatusPill } from "@/components/ui";
import {
  acceptDeliveryOrder,
  acceptStoreOrder,
  deliverOrder,
  deliveryOrderQueue,
  pickupOrder,
  prepareStoreOrder,
  readyStoreOrder,
  storeOrderQueue,
  verifyOrderPrescription,
  type OrderSummary,
} from "@/lib/api";

export function PartnerOrderQueue({ role, isOnline }: { role: UserRole.RESTAURANT | UserRole.DELIVERY | UserRole.DRIVER; isOnline: boolean }) {
  if (role === UserRole.RESTAURANT) {
    return <StoreQueue />;
  }

  return <DeliveryQueue isOnline={isOnline} />;
}

function StoreQueue() {
  const queryClient = useQueryClient();
  const queue = useQuery({ queryKey: ["store-order-queue"], queryFn: storeOrderQueue, refetchInterval: 15_000 });
  const verifyPrescription = useMutation({ mutationFn: (orderId: string) => verifyOrderPrescription(orderId, "VERIFIED"), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["store-order-queue"] }) });
  const mutation = useMutation({
    mutationFn: ({ orderId, action }: { orderId: string; action: "accept" | "prepare" | "ready" }) => {
      if (action === "accept") {
        return acceptStoreOrder(orderId, 12);
      }
      if (action === "prepare") {
        return prepareStoreOrder(orderId, 8);
      }
      return readyStoreOrder(orderId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["store-order-queue"] }),
  });

  const items = queue.data?.items ?? [];

  if (items.length === 0) {
    return <EmptyState title="Store queue is clear" description="Placed orders will appear here for acceptance and preparation." />;
  }

  return (
    <section className="rounded-md border border-border bg-surface p-4" aria-labelledby="store-queue-heading">
      <h2 id="store-queue-heading" className="text-base font-semibold text-foreground">Store queue</h2>
      <div className="mt-4 grid gap-3">
        {items.map((order) => (
          <article key={order.id} className="rounded-md border border-border p-3">
            <OrderHeader order={order} />
            <div className="mt-3 flex flex-wrap gap-2">
              {order.serviceType === "PHARMACY" && order.status === "PLACED" ? (
                <Button size="sm" variant="secondary" disabled={verifyPrescription.isPending || prescriptionStatus(order) === "VERIFIED"} onClick={() => verifyPrescription.mutate(order.id)}>Verify prescription</Button>
              ) : null}
              <Button size="sm" variant="secondary" disabled={order.status !== "PLACED" || mutation.isPending || (order.serviceType === "PHARMACY" && prescriptionStatus(order) !== "VERIFIED")} onClick={() => mutation.mutate({ orderId: order.id, action: "accept" })}>Accept</Button>
              <Button size="sm" variant="secondary" disabled={order.status !== "ACCEPTED" || mutation.isPending} onClick={() => mutation.mutate({ orderId: order.id, action: "prepare" })}>Preparing</Button>
              <Button size="sm" disabled={order.status !== "PREPARING" || mutation.isPending} onClick={() => mutation.mutate({ orderId: order.id, action: "ready" })}>Ready</Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function DeliveryQueue({ isOnline }: { isOnline: boolean }) {
  const queryClient = useQueryClient();
  const [otpByOrder, setOtpByOrder] = useState<Record<string, string>>({});
  const queue = useQuery({ queryKey: ["delivery-order-queue"], queryFn: deliveryOrderQueue, refetchInterval: 12_000, enabled: isOnline });
  const acceptMutation = useMutation({ mutationFn: acceptDeliveryOrder, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["delivery-order-queue"] }) });
  const statusMutation = useMutation({
    mutationFn: ({ orderId, action, otp }: { orderId: string; action: "pickup" | "deliver"; otp: string }) => (action === "pickup" ? pickupOrder(orderId, otp) : deliverOrder(orderId, otp)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["delivery-order-queue"] }),
  });
  const items = queue.data?.items ?? [];

  if (!isOnline) {
    return <EmptyState title="Go online for jobs" description="Delivery jobs appear after your live location heartbeat starts." />;
  }

  if (items.length === 0) {
    return <EmptyState title="No nearby jobs" description="Ready orders near your live location will appear here." />;
  }

  return (
    <section className="rounded-md border border-border bg-surface p-4" aria-labelledby="delivery-queue-heading">
      <h2 id="delivery-queue-heading" className="text-base font-semibold text-foreground">Nearby delivery jobs</h2>
      <div className="mt-4 grid gap-3">
        {items.map((order) => (
          <article key={order.id} className="rounded-md border border-border p-3">
            <OrderHeader order={order} />
            <p className="mt-2 text-xs text-muted-foreground">{order.distanceKm !== undefined ? `${order.distanceKm.toFixed(1)} km away` : "Distance pending"}</p>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              {!order.deliveryPartnerId ? (
                <Button size="sm" onClick={() => acceptMutation.mutate(order.id)} disabled={acceptMutation.isPending}>Accept job</Button>
              ) : (
                <>
                  <label className="block min-w-36 text-sm font-medium text-foreground">
                    OTP
                    <Input className="mt-1" value={otpByOrder[order.id] ?? ""} onChange={(event) => setOtpByOrder((current) => ({ ...current, [order.id]: event.target.value }))} placeholder="6 digits" />
                  </label>
                  <Button size="sm" variant="secondary" disabled={order.status !== "READY" || statusMutation.isPending} onClick={() => statusMutation.mutate({ orderId: order.id, action: "pickup", otp: otpByOrder[order.id] ?? "" })}>Verify pickup</Button>
                  <Button size="sm" disabled={order.status !== "PICKED_UP" || statusMutation.isPending} onClick={() => statusMutation.mutate({ orderId: order.id, action: "deliver", otp: otpByOrder[order.id] ?? "" })}>Verify delivery</Button>
                </>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function OrderHeader({ order }: { order: OrderSummary & { distanceKm?: number; deliveryPartnerId?: string | null } }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-foreground">{order.store?.name ?? order.storeId}</p>
        <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="size-3.5" aria-hidden="true" /> {new Date(order.createdAt).toLocaleString()}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <StatusPill label={order.status} tone={order.status === "DELIVERED" ? "success" : "info"} />
        <StatusPill label={`Rs ${Number(order.total).toFixed(0)}`} tone="warning" />
      </div>
    </div>
  );
}
function prescriptionStatus(order: OrderSummary): string | null {
  if (!order.address || typeof order.address !== "object" || Array.isArray(order.address)) {
    return null;
  }
  const prescription = (order.address as { prescription?: unknown }).prescription;
  if (!prescription || typeof prescription !== "object" || Array.isArray(prescription)) {
    return null;
  }
  const status = (prescription as { status?: unknown }).status;
  return typeof status === "string" ? status : null;
}