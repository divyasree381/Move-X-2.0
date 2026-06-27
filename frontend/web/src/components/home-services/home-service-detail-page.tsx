"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarClock, Home, Star } from "lucide-react";

import { QueryState } from "@/providers/query-state";
import { OpenDisputePanel } from "@/components/trust";
import { Button, StatusPill } from "@/components/ui";
import { getHomeService, rateHomeService, type RealtimeMessage } from "@/lib/api";
import { useRealtimeTopic } from "@/hooks/use-realtime-topic";
import { RideMap } from "@/components/rides";

const STATUS_STEPS = ["REQUESTED", "ASSIGNED", "ARRIVED", "IN_SERVICE", "COMPLETED"];

export function HomeServiceDetailPage({ bookingId }: { bookingId: string }) {
  const queryClient = useQueryClient();
  const [professionalLocation, setProfessionalLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState("");
  const [rating, setRating] = useState(5);
  const bookingQuery = useQuery({ queryKey: ["home-service", bookingId], queryFn: () => getHomeService(bookingId), refetchInterval: 30_000 });
  const booking = bookingQuery.data;
  const ratingMutation = useMutation({
    mutationFn: () => rateHomeService(bookingId, rating),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["home-service", bookingId] });
      queryClient.invalidateQueries({ queryKey: ["home-services"] });
    },
  });

  const onRealtimeMessage = useCallback(
    (message: RealtimeMessage) => {
      if (message.type === "partner.location.updated") {
        const payload = message.payload as { lat?: unknown; lng?: unknown };
        if (typeof payload.lat === "number" && typeof payload.lng === "number") {
          setProfessionalLocation({ lat: payload.lat, lng: payload.lng });
          setLiveAnnouncement("Professional location updated");
        }
        return;
      }

      if (message.type.startsWith("home-service.")) {
        const payload = message.payload as { status?: unknown };
        if (typeof payload.status === "string") {
          setLiveAnnouncement(`Home-service status updated to ${payload.status}`);
        }
        queryClient.invalidateQueries({ queryKey: ["home-service", bookingId] });
      }
    },
    [bookingId, queryClient],
  );

  useRealtimeTopic(`home-service:${bookingId}`, onRealtimeMessage);

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm"><Link href="/customer/home-services"><ArrowLeft className="size-4" aria-hidden="true" /> Back to home services</Link></Button>
      <p className="sr-only" aria-live="polite">{liveAnnouncement}</p>
      <QueryState isLoading={bookingQuery.isLoading} isError={bookingQuery.isError} error={bookingQuery.error} onRetry={() => bookingQuery.refetch()}>
        {booking ? (
          <div className="grid gap-4 xl:grid-cols-[1fr_20rem]">
            <section className="space-y-4">
              <div className="rounded-md border border-border bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-delivery">Live home service</p>
                    <h2 className="mt-1 text-xl font-semibold text-foreground">{booking.serviceDescription}</h2>
                    <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground"><CalendarClock className="size-4" aria-hidden="true" /> {booking.scheduledFor ? new Date(booking.scheduledFor).toLocaleString() : "Slot pending"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusPill label={booking.status} tone={booking.status === "COMPLETED" ? "success" : booking.status === "CANCELLED" ? "danger" : "info"} />
                    <StatusPill label={booking.paymentStatus} tone={booking.paymentStatus === "PAID" ? "success" : "warning"} />
                  </div>
                </div>
                <HomeServiceTimeline status={booking.status} />
              </div>
              <RideMap ride={booking} driverLocation={professionalLocation} />
            </section>

            <aside className="h-fit rounded-md border border-border bg-surface p-4">
              <div className="flex items-center gap-2 text-base font-semibold text-foreground"><Home className="size-5 text-brand" aria-hidden="true" /> Service bill</div>
              <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                <Row label="Estimated" value={booking.estimatedFare} />
                <Row label="Final" value={booking.finalFare ?? booking.estimatedFare} strong />
                <p>Duration: {booking.durationMinutes ?? "--"} min</p>
              </div>
              <OpenDisputePanel referenceType="HOME_SERVICE" referenceId={booking.id} />
              {booking.status === "COMPLETED" && !booking.rated ? (
                <div className="mt-4 space-y-3">
                  <div className="flex gap-1" role="radiogroup" aria-label="Home-service rating">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button key={value} type="button" aria-pressed={rating === value} onClick={() => setRating(value)} className={value <= rating ? "text-warning" : "text-muted-foreground"}>
                        <Star className="size-5 fill-current" aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                  <Button type="button" className="w-full" disabled={ratingMutation.isPending} onClick={() => ratingMutation.mutate()}>Rate service</Button>
                </div>
              ) : null}
            </aside>
          </div>
        ) : null}
      </QueryState>
    </div>
  );
}

function HomeServiceTimeline({ status }: { status: string }) {
  const currentIndex = Math.max(0, STATUS_STEPS.indexOf(status));
  return (
    <ol className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label="Home-service status timeline">
      {STATUS_STEPS.map((step, index) => {
        const complete = index <= currentIndex;
        return <li key={step} className={complete ? "rounded-md border border-delivery/30 bg-delivery/10 p-3" : "rounded-md border border-border bg-surface-muted p-3"}><span className="text-xs font-medium text-muted-foreground">Step {index + 1}</span><p className="mt-1 text-sm font-semibold text-foreground">{labelForStatus(step)}</p></li>;
      })}
    </ol>
  );
}

function labelForStatus(status: string) {
  const labels: Record<string, string> = { REQUESTED: "Requested", ASSIGNED: "Matched", ARRIVED: "Arrived", IN_SERVICE: "In service", COMPLETED: "Completed", CANCELLED: "Cancelled" };
  return labels[status] ?? status;
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className={strong ? "flex items-center justify-between font-semibold text-foreground" : "flex items-center justify-between text-muted-foreground"}><span>{label}</span><span>Rs {Number(value).toFixed(0)}</span></div>;
}