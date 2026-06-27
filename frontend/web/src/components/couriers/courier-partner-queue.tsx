"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3, MapPin, PackageCheck } from "lucide-react";

import { Button, EmptyState, Input, StatusPill } from "@/components/ui";
import { acceptCourier, arriveCourier, deliverCourier, deliveryCourierQueue, pickupCourier, type CourierQueueItem } from "@/lib/api";

export function CourierPartnerQueue({ isOnline }: { isOnline: boolean }) {
  const queryClient = useQueryClient();
  const [otpByCourier, setOtpByCourier] = useState<Record<string, string>>({});
  const queue = useQuery({ queryKey: ["delivery-courier-queue"], queryFn: deliveryCourierQueue, refetchInterval: 8_000, enabled: isOnline });
  const acceptMutation = useMutation({ mutationFn: acceptCourier, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["delivery-courier-queue"] }) });
  const statusMutation = useMutation({
    mutationFn: ({ courierId, action, otp }: { courierId: string; action: "arrive" | "pickup" | "deliver"; otp?: string }) => {
      if (action === "arrive") {
        return arriveCourier(courierId);
      }
      if (action === "pickup") {
        return pickupCourier(courierId, otp ?? "");
      }
      return deliverCourier(courierId, otp ?? "");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["delivery-courier-queue"] }),
  });
  const items = queue.data?.items ?? [];

  if (!isOnline) {
    return <EmptyState title="Go online for courier jobs" description="Courier pickups appear after your live location heartbeat starts." />;
  }

  if (items.length === 0) {
    return <EmptyState title="No nearby courier jobs" description="Fresh parcel requests near you will appear here." />;
  }

  return (
    <section className="rounded-md border border-border bg-surface p-4" aria-labelledby="courier-queue-heading">
      <h2 id="courier-queue-heading" className="text-base font-semibold text-foreground">Nearby courier jobs</h2>
      <div className="mt-4 grid gap-3">
        {items.map((courier) => (
          <article key={courier.id} className="rounded-md border border-border p-3">
            <CourierHeader courier={courier} />
            <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><MapPin className="size-3.5" aria-hidden="true" /> {courier.distanceKm !== undefined ? `${Number(courier.distanceKm).toFixed(1)} km from pickup` : "Distance pending"}</p>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              {!courier.deliveryPartnerId ? (
                <Button size="sm" onClick={() => acceptMutation.mutate(courier.id)} disabled={acceptMutation.isPending}>Accept courier</Button>
              ) : (
                <>
                  <Button size="sm" variant="secondary" disabled={courier.status !== "ASSIGNED" || statusMutation.isPending} onClick={() => statusMutation.mutate({ courierId: courier.id, action: "arrive" })}>Arrived</Button>
                  <label className="block min-w-36 text-sm font-medium text-foreground">
                    OTP
                    <Input className="mt-1" value={otpByCourier[courier.id] ?? ""} onChange={(event) => setOtpByCourier((current) => ({ ...current, [courier.id]: event.target.value }))} placeholder="6 digits" />
                  </label>
                  <Button size="sm" variant="secondary" disabled={courier.status !== "ARRIVED" || statusMutation.isPending} onClick={() => statusMutation.mutate({ courierId: courier.id, action: "pickup", otp: otpByCourier[courier.id] ?? "" })}>Verify pickup</Button>
                  <Button size="sm" disabled={courier.status !== "IN_TRANSIT" || statusMutation.isPending} onClick={() => statusMutation.mutate({ courierId: courier.id, action: "deliver", otp: otpByCourier[courier.id] ?? "" })}>Verify delivery</Button>
                </>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function CourierHeader({ courier }: { courier: CourierQueueItem }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><PackageCheck className="size-4 text-brand" aria-hidden="true" /> {courier.packageDescription}</p>
        <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="size-3.5" aria-hidden="true" /> {new Date(courier.createdAt).toLocaleString()}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <StatusPill label={courier.status} tone={courier.status === "COMPLETED" ? "success" : "info"} />
        <StatusPill label={`Rs ${Number(courier.estimatedFare).toFixed(0)}`} tone="warning" />
      </div>
    </div>
  );
}