"use client";

import { useEffect, useState, type ReactNode } from "react";
import { UserRole } from "@movex/shared";
import { useMutation } from "@tanstack/react-query";
import { LocateFixed, Power, RadioTower } from "lucide-react";

import { PartnerOrderQueue } from "@/components/orders";
import { PartnerOpsPanel } from "@/components/partner";
import { RideDriverQueue } from "@/components/rides";
import { setPartnerOnline, writePartnerLocation } from "@/lib/api";
import { Button, StatusPill } from "@/components/ui";
import { navForRole, partnerNav } from "./shell-nav";

export function PartnerShell({ children, role = UserRole.DELIVERY }: { children?: ReactNode | ((state: { isOnline: boolean }) => ReactNode); role?: UserRole.RESTAURANT | UserRole.DELIVERY | UserRole.DRIVER }) {
  const [isOnline, setIsOnline] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [vehicleType, setVehicleType] = useState<"BIKE" | "AUTO" | "CAB">("BIKE");
  const nav = navForRole(role, partnerNav);
  const onlineMutation = useMutation({
    mutationFn: setPartnerOnline,
    onSuccess: (_result, nextOnline) => setIsOnline(nextOnline),
  });
  const { mutate: writeLocationHeartbeat } = useMutation({ mutationFn: ({ lat, lng }: { lat: number; lng: number }) => writePartnerLocation(lat, lng, role === UserRole.DRIVER ? vehicleType : undefined) });

  useEffect(() => {
    if (!isOnline || !("geolocation" in navigator)) {
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const next = { lat: position.coords.latitude, lng: position.coords.longitude };
        setCoords(next);
        setLocationError(null);
        writeLocationHeartbeat(next);
      },
      () => {
        setCoords(null);
        setLocationError("Location heartbeat paused");
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isOnline, role, vehicleType, writeLocationHeartbeat]);

  return (
    <div className="min-h-screen bg-surface-muted text-foreground">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-delivery">MoveX Partner</p>
            <h1 className="text-xl font-semibold">Queue Control</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill label={isOnline ? "Online" : "Offline"} tone={isOnline ? "success" : "warning"} />
            <Button type="button" variant={isOnline ? "secondary" : "primary"} disabled={onlineMutation.isPending} onClick={() => onlineMutation.mutate(!isOnline)}>
              <Power className="size-4" aria-hidden={true} />
              {isOnline ? "Go offline" : "Go online"}
            </Button>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-5 lg:grid-cols-[14rem_1fr]">
        <nav className="rounded-md border border-border bg-surface p-2" aria-label="Partner navigation">
          {nav.map((item) => (
            <a key={item.href} href={item.href} className="flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
              <item.icon className="size-4" aria-hidden={true} />
              {item.label}
            </a>
          ))}
        </nav>
        <main className="space-y-4">
          <section className="grid gap-3 rounded-md border border-border bg-surface p-4 md:grid-cols-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Queue</p>
              <p className="mt-1 text-2xl font-semibold">Live</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Heartbeat</p>
              <p className="mt-1 flex items-center gap-2 text-sm font-semibold"><RadioTower className="size-4 text-delivery" aria-hidden={true} /> {isOnline ? "Active" : "Paused"}</p>
            </div>
            {role === UserRole.DRIVER ? (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Vehicle</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(["BIKE", "AUTO", "CAB"] as const).map((option) => (
                    <button key={option} type="button" aria-pressed={vehicleType === option} onClick={() => setVehicleType(option)} className={vehicleType === option ? "rounded-md border border-ride bg-ride/10 px-2 py-1 text-xs font-semibold text-ride" : "rounded-md border border-border bg-surface px-2 py-1 text-xs font-semibold text-muted-foreground"}>
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div>
              <p className="text-xs font-medium text-muted-foreground">Live Location</p>
              <p className="mt-1 flex items-center gap-2 text-sm font-semibold"><LocateFixed className="size-4 text-delivery" aria-hidden={true} /> {coords ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : locationError ?? "Waiting"}</p>
            </div>
          </section>
          <PartnerOpsPanel isOnline={isOnline} />
          {typeof children === "function" ? children({ isOnline }) : children ?? (role === UserRole.DRIVER ? <RideDriverQueue isOnline={isOnline} /> : <PartnerOrderQueue role={role} isOnline={isOnline} />)}
        </main>
      </div>
    </div>
  );
}