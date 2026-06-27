"use client";

import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Clock3, IndianRupee, Route, WalletCards } from "lucide-react";

import { Button, EmptyState, Input, StatusPill } from "@/components/ui";
import { cancelPartnerShift, createPartnerShift, partnerOpsSummary, type PartnerPeriodSummary, type PartnerShift } from "@/lib/api";

export function PartnerOpsPanel({ isOnline }: { isOnline: boolean }) {
  const queryClient = useQueryClient();
  const [startsAt, setStartsAt] = useState(defaultShiftStart());
  const [endsAt, setEndsAt] = useState(defaultShiftEnd());
  const [note, setNote] = useState("");
  const ops = useQuery({ queryKey: ["partner-ops"], queryFn: () => partnerOpsSummary(), refetchInterval: isOnline ? 30_000 : 90_000 });
  const createShift = useMutation({
    mutationFn: () => createPartnerShift({ startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString(), note: note.trim() || undefined }),
    onSuccess: () => {
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["partner-ops"] });
    },
  });
  const cancelShift = useMutation({ mutationFn: cancelPartnerShift, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["partner-ops"] }) });
  const data = ops.data;

  return (
    <section className="rounded-md border border-border bg-surface p-4" aria-labelledby="partner-ops-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-delivery">Operations</p>
          <h2 id="partner-ops-heading" className="text-base font-semibold text-foreground">Earnings and availability</h2>
        </div>
        <StatusPill label={data?.routePlan.mode ?? "STUB"} tone="info" />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-4">
        <Metric icon={<IndianRupee className="size-4" aria-hidden="true" />} label="Today ledger net" value={money(data?.daily.ledger.net)} sub={`${data?.daily.ledger.entryCount ?? 0} entries`} />
        <Metric icon={<WalletCards className="size-4" aria-hidden="true" />} label="Unsettled" value={money(data?.daily.ledger.unsettled)} sub="Ledger-backed" />
        <Metric icon={<Clock3 className="size-4" aria-hidden="true" />} label="Online today" value={formatDuration(data?.daily.online.seconds ?? 0)} sub={`${data?.daily.online.sessions.length ?? 0} sessions`} />
        <Metric icon={<IndianRupee className="size-4" aria-hidden="true" />} label="Week ledger net" value={money(data?.weekly.ledger.net)} sub="Ledger-reconciled" />
      </div>

      {data ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_22rem]">
          <LedgerReconcile summary={data.daily} />
          <OnlineSessions summary={data.daily} />
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_22rem]">
        <section className="rounded-md border border-border bg-surface-muted p-3" aria-labelledby="shift-heading">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground"><CalendarClock className="size-4 text-brand" aria-hidden="true" /><h3 id="shift-heading">Shift schedule</h3></div>
          <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
            <Input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} aria-label="Shift start" />
            <Input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} aria-label="Shift end" />
            <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Zone or note" />
            <Button type="button" disabled={createShift.isPending || !startsAt || !endsAt} onClick={() => createShift.mutate()}>Add shift</Button>
          </div>
          <div className="mt-3 grid gap-2">
            {(data?.shifts ?? []).length > 0 ? (data?.shifts ?? []).map((shift) => <ShiftRow key={shift.id} shift={shift} onCancel={() => cancelShift.mutate(shift.id)} disabled={cancelShift.isPending} />) : <EmptyState title="No shifts scheduled" description="Add availability windows so queues can respect your planned work time." />}
          </div>
        </section>

        <section className="rounded-md border border-border bg-surface-muted p-3" aria-labelledby="route-heading">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground"><Route className="size-4 text-ride" aria-hidden="true" /><h3 id="route-heading">Batching hooks</h3></div>
          <p className="mt-2 text-sm text-muted-foreground">Objective: {data?.routePlan.objective ?? "ETA"}</p>
          <p className="mt-1 text-sm text-muted-foreground">Max stops: {data?.routePlan.maxStops ?? 6}</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {(data?.routePlan.notes ?? ["Route optimization stub is ready."]).map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>
      </div>
    </section>
  );
}

function Metric({ icon, label, value, sub }: { icon: ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-md border border-border bg-surface-muted p-3">
      <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">{icon} {label}</p>
      <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function LedgerReconcile({ summary }: { summary: PartnerPeriodSummary }) {
  return (
    <div className="rounded-md border border-border bg-surface-muted p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-foreground">Ledger reconciliation</p>
        <StatusPill label={`${summary.ledger.entryCount} entries`} tone="info" />
      </div>
      <p className="mt-2 text-muted-foreground">{summary.ledger.formula}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <span>Credits: {money(summary.ledger.grossCredits)}</span>
        <span>Debits: {money(summary.ledger.debits)}</span>
        <span>Payouts: {money(summary.payouts.total)}</span>
      </div>
    </div>
  );
}

function OnlineSessions({ summary }: { summary: PartnerPeriodSummary }) {
  const sessions = summary.online.sessions.slice(-3).reverse();
  return (
    <div className="rounded-md border border-border bg-surface-muted p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-foreground">Online time</p>
        <StatusPill label={formatDuration(summary.online.seconds)} tone="success" />
      </div>
      <div className="mt-3 grid gap-2">
        {sessions.length > 0 ? sessions.map((session) => (
          <div key={session.id} className="rounded-md border border-border bg-surface px-3 py-2">
            <p className="font-medium text-foreground">{new Date(session.startedAt).toLocaleTimeString()} to {session.endedAt ? new Date(session.endedAt).toLocaleTimeString() : "now"}</p>
            <p className="mt-1 text-xs text-muted-foreground">Last heartbeat: {session.lastHeartbeatAt ? new Date(session.lastHeartbeatAt).toLocaleTimeString() : "not received"}</p>
          </div>
        )) : <EmptyState title="No online sessions today" description="Go online to start tracking availability time." />}
      </div>
    </div>
  );
}

function ShiftRow({ shift, onCancel, disabled }: { shift: PartnerShift; onCancel: () => void; disabled?: boolean }) {
  return (
    <article className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface p-3 text-sm">
      <div>
        <p className="font-semibold text-foreground">{new Date(shift.startsAt).toLocaleString()} to {new Date(shift.endsAt).toLocaleTimeString()}</p>
        <p className="mt-1 text-muted-foreground">{shift.note ?? "Availability window"}</p>
      </div>
      <div className="flex items-center gap-2">
        <StatusPill label={shift.status} tone={shift.status === "SCHEDULED" ? "success" : "warning"} />
        <Button type="button" size="sm" variant="secondary" disabled={disabled || shift.status !== "SCHEDULED"} onClick={onCancel}>Cancel</Button>
      </div>
    </article>
  );
}

function money(value: string | undefined) {
  return `Rs ${Number(value ?? 0).toFixed(0)}`;
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function localDateTimeValue(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function defaultShiftStart() {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setMinutes(0, 0, 0);
  return localDateTimeValue(date);
}

function defaultShiftEnd() {
  const date = new Date(Date.now() + 5 * 60 * 60 * 1000);
  date.setMinutes(0, 0, 0);
  return localDateTimeValue(date);
}