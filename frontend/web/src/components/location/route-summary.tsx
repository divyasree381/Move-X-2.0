"use client";

import { useEffect, useMemo, useState } from "react";
import type { MapTravelMode, RouteSummary as RouteSummaryType, SelectedLocation } from "@movex/shared";
import { AlertCircle, Clock3, Route, type LucideIcon } from "lucide-react";

import { getRoute } from "@/lib/api";

type RouteSummaryProps = {
  from: SelectedLocation | null;
  to: SelectedLocation | null;
  mode?: MapTravelMode;
};

export function RouteSummary({ from, to, mode = "DRIVE" }: RouteSummaryProps) {
  const [route, setRoute] = useState<RouteSummaryType | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">("idle");

  useEffect(() => {
    if (!from || !to) {
      setRoute(null);
      setStatus("idle");
      return;
    }

    let cancelled = false;
    setStatus("loading");

    getRoute(from, to, mode)
      .then((result) => {
        if (!cancelled) {
          setRoute(result);
          setStatus("success");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRoute(null);
          setStatus("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [from, mode, to]);

  const display = useMemo(() => {
    if (!route) {
      return null;
    }

    return {
      distance: `${(route.distanceMeters / 1000).toFixed(route.distanceMeters > 10_000 ? 0 : 1)} km`,
      eta: `${Math.max(1, Math.round(route.durationSeconds / 60))} min`,
    };
  }, [route]);

  if (!from || !to) {
    return <RouteState icon={Route} title="Set both locations" description="Pickup and drop are needed before MoveX can preview distance and ETA." />;
  }

  if (status === "loading") {
    return <RouteState icon={Clock3} title="Calculating route" description="Checking distance, ETA, and the best service path." pulse />;
  }

  if (status === "error") {
    return <RouteState icon={AlertCircle} title="Route preview unavailable" description="You can still continue with typed addresses. ETA will refresh when maps are available." tone="warning" />;
  }

  if (!display) {
    return null;
  }

  return (
    <div className="grid gap-3 rounded-lg border border-primary/20 bg-primary/10 p-4 sm:grid-cols-2">
      <div>
        <p className="flex items-center gap-2 text-xs font-medium text-primary"><Route className="size-4" aria-hidden={true} /> Distance</p>
        <p className="mt-2 text-2xl font-semibold text-foreground">{display.distance}</p>
      </div>
      <div>
        <p className="flex items-center gap-2 text-xs font-medium text-primary"><Clock3 className="size-4" aria-hidden={true} /> ETA</p>
        <p className="mt-2 text-2xl font-semibold text-foreground">{display.eta}</p>
      </div>
    </div>
  );
}

function RouteState({ icon: Icon, title, description, tone = "muted", pulse = false }: { icon: LucideIcon; title: string; description: string; tone?: "muted" | "warning"; pulse?: boolean }) {
  return (
    <div className={tone === "warning" ? "rounded-lg border border-warning/30 bg-warning/10 p-4 text-warning" : "rounded-lg border border-border bg-surface-muted p-4 text-muted-foreground"}>
      <div className="flex items-start gap-3">
        <span className={pulse ? "mt-0.5 flex size-9 animate-pulse items-center justify-center rounded-md bg-primary/10 text-primary" : "mt-0.5 flex size-9 items-center justify-center rounded-md bg-background text-current"}>
          <Icon className="size-4" aria-hidden={true} />
        </span>
        <div>
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="mt-1 text-sm leading-6">{description}</p>
        </div>
      </div>
    </div>
  );
}

