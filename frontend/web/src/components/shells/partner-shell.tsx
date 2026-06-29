"use client";

import Link from "next/link";
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
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-lg bg-primary-foreground text-lg font-black text-primary shadow-sm">M</span>
            <div>
              <p className="text-sm font-semibold text-primary-foreground">MoveX Partner</p>
              <h1 className="text-2xl font-black tracking-normal">Queue Control</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill label={isOnline ? "Online" : "Offline"} tone={isOnline ? "success" : "warning"} className="border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground" />
            <Button type="button" variant={isOnline ? "secondary" : "primary"} disabled={onlineMutation.isPending} onClick={() => onlineMutation.mutate(!isOnline)}>
              <Power className="size-4" aria-hidden={true} />
              {isOnline ? "Go offline" : "Go online"}
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 lg:grid-cols-[13rem_1fr]">
        <aside className="hidden lg:block">
          <nav className="sticky top-5 rounded-lg border border-border bg-surface p-2 shadow-sm" aria-label="Partner navigation">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className="flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold text-muted-foreground hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
                <item.icon className="size-4" aria-hidden={true} />
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="space-y-5">
          <section className="grid gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm md:grid-cols-4">
            <Metric label="Queue" value="Live" />
            <Metric icon={RadioTower} label="Heartbeat" value={isOnline ? "Active" : "Paused"} accent="text-primary" />
            {role === UserRole.DRIVER ? (
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Vehicle</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(["BIKE", "AUTO", "CAB"] as const).map((option) => (
                    <button key={option} type="button" aria-pressed={vehicleType === option} onClick={() => setVehicleType(option)} className={vehicleType === option ? "rounded-md border border-ride bg-ride/10 px-2 py-1 text-xs font-black text-ride" : "rounded-md border border-border bg-surface px-2 py-1 text-xs font-black text-muted-foreground"}>
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <Metric icon={LocateFixed} label="Live location" value={coords ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : locationError ?? "Waiting"} accent="text-primary" />
          </section>
          <PartnerOpsPanel isOnline={isOnline} />
          {typeof children === "function" ? children({ isOnline }) : children ?? (role === UserRole.DRIVER ? <RideDriverQueue isOnline={isOnline} /> : <PartnerOrderQueue role={role} isOnline={isOnline} />)}
        </main>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, accent = "text-primary" }: { icon?: typeof RadioTower; label: string; value: string; accent?: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-2 flex items-center gap-2 text-sm font-black text-foreground">
        {Icon ? <Icon className={`size-4 ${accent}`} aria-hidden={true} /> : null}
        {value}
      </p>
    </div>
  );
}