"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Clock3, Star } from "lucide-react";

import { QueryState } from "@/providers/query-state";
import { OpenDisputePanel } from "@/components/trust";
import { Button, StatusPill } from "@/components/ui";
import { getRide, rateRide, type RealtimeMessage } from "@/lib/api";
import { useRealtimeTopic } from "@/hooks/use-realtime-topic";
import { RideMap } from "./ride-map";

const RIDE_STEPS = ["REQUESTED", "ASSIGNED", "ARRIVED", "IN_RIDE", "COMPLETED"];

export function RideDetailPage({ rideId }: { rideId: string }) {
  const queryClient = useQueryClient();
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState("");
  const [rating, setRating] = useState(5);
  const rideQuery = useQuery({ queryKey: ["ride", rideId], queryFn: () => getRide(rideId), refetchInterval: 30_000 });
  const ride = rideQuery.data;
  const ratingMutation = useMutation({
    mutationFn: () => rateRide(rideId, rating),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ride", rideId] });
      queryClient.invalidateQueries({ queryKey: ["rides"] });
    },
  });

  const onRealtimeMessage = useCallback(
    (message: RealtimeMessage) => {
      if (message.type === "driver.location.updated") {
        const payload = message.payload as { lat?: unknown; lng?: unknown };
        if (typeof payload.lat === "number" && typeof payload.lng === "number") {
          setDriverLocation({ lat: payload.lat, lng: payload.lng });
          setLiveAnnouncement("Driver location updated");
        }
        return;
      }

      if (message.type.startsWith("ride.")) {
        const payload = message.payload as { status?: unknown };
        if (typeof payload.status === "string") {
          setLiveAnnouncement(`Ride status updated to ${payload.status}`);
        }
        queryClient.invalidateQueries({ queryKey: ["ride", rideId] });
      }
    },
    [queryClient, rideId],
  );

  useRealtimeTopic(`ride:${rideId}`, onRealtimeMessage);

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm"><Link href="/customer/rides"><ArrowLeft className="size-4" aria-hidden="true" /> Back to rides</Link></Button>
      <p className="sr-only" aria-live="polite">{liveAnnouncement}</p>
      <QueryState isLoading={rideQuery.isLoading} isError={rideQuery.isError} error={rideQuery.error} onRetry={() => rideQuery.refetch()}>
        {ride ? (
          <div className="grid gap-4 xl:grid-cols-[1fr_20rem]">
            <section className="space-y-4">
              <div className="rounded-md border border-border bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ride">Live ride</p>
                    <h2 className="mt-1 text-xl font-semibold text-foreground">{ride.vehicleType} to destination</h2>
                    <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground"><Clock3 className="size-4" aria-hidden="true" /> {ride.durationMinutes ?? "--"} min route</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusPill label={ride.status} tone={ride.status === "COMPLETED" ? "success" : ride.status === "CANCELLED" ? "danger" : "info"} />
                    <StatusPill label={ride.paymentStatus} tone={ride.paymentStatus === "PAID" ? "success" : "warning"} />
                  </div>
                </div>
                <RideTimeline status={ride.status} />
              </div>
              <RideMap ride={ride} driverLocation={driverLocation} />
            </section>
            <aside className="h-fit rounded-md border border-border bg-surface p-4">
              <p className="text-base font-semibold text-foreground">Fare</p>
              <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                <Row label="Estimated" value={ride.estimatedFare} />
                <Row label="Final" value={ride.finalFare ?? ride.estimatedFare} strong />
                <Row label="Surge" value={`${ride.surgeMultiplier}x`} raw />
              </div>
              <OpenDisputePanel referenceType="RIDE" referenceId={ride.id} />
              {ride.status === "COMPLETED" && !ride.rated ? (
                <div className="mt-5 space-y-3">
                  <p className="text-sm font-semibold text-foreground">Rate driver</p>
                  <div className="flex gap-1" role="radiogroup" aria-label="Ride rating">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button key={value} type="button" role="radio" aria-checked={rating === value} className="rounded-md p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30" onClick={() => setRating(value)}>
                        <Star className={value <= rating ? "size-6 fill-warning text-warning" : "size-6 text-muted-foreground"} aria-hidden="true" />
                        <span className="sr-only">{value} stars</span>
                      </button>
                    ))}
                  </div>
                  <Button type="button" className="w-full" disabled={ratingMutation.isPending} onClick={() => ratingMutation.mutate()}>Submit rating</Button>
                </div>
              ) : null}
            </aside>
          </div>
        ) : null}
      </QueryState>
    </div>
  );
}

function RideTimeline({ status }: { status: string }) {
  const currentIndex = Math.max(0, RIDE_STEPS.indexOf(status));
  return (
    <ol className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label="Ride status timeline">
      {RIDE_STEPS.map((step, index) => {
        const complete = index <= currentIndex;
        return (
          <li key={step} className={complete ? "rounded-md border border-ride/30 bg-ride/10 p-3" : "rounded-md border border-border bg-surface-muted p-3"}>
            <span className="text-xs font-medium text-muted-foreground">Step {index + 1}</span>
            <p className="mt-1 text-sm font-semibold text-foreground">{step.replace("_", " ")}</p>
          </li>
        );
      })}
    </ol>
  );
}

function Row({ label, value, strong = false, raw = false }: { label: string; value: string; strong?: boolean; raw?: boolean }) {
  return (
    <div className={strong ? "flex justify-between font-semibold text-foreground" : "flex justify-between"}>
      <span>{label}</span>
      <span>{raw ? value : `Rs ${Number(value).toFixed(0)}`}</span>
    </div>
  );
}