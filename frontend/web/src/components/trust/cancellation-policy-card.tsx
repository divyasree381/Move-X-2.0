"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ShieldCheck } from "lucide-react";

import { Skeleton, StatusPill } from "@/components/ui";
import { cancellationPolicy } from "@/lib/api";

export function CancellationPolicyCard({ serviceType }: { serviceType: string }) {
  const policy = useQuery({ queryKey: ["cancellation-policy", serviceType], queryFn: () => cancellationPolicy({ serviceType }), staleTime: 5 * 60_000 });

  if (policy.isLoading) {
    return <Skeleton className="h-28" />;
  }

  if (policy.isError || !policy.data) {
    return (
      <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm">
        <p className="flex items-center gap-2 font-semibold text-foreground"><AlertTriangle className="size-4 text-warning" aria-hidden="true" /> Cancellation rules unavailable</p>
        <p className="mt-1 text-muted-foreground">Fees are still computed server-side from the latest booking state.</p>
      </div>
    );
  }

  return (
    <section className="rounded-md border border-border bg-surface p-3 text-sm" aria-label="Cancellation fee rules">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-semibold text-foreground"><ShieldCheck className="size-4 text-delivery" aria-hidden="true" /> Cancellation windows</p>
        <StatusPill label={policy.data.serviceType} tone="info" />
      </div>
      <div className="mt-3 grid gap-2">
        {policy.data.rules.slice(0, 2).map((rule) => (
          <div key={rule.stage} className="rounded-md border border-border bg-surface-muted p-2">
            <p className="font-medium text-foreground">{rule.stage}: {rule.fee}</p>
            <p className="mt-1 text-xs text-muted-foreground">{rule.window}. {rule.refund}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{policy.data.disclosure}</p>
    </section>
  );
}