"use client";

import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";

import { Skeleton, StatusPill } from "@/components/ui";
import { cancellationPolicy, type CancellationPolicy } from "@/lib/api";

export function CancellationPolicyCard({ serviceType }: { serviceType: string }) {
  const policy = useQuery({ queryKey: ["cancellation-policy", serviceType], queryFn: () => cancellationPolicy({ serviceType }), staleTime: 5 * 60_000, retry: false });

  if (policy.isLoading) {
    return <Skeleton className="h-28" />;
  }

  const fallback = getFallbackPolicy(serviceType);
  const policyData = policy.data ?? fallback;
  const usingFallback = policy.isError || !policy.data;

  return (
    <section className="rounded-md border border-border bg-surface p-3 text-sm" aria-label="Cancellation fee rules">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-semibold text-foreground"><ShieldCheck className="size-4 text-delivery" aria-hidden="true" /> Cancellation windows</p>
        <div className="flex flex-wrap gap-2">
          <StatusPill label={policyData.serviceType} tone="info" />
          {usingFallback ? <StatusPill label="Preview rules" tone="warning" /> : null}
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

function getFallbackPolicy(serviceType: string): CancellationPolicy {
  const normalized = serviceType.toUpperCase();

  if (normalized === "RIDE") {
    return {
      serviceType: "RIDE",
      disclosure: "Preview rules shown while live policy is unavailable. Final fee is always computed server-side from the latest ride state.",
      rules: [
        { stage: "Before driver accepts", window: "Until a driver accepts", fee: "No fee", refund: "Full refund", note: "Safe to cancel while matching." },
        { stage: "After driver accepts", window: "Before the ride starts", fee: "Small fee may apply", refund: "Remaining amount refunded", note: "Fee depends on pickup progress." },
        { stage: "After ride starts", window: "Once IN_RIDE", fee: "Cancellation unavailable", refund: "Support reviewed", note: "Use support for safety or billing issues." },
      ],
    };
  }

  return {
    serviceType: normalized,
    disclosure: "Preview rules shown while live policy is unavailable. Final fee is always computed server-side from the latest booking state.",
    rules: [
      { stage: "Before partner accepts", window: "Until matching completes", fee: "No fee", refund: "Full refund", note: "Safe to cancel while searching." },
      { stage: "After partner accepts", window: "Before work starts", fee: "Fee may apply", refund: "Remaining amount refunded", note: "Fee depends on partner progress." },
      { stage: "After work starts", window: "Once service is in progress", fee: "Support reviewed", refund: "Case dependent", note: "Use support for exceptions." },
    ],
  };
}