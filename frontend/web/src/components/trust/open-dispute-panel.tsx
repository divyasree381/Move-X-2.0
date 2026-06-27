"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { MessageSquareWarning } from "lucide-react";

import { Button, Input, StatusPill } from "@/components/ui";
import { openDispute, type OpsDispute } from "@/lib/api";

const REASONS: OpsDispute["reason"][] = ["NOT_DELIVERED", "DAMAGED_OR_INCOMPLETE", "OVERCHARGED", "SAFETY_OR_BEHAVIOR", "CANCELLATION_FEE", "OTHER"];

export function OpenDisputePanel({ referenceType, referenceId }: { referenceType: OpsDispute["referenceType"]; referenceId: string }) {
  const [reason, setReason] = useState<OpsDispute["reason"]>("OTHER");
  const [summary, setSummary] = useState("Need support review");
  const [customerNote, setCustomerNote] = useState("");
  const dispute = useMutation({ mutationFn: () => openDispute({ referenceType, referenceId, reason, summary, customerNote: customerNote.trim() || undefined }) });

  return (
    <section className="mt-4 border-t border-border pt-4" aria-labelledby={`${referenceType}-${referenceId}-dispute-heading`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id={`${referenceType}-${referenceId}-dispute-heading`} className="flex items-center gap-2 text-base font-semibold text-foreground"><MessageSquareWarning className="size-5 text-warning" aria-hidden="true" /> Need help with this booking?</h3>
          <p className="mt-1 text-sm text-muted-foreground">Open a dispute with the support team. Every action is recorded in the case trail.</p>
        </div>
        <StatusPill label={referenceType} tone="info" />
      </div>
      <div className="mt-3 grid gap-2">
        <select className="min-h-10 rounded-md border border-border bg-surface px-3 text-sm" value={reason} onChange={(event) => setReason(event.target.value as OpsDispute["reason"])} aria-label="Dispute reason">
          {REASONS.map((item) => <option key={item}>{item}</option>)}
        </select>
        <Input value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Short summary" />
        <textarea value={customerNote} onChange={(event) => setCustomerNote(event.target.value)} className="min-h-20 rounded-md border border-border bg-surface-muted p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30" placeholder="Add details for support" />
      </div>
      <Button type="button" className="mt-3 w-full" disabled={dispute.isPending || summary.trim().length < 8} onClick={() => dispute.mutate()}>Open dispute</Button>
      {dispute.data ? <p className="mt-2 text-sm text-success">Dispute opened. Ticket {dispute.data.supportTicketId}</p> : null}
      {dispute.error ? <p className="mt-2 text-sm text-destructive">{dispute.error instanceof Error ? dispute.error.message : "Could not open dispute"}</p> : null}
    </section>
  );
}