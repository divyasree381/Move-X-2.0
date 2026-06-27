"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Clock3, PackageCheck, Star } from "lucide-react";

import { QueryState } from "@/providers/query-state";
import { OpenDisputePanel } from "@/components/trust";
import { Button, StatusPill } from "@/components/ui";
import { getCourier, rateCourier, type RealtimeMessage } from "@/lib/api";
import { useRealtimeTopic } from "@/hooks/use-realtime-topic";
import { RideMap } from "@/components/rides";

const STATUS_STEPS = ["REQUESTED", "ASSIGNED", "ARRIVED", "IN_TRANSIT", "COMPLETED"];

export function CourierDetailPage({ courierId }: { courierId: string }) {
  const queryClient = useQueryClient();
  const [partnerLocation, setPartnerLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState("");
  const [rating, setRating] = useState(5);
  const courierQuery = useQuery({ queryKey: ["courier", courierId], queryFn: () => getCourier(courierId), refetchInterval: 30_000 });
  const courier = courierQuery.data;
  const ratingMutation = useMutation({
    mutationFn: () => rateCourier(courierId, rating),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courier", courierId] });
      queryClient.invalidateQueries({ queryKey: ["couriers"] });
    },
  });

  const onRealtimeMessage = useCallback(
    (message: RealtimeMessage) => {
      if (message.type === "partner.location.updated") {
        const payload = message.payload as { lat?: unknown; lng?: unknown };
        if (typeof payload.lat === "number" && typeof payload.lng === "number") {
          setPartnerLocation({ lat: payload.lat, lng: payload.lng });
          setLiveAnnouncement("Courier partner location updated");
        }
        return;
      }

      if (message.type.startsWith("courier.")) {
        const payload = message.payload as { status?: unknown };
        if (typeof payload.status === "string") {
          setLiveAnnouncement(`Courier status updated to ${payload.status}`);
        }
        queryClient.invalidateQueries({ queryKey: ["courier", courierId] });
      }
    },
    [courierId, queryClient],
  );

  useRealtimeTopic(`courier:${courierId}`, onRealtimeMessage);

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm"><Link href="/customer/couriers"><ArrowLeft className="size-4" aria-hidden="true" /> Back to courier</Link></Button>
      <p className="sr-only" aria-live="polite">{liveAnnouncement}</p>
      <QueryState isLoading={courierQuery.isLoading} isError={courierQuery.isError} error={courierQuery.error} onRetry={() => courierQuery.refetch()}>
        {courier ? (
          <div className="grid gap-4 xl:grid-cols-[1fr_20rem]">
            <section className="space-y-4">
              <div className="rounded-md border border-border bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ride">Live courier</p>
                    <h2 className="mt-1 text-xl font-semibold text-foreground">{courier.packageDescription}</h2>
                    <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground"><Clock3 className="size-4" aria-hidden="true" /> {courier.distanceKm ?? "--"} km parcel route</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusPill label={courier.status} tone={courier.status === "COMPLETED" ? "success" : courier.status === "CANCELLED" ? "danger" : "info"} />
                    <StatusPill label={courier.paymentStatus} tone={courier.paymentStatus === "PAID" ? "success" : "warning"} />
                  </div>
                </div>
                <CourierTimeline status={courier.status} />
              </div>
              <RideMap ride={courier} driverLocation={partnerLocation} />
            </section>

            <aside className="h-fit rounded-md border border-border bg-surface p-4">
              <div className="flex items-center gap-2 text-base font-semibold text-foreground"><PackageCheck className="size-5 text-brand" aria-hidden="true" /> Courier bill</div>
              <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                <Row label="Estimated" value={courier.estimatedFare} />
                <Row label="Final" value={courier.finalFare ?? courier.estimatedFare} strong />
                {courier.packageWeightKg ? <p>Weight: {courier.packageWeightKg} kg</p> : null}
              </div>
              <OpenDisputePanel referenceType="COURIER" referenceId={courier.id} />
              {courier.status === "COMPLETED" && !courier.rated ? (
                <div className="mt-4 space-y-3">
                  <div className="flex gap-1" role="radiogroup" aria-label="Courier rating">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button key={value} type="button" aria-pressed={rating === value} onClick={() => setRating(value)} className={value <= rating ? "text-warning" : "text-muted-foreground"}>
                        <Star className="size-5 fill-current" aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                  <Button type="button" className="w-full" disabled={ratingMutation.isPending} onClick={() => ratingMutation.mutate()}>Rate courier</Button>
                </div>
              ) : null}
            </aside>
          </div>
        ) : null}
      </QueryState>
    </div>
  );
}

function CourierTimeline({ status }: { status: string }) {
  const currentIndex = Math.max(0, STATUS_STEPS.indexOf(status));
  return (
    <ol className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label="Courier status timeline">
      {STATUS_STEPS.map((step, index) => {
        const complete = index <= currentIndex;
        return (
          <li key={step} className={complete ? "rounded-md border border-ride/30 bg-ride/10 p-3" : "rounded-md border border-border bg-surface-muted p-3"}>
            <span className="text-xs font-medium text-muted-foreground">Step {index + 1}</span>
            <p className="mt-1 text-sm font-semibold text-foreground">{labelForStatus(step)}</p>
          </li>
        );
      })}
    </ol>
  );
}

function labelForStatus(status: string) {
  const labels: Record<string, string> = {
    REQUESTED: "Requested",
    ASSIGNED: "Matched",
    ARRIVED: "At pickup",
    IN_TRANSIT: "Picked up",
    COMPLETED: "Delivered",
    CANCELLED: "Cancelled",
  };
  return labels[status] ?? status;
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className={strong ? "flex items-center justify-between font-semibold text-foreground" : "flex items-center justify-between text-muted-foreground"}><span>{label}</span><span>Rs {Number(value).toFixed(0)}</span></div>;
}