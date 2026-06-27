"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3, MapPin } from "lucide-react";

import { Button, EmptyState, Input, StatusPill } from "@/components/ui";
import { acceptRide, arriveRide, completeRide, driverRideQueue, startRide, type RideSummary } from "@/lib/api";

export function RideDriverQueue({ isOnline }: { isOnline: boolean }) {
  const queryClient = useQueryClient();
  const [otpByRide, setOtpByRide] = useState<Record<string, string>>({});
  const queue = useQuery({ queryKey: ["driver-ride-queue"], queryFn: driverRideQueue, refetchInterval: 8_000, enabled: isOnline });
  const acceptMutation = useMutation({ mutationFn: acceptRide, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["driver-ride-queue"] }) });
  const statusMutation = useMutation({
    mutationFn: ({ rideId, action, otp }: { rideId: string; action: "arrive" | "start" | "complete"; otp?: string }) => {
      if (action === "arrive") {
        return arriveRide(rideId);
      }
      if (action === "start") {
        return startRide(rideId, otp ?? "");
      }
      return completeRide(rideId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["driver-ride-queue"] }),
  });
  const items = queue.data?.items ?? [];

  if (!isOnline) {
    return <EmptyState title="Go online for ride offers" description="Ride requests appear after your driver heartbeat starts." />;
  }

  if (items.length === 0) {
    return <EmptyState title="No nearby rides" description="Fresh requests for your selected vehicle will appear here." />;
  }

  return (
    <section className="rounded-md border border-border bg-surface p-4" aria-labelledby="ride-queue-heading">
      <h2 id="ride-queue-heading" className="text-base font-semibold text-foreground">Nearby ride offers</h2>
      <div className="mt-4 grid gap-3">
        {items.map((ride) => (
          <article key={ride.id} className="rounded-md border border-border p-3">
            <RideHeader ride={ride} />
            <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><MapPin className="size-3.5" aria-hidden="true" /> {typeof ride.distanceKmFromDriver === "number" ? `${ride.distanceKmFromDriver.toFixed(1)} km from pickup` : "Distance pending"}</p>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              {!ride.driverId ? (
                <Button size="sm" onClick={() => acceptMutation.mutate(ride.id)} disabled={acceptMutation.isPending}>Accept ride</Button>
              ) : (
                <>
                  <Button size="sm" variant="secondary" disabled={ride.status !== "ASSIGNED" || statusMutation.isPending} onClick={() => statusMutation.mutate({ rideId: ride.id, action: "arrive" })}>Arrived</Button>
                  <label className="block min-w-36 text-sm font-medium text-foreground">
                    Start OTP
                    <Input className="mt-1" value={otpByRide[ride.id] ?? ""} onChange={(event) => setOtpByRide((current) => ({ ...current, [ride.id]: event.target.value }))} placeholder="6 digits" />
                  </label>
                  <Button size="sm" variant="secondary" disabled={ride.status !== "ARRIVED" || statusMutation.isPending} onClick={() => statusMutation.mutate({ rideId: ride.id, action: "start", otp: otpByRide[ride.id] ?? "" })}>Start</Button>
                  <Button size="sm" disabled={ride.status !== "IN_RIDE" || statusMutation.isPending} onClick={() => statusMutation.mutate({ rideId: ride.id, action: "complete" })}>Complete</Button>
                </>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function RideHeader({ ride }: { ride: RideSummary & { distanceKmFromDriver?: number | null } }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-foreground">{ride.vehicleType} ride</p>
        <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="size-3.5" aria-hidden="true" /> {new Date(ride.createdAt).toLocaleString()}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <StatusPill label={ride.status} tone={ride.status === "COMPLETED" ? "success" : "info"} />
        <StatusPill label={`Rs ${Number(ride.estimatedFare).toFixed(0)}`} tone="warning" />
      </div>
    </div>
  );
}