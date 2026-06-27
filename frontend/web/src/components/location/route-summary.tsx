"use client";

import { useEffect, useMemo, useState } from "react";
import type { MapTravelMode, RouteSummary as RouteSummaryType, SelectedLocation } from "@movex/shared";

import { getRoute } from "@/lib/api";

type RouteSummaryProps = {
  from: SelectedLocation | null;
  to: SelectedLocation | null;
  mode?: MapTravelMode;
};

export function RouteSummary({ from, to, mode = "DRIVE" }: RouteSummaryProps) {
  const [route, setRoute] = useState<RouteSummaryType | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!from || !to) {
      setRoute(null);
      setStatus("idle");
      return;
    }

    let cancelled = false;
    setStatus("loading");
    setError(null);

    getRoute(from, to, mode)
      .then((result) => {
        if (!cancelled) {
          setRoute(result);
          setStatus("success");
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setRoute(null);
          setStatus("error");
          setError(caught instanceof Error ? caught.message : "Route lookup failed");
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
    return <p className="text-sm text-slate-500">Route unavailable until both locations are set.</p>;
  }

  if (status === "loading") {
    return <p className="text-sm text-slate-500">Calculating route and ETA...</p>;
  }

  if (status === "error") {
    return <p className="text-sm text-red-700">{error}</p>;
  }

  if (!display) {
    return null;
  }

  return (
    <div className="grid gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-4 sm:grid-cols-2">
      <div>
        <p className="text-xs font-medium text-emerald-700">Distance</p>
        <p className="mt-1 text-2xl font-semibold text-slate-950">{display.distance}</p>
      </div>
      <div>
        <p className="text-xs font-medium text-emerald-700">ETA</p>
        <p className="mt-1 text-2xl font-semibold text-slate-950">{display.eta}</p>
      </div>
    </div>
  );
}