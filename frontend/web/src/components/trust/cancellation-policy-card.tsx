"use client";

import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";

import { Skeleton, StatusPill } from "@/components/ui";
import { cancellationPolicy } from "@/lib/api";

export function CancellationPolicyCard({ serviceType }: { serviceType: string }) {
  const policy = useQuery({ queryKey: ["cancellation-policy", serviceType], queryFn: () => cancellationPolicy({ serviceType }), staleTime: 5 * 60_000, retry: false,
  });

  if (policy.isLoading) {
    return <Skeleton className="h-28" />;
  }

  if (policy.isError || !policy.data) {
    return (
      <section
        className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm"
        aria-label="Cancellation terms unavailable"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 font-semibold text-foreground">
            <ShieldCheck className="size-4 text-warning" aria-hidden="true" /> Cancellation terms
          </p>
          <StatusPill label="Temporarily unavailable" tone="warning" />
        </div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          We could not load the latest cancellation terms. Review any fee shown before confirming a
          cancellation, or contact support for help.
        </p>
      </section>
    );
  }

  const policyData = policy.data;

  return (
    <section className="rounded-md border border-border bg-surface p-3 text-sm" aria-label="Cancellation fee rules">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-semibold text-foreground"><ShieldCheck className="size-4 text-delivery" aria-hidden="true" /> Cancellation windows</p>
        <div className="flex flex-wrap gap-2">
          <StatusPill label={policyData.serviceType} tone="info" />
        </div>
      </div>
      <div className="mt-3 grid gap-2">
        {policyData.rules.slice(0, 3).map((rule) => (
          <div key={rule.stage} className="rounded-md border border-border bg-surface-muted p-2">
            <p className="font-medium text-foreground">{rule.stage}: {rule.fee}</p>
            <p className="mt-1 text-xs text-muted-foreground">{rule.window}. {rule.refund}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{policyData.disclosure}</p>
    </section>
  );
}
