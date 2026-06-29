"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bike, Clock3, MapPin, ReceiptText } from "lucide-react";

import { QueryState } from "@/providers/query-state";
import { OpenDisputePanel } from "@/components/trust";
import { Button, StatusPill } from "@/components/ui";
import { decideOrderSubstitutions, getOrder, type OrderSummary, type RealtimeMessage } from "@/lib/api";
import { useRealtimeTopic } from "@/hooks/use-realtime-topic";
import { RatingModal } from "./rating-modal";

const STATUS_STEPS = ["PLACED", "ACCEPTED", "PREPARING", "READY", "PICKED_UP", "DELIVERED"];

export function OrderDetailPage({ orderId }: { orderId: string }) {
  const queryClient = useQueryClient();
  const [partnerLocation, setPartnerLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState("");
  const [ratingOpen, setRatingOpen] = useState(false);
  const orderQuery = useQuery({ queryKey: ["order", orderId], queryFn: () => getOrder(orderId), refetchInterval: 30_000 });
  const order = orderQuery.data;

  const onRealtimeMessage = useCallback(
    (message: RealtimeMessage) => {
      if (message.type === "partner.location.updated") {
        const payload = message.payload as { lat?: unknown; lng?: unknown };
        if (typeof payload.lat === "number" && typeof payload.lng === "number") {
          setPartnerLocation({ lat: payload.lat, lng: payload.lng });
          setLiveAnnouncement("Delivery partner location updated");
        }
        return;
      }

      if (message.type.startsWith("order.")) {
        const payload = message.payload as { status?: unknown };
        if (typeof payload.status === "string") {
          setLiveAnnouncement(`Order status updated to ${payload.status}`);
        }
        queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      }
    },
    [orderId, queryClient],
  );

  useRealtimeTopic(`order:${orderId}`, onRealtimeMessage);

  const statusCopy = useMemo(() => statusText(order), [order]);
  const proposedSubstitutions = useMemo(() => proposedSubstitutionsFromItems(order?.items), [order]);
  const substitutionMutation = useMutation({
    mutationFn: ({ menuItemId, decision }: { menuItemId: string; decision: "APPROVED" | "REJECTED" }) => decideOrderSubstitutions(orderId, [{ menuItemId, decision }]),
    onSuccess: () => {
      setLiveAnnouncement("Replacement preference updated");
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
    },
  });

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link href="/customer/orders"><ArrowLeft className="size-4" aria-hidden="true" /> Back to orders</Link>
      </Button>
      <p className="sr-only" aria-live="polite">{liveAnnouncement}</p>
      <QueryState isLoading={orderQuery.isLoading} isError={orderQuery.isError} error={orderQuery.error} onRetry={() => orderQuery.refetch()}>
        {order ? (
          <div className="grid gap-4 xl:grid-cols-[1fr_20rem]">
            <section className="space-y-4">
              <div className="rounded-md border border-border bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">Live order</p>
                    <h2 className="mt-1 text-xl font-semibold text-foreground">{order.store?.name ?? order.storeId}</h2>
                    <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground"><Clock3 className="size-4" aria-hidden="true" /> {statusCopy}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusPill label={order.status} tone={order.status === "DELIVERED" ? "success" : order.status === "CANCELLED" ? "danger" : "info"} />
                    <StatusPill label={order.paymentStatus} tone={order.paymentStatus === "PAID" ? "success" : "warning"} />
                  </div>
                </div>
                <StatusTimeline status={order.status} prepTimeMinutes={order.prepTimeMinutes} />
              </div>

              {proposedSubstitutions.length > 0 ? (
                <section className="rounded-md border border-warning/40 bg-warning/10 p-4" aria-labelledby="substitutions-heading">
                  <h3 id="substitutions-heading" className="text-base font-semibold text-foreground">Review replacements</h3>
                  <div className="mt-3 grid gap-3">
                    {proposedSubstitutions.map((item) => (
                      <div key={item.menuItemId} className="rounded-md border border-border bg-surface p-3">
                        <p className="text-sm font-medium text-foreground">{item.itemName}</p>
                        <p className="mt-1 text-sm text-muted-foreground">Replacement: {item.replacementName} x {item.quantity}{item.priceDelta ? `, price change Rs ${item.priceDelta}` : ""}</p>
                        {item.reason ? <p className="mt-1 text-xs text-muted-foreground">{item.reason}</p> : null}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button size="sm" disabled={substitutionMutation.isPending} onClick={() => substitutionMutation.mutate({ menuItemId: item.menuItemId, decision: "APPROVED" })}>Approve</Button>
                          <Button size="sm" variant="secondary" disabled={substitutionMutation.isPending} onClick={() => substitutionMutation.mutate({ menuItemId: item.menuItemId, decision: "REJECTED" })}>Reject</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              <div className="relative min-h-80 overflow-hidden rounded-md border border-border bg-[linear-gradient(135deg,var(--pharmacy-soft)_0%,var(--background)_48%,var(--food-soft)_100%)] p-4">
                <div className="absolute inset-0 opacity-60" aria-hidden="true" style={{ backgroundImage: "linear-gradient(color-mix(in srgb, var(--info) 18%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--info) 18%, transparent) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
                <div className="relative z-10 flex h-72 items-center justify-center">
                  <div className="absolute left-[18%] top-[62%] rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-sm"><MapPin className="mr-1 inline size-4 text-primary" aria-hidden="true" /> Store</div>
                  <div className="absolute right-[16%] top-[24%] rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-sm"><MapPin className="mr-1 inline size-4 text-success" aria-hidden="true" /> You</div>
                  <div className="absolute h-1 w-[52%] -rotate-12 rounded-full bg-primary/30" aria-hidden="true" />
                  <div className="absolute rounded-full bg-ride p-3 text-primary-foreground shadow-lg transition-all duration-700 ease-out" style={partnerMarkerStyle(partnerLocation)} aria-label="Delivery partner marker">
                    <Bike className="size-5" aria-hidden="true" />
                  </div>
                </div>
              </div>
            </section>

            <aside className="h-fit rounded-md border border-border bg-surface p-4">
              <div className="flex items-center gap-2 text-base font-semibold text-foreground"><ReceiptText className="size-5 text-primary" aria-hidden="true" /> Bill</div>
              <div className="mt-4 space-y-2 text-sm">
                <Row label="Subtotal" value={order.subtotal} />
                <Row label="Delivery" value={order.deliveryFee} />
                <Row label="Discount" value={order.discount} prefix="- " />
                <Row label="Taxes" value={order.taxes} />
                <div className="border-t border-border pt-2"><Row label="Total" value={order.total} strong /></div>
              </div>
              <OpenDisputePanel referenceType="ORDER" referenceId={order.id} />
              {order.status === "DELIVERED" && !order.rated ? <Button type="button" className="mt-4 w-full" onClick={() => setRatingOpen(true)}>Rate order</Button> : null}
            </aside>
            <RatingModal orderId={order.id} open={ratingOpen} onOpenChange={setRatingOpen} />
          </div>
        ) : null}
      </QueryState>
    </div>
  );
}

function StatusTimeline({ status, prepTimeMinutes }: { status: string; prepTimeMinutes: number | null }) {
  const currentIndex = Math.max(0, STATUS_STEPS.indexOf(status));

  return (
    <ol className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-label="Order status timeline">
      {STATUS_STEPS.map((step, index) => {
        const complete = index <= currentIndex;
        return (
          <li key={step} className={complete ? "rounded-md border border-primary/30 bg-primary/10 p-3" : "rounded-md border border-border bg-surface-muted p-3"}>
            <span className="text-xs font-medium text-muted-foreground">Step {index + 1}</span>
            <p className="mt-1 text-sm font-semibold text-foreground">{labelForStatus(step, prepTimeMinutes)}</p>
          </li>
        );
      })}
    </ol>
  );
}

function statusText(order?: OrderSummary): string {
  if (!order) {
    return "Loading status";
  }

  if (order.status === "PREPARING" && order.prepTimeMinutes) {
    return `Preparing - about ${order.prepTimeMinutes} min`;
  }

  return labelForStatus(order.status, order.prepTimeMinutes);
}

function labelForStatus(status: string, prepTimeMinutes?: number | null): string {
  const labels: Record<string, string> = {
    PLACED: "Placed",
    ACCEPTED: "Accepted",
    PREPARING: prepTimeMinutes ? `Preparing - ~${prepTimeMinutes} min` : "Preparing",
    READY: "Ready for pickup",
    PICKED_UP: "On the way",
    DELIVERED: "Delivered",
    CANCELLED: "Cancelled",
  };

  return labels[status] ?? status;
}

function partnerMarkerStyle(location: { lat: number; lng: number } | null) {
  if (!location) {
    return { left: "46%", top: "48%" };
  }

  const left = 30 + Math.abs(location.lng * 1000) % 42;
  const top = 24 + Math.abs(location.lat * 1000) % 46;
  return { left: `${left}%`, top: `${top}%` };
}

function Row({ label, value, prefix = "", strong = false }: { label: string; value: string; prefix?: string; strong?: boolean }) {
  return (
    <div className={strong ? "flex items-center justify-between font-semibold text-foreground" : "flex items-center justify-between text-muted-foreground"}>
      <span>{label}</span>
      <span>{prefix}Rs {Number(value).toFixed(0)}</span>
    </div>
  );
}
type ProposedSubstitution = {
  menuItemId: string;
  itemName: string;
  replacementName: string;
  quantity: number;
  priceDelta: number;
  reason?: string | null;
};

function proposedSubstitutionsFromItems(items: unknown): ProposedSubstitution[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.flatMap((item) => {
    const record = asRecord(item);
    const substitution = asRecord(record.substitution);
    if (substitution.status !== "PROPOSED" || typeof record.menuItemId !== "string" || typeof substitution.replacementName !== "string") {
      return [];
    }

    return [{
      menuItemId: record.menuItemId,
      itemName: typeof record.name === "string" ? record.name : "Ordered item",
      replacementName: substitution.replacementName,
      quantity: typeof substitution.quantity === "number" ? substitution.quantity : Number(record.quantity ?? 1),
      priceDelta: typeof substitution.priceDelta === "number" ? substitution.priceDelta : 0,
      reason: typeof substitution.reason === "string" ? substitution.reason : null,
    }];
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}