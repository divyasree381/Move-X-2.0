"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Home, MapPin } from "lucide-react";

import { Button, EmptyState, Input, StatusPill } from "@/components/ui";
import { acceptHomeService, arriveHomeService, completeHomeService, professionalHomeServiceQueue, startHomeService, type HomeServiceQueueItem } from "@/lib/api";

export function HomeServiceProfessionalQueue({ isOnline }: { isOnline: boolean }) {
  const queryClient = useQueryClient();
  const [otpByBooking, setOtpByBooking] = useState<Record<string, string>>({});
  const queue = useQuery({ queryKey: ["professional-home-service-queue"], queryFn: professionalHomeServiceQueue, refetchInterval: 8_000, enabled: isOnline });
  const acceptMutation = useMutation({ mutationFn: acceptHomeService, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["professional-home-service-queue"] }) });
  const statusMutation = useMutation({
    mutationFn: ({ bookingId, action, otp }: { bookingId: string; action: "arrive" | "start" | "complete"; otp?: string }) => {
      if (action === "arrive") {
        return arriveHomeService(bookingId);
      }
      if (action === "start") {
        return startHomeService(bookingId, otp ?? "");
      }
      return completeHomeService(bookingId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["professional-home-service-queue"] }),
  });
  const items = queue.data?.items ?? [];

  if (!isOnline) {
    return <EmptyState title="Go online for home-service jobs" description="Scheduled service requests appear after your live location heartbeat starts." />;
  }

  if (items.length === 0) {
    return <EmptyState title="No nearby service jobs" description="Fresh scheduled requests near you will appear here." />;
  }

  return (
    <section className="rounded-md border border-border bg-surface p-4" aria-labelledby="home-service-queue-heading">
      <h2 id="home-service-queue-heading" className="text-base font-semibold text-foreground">Nearby home-service jobs</h2>
      <div className="mt-4 grid gap-3">
        {items.map((booking) => (
          <article key={booking.id} className="rounded-md border border-border p-3">
            <BookingHeader booking={booking} />
            <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><MapPin className="size-3.5" aria-hidden="true" /> {booking.distanceKm !== undefined ? `${Number(booking.distanceKm).toFixed(1)} km away` : "Distance pending"}</p>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              {!booking.professionalId ? (
                <Button size="sm" onClick={() => acceptMutation.mutate(booking.id)} disabled={acceptMutation.isPending}>Accept service</Button>
              ) : (
                <>
                  <Button size="sm" variant="secondary" disabled={booking.status !== "ASSIGNED" || statusMutation.isPending} onClick={() => statusMutation.mutate({ bookingId: booking.id, action: "arrive" })}>Arrived</Button>
                  <label className="block min-w-36 text-sm font-medium text-foreground">
                    Start OTP
                    <Input className="mt-1" value={otpByBooking[booking.id] ?? ""} onChange={(event) => setOtpByBooking((current) => ({ ...current, [booking.id]: event.target.value }))} placeholder="6 digits" />
                  </label>
                  <Button size="sm" variant="secondary" disabled={booking.status !== "ARRIVED" || statusMutation.isPending} onClick={() => statusMutation.mutate({ bookingId: booking.id, action: "start", otp: otpByBooking[booking.id] ?? "" })}>Start</Button>
                  <Button size="sm" disabled={booking.status !== "IN_SERVICE" || statusMutation.isPending} onClick={() => statusMutation.mutate({ bookingId: booking.id, action: "complete" })}>Complete</Button>
                </>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function BookingHeader({ booking }: { booking: HomeServiceQueueItem }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><Home className="size-4 text-brand" aria-hidden="true" /> {booking.serviceDescription}</p>
        <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><CalendarClock className="size-3.5" aria-hidden="true" /> {booking.scheduledFor ? new Date(booking.scheduledFor).toLocaleString() : "Slot pending"}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <StatusPill label={booking.status} tone={booking.status === "COMPLETED" ? "success" : "info"} />
        <StatusPill label={`Rs ${Number(booking.estimatedFare).toFixed(0)}`} tone="warning" />
      </div>
    </div>
  );
}