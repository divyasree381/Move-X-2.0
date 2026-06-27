"use client";

import { useState, type ReactNode } from "react";
import { PermissionAction } from "@movex/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, GitCompareArrows, Landmark, ReceiptText, WalletCards } from "lucide-react";

import { QueryState } from "@/providers/query-state";
import { useOpsPermission } from "@/components/shells";
import { Button, EmptyState, Input, Skeleton, StatusPill } from "@/components/ui";
import {
  financeInvoiceHtmlUrl,
  financeInvoices,
  financeLedger,
  financeReconciliationReports,
  financePayouts,
  financePayoutSweep,
  financeWalletAdjustment,
  generateFinanceReconciliation,
  generateFinanceInvoice,
  markFinancePayout,
  type FinanceInvoice,
  type FinanceReconciliationReport,
  type FinanceLedgerEntry,
  type FinancePayout,
} from "@/lib/api";

export function OpsLedgerPage() {
  const queryClient = useQueryClient();
  const adjustAccess = useOpsPermission(PermissionAction.FinanceWalletAdjust);
  const [filters, setFilters] = useState({ userId: "", type: "", isSettled: "" });
  const [adjustment, setAdjustment] = useState({ userId: "", amount: "", description: "Manual finance adjustment" });
  const ledger = useQuery({
    queryKey: ["finance-ledger", filters],
    queryFn: () => financeLedger({ limit: 50, userId: filters.userId || undefined, type: filters.type || undefined, isSettled: filters.isSettled ? filters.isSettled === "true" : undefined }),
  });
  const adjust = useMutation({
    mutationFn: () => financeWalletAdjustment({ userId: adjustment.userId, amount: Number(adjustment.amount), description: adjustment.description, idempotencyKey: `${adjustment.userId}:${adjustment.amount}:${Date.now()}` }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["finance-ledger"] }),
  });

  return (
    <FinancePermissionBoundary action={PermissionAction.FinanceLedgerRead}>
      <FinancePanel title="Ledger Explorer" icon={<FileText className="size-5" aria-hidden="true" />} filters={<div className="grid gap-2 md:grid-cols-[1fr_12rem_10rem]"><Input value={filters.userId} onChange={(e) => setFilters((v) => ({ ...v, userId: e.target.value }))} placeholder="User id" /><select className="rounded-md border border-border bg-surface px-3 text-sm" value={filters.type} onChange={(e) => setFilters((v) => ({ ...v, type: e.target.value }))}><option value="">All types</option><option>CREDIT</option><option>DEBIT</option><option>COMMISSION</option><option>PAYOUT</option><option>REFUND</option><option>ADJUSTMENT</option><option>PROMOTION</option><option>LOYALTY</option></select><select className="rounded-md border border-border bg-surface px-3 text-sm" value={filters.isSettled} onChange={(e) => setFilters((v) => ({ ...v, isSettled: e.target.value }))}><option value="">Any state</option><option value="false">Unsettled</option><option value="true">Settled</option></select></div>}>
        {adjustAccess.can ? <section className="grid gap-2 rounded-md border border-border bg-surface p-4 md:grid-cols-[1fr_8rem_1fr_auto]"><Input value={adjustment.userId} onChange={(e) => setAdjustment((v) => ({ ...v, userId: e.target.value }))} placeholder="User id" /><Input value={adjustment.amount} onChange={(e) => setAdjustment((v) => ({ ...v, amount: e.target.value }))} placeholder="Amount" /><Input value={adjustment.description} onChange={(e) => setAdjustment((v) => ({ ...v, description: e.target.value }))} /><Button disabled={!adjustment.userId || !adjustment.amount || adjust.isPending} onClick={() => adjust.mutate()}><WalletCards className="size-4" aria-hidden="true" /> Adjust</Button>{adjust.data ? <p className="md:col-span-4 text-sm text-success">Balance {adjust.data.balance}</p> : null}</section> : null}
        <QueryState isLoading={ledger.isLoading} isError={ledger.isError} error={ledger.error} onRetry={() => ledger.refetch()}>
          <FinanceTable headers={["Entry", "User", "Amount", "Payment", "State"]} empty="No ledger entries">
            {(ledger.data?.items ?? []).map((entry) => <LedgerRow key={entry.id} entry={entry} />)}
          </FinanceTable>
        </QueryState>
      </FinancePanel>
    </FinancePermissionBoundary>
  );
}

export function OpsPayoutsPage() {
  const queryClient = useQueryClient();
  const [userRole, setUserRole] = useState("");
  const payouts = useQuery({ queryKey: ["finance-payouts", userRole], queryFn: () => financePayouts({ limit: 50, userRole: userRole || undefined }) });
  const sweep = useMutation({ mutationFn: () => financePayoutSweep({ userRole: userRole || undefined, idempotencyKey: `ops:${userRole || "all"}:${Date.now()}` }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["finance-payouts"] }) });
  const mark = useMutation({ mutationFn: (payoutId: string) => markFinancePayout(payoutId), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["finance-payouts"] }) });

  return (
    <FinancePermissionBoundary action={PermissionAction.FinancePayoutManage}>
      <FinancePanel title="Payout Runs" icon={<Landmark className="size-5" aria-hidden="true" />} filters={<div className="grid gap-2 md:grid-cols-[12rem_auto]"><select className="rounded-md border border-border bg-surface px-3 text-sm" value={userRole} onChange={(e) => setUserRole(e.target.value)}><option value="">All partners</option><option>RESTAURANT</option><option>DELIVERY</option><option>DRIVER</option></select><Button onClick={() => sweep.mutate()} disabled={sweep.isPending}>Run sweep</Button></div>}>
        {sweep.data ? <div className="rounded-md border border-border bg-surface p-3 text-sm text-muted-foreground">Created or queued {sweep.data.items.length} payouts{ sweep.data.duplicate ? " from an idempotent replay" : "" }.</div> : null}
        <QueryState isLoading={payouts.isLoading} isError={payouts.isError} error={payouts.error} onRetry={() => payouts.refetch()}>
          <FinanceTable headers={["Payout", "Partner", "Amount", "Bank", "State", "Action"]} empty="No payouts">
            {(payouts.data?.items ?? []).map((payout) => <PayoutRow key={payout.id} payout={payout} onMark={() => mark.mutate(payout.id)} disabled={mark.isPending} />)}
          </FinanceTable>
        </QueryState>
      </FinancePanel>
    </FinancePermissionBoundary>
  );
}


export function OpsReconciliationPage() {
  const queryClient = useQueryClient();
  const today = new Date();
  const [form, setForm] = useState({ from: startOfDayInput(today), to: endOfDayInput(today), providerRows: "" });
  const reports = useQuery({ queryKey: ["finance-reconciliation"], queryFn: () => financeReconciliationReports({ limit: 25 }) });
  const generate = useMutation({
    mutationFn: () => generateFinanceReconciliation({ from: new Date(form.from).toISOString(), to: new Date(form.to).toISOString(), providerRows: parseProviderRows(form.providerRows) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["finance-reconciliation"] }),
  });

  return (
    <FinancePermissionBoundary action={PermissionAction.FinanceReconciliationRead}>
      <FinancePanel title="Razorpay Reconciliation" icon={<GitCompareArrows className="size-5" aria-hidden="true" />} filters={<div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]"><Input type="datetime-local" value={form.from} onChange={(e) => setForm((v) => ({ ...v, from: e.target.value }))} /><Input type="datetime-local" value={form.to} onChange={(e) => setForm((v) => ({ ...v, to: e.target.value }))} /><Button disabled={generate.isPending || !form.from || !form.to} onClick={() => generate.mutate()}>Run report</Button></div>}>
        <section className="rounded-md border border-border bg-surface p-4">
          <label className="text-sm font-semibold text-foreground" htmlFor="provider-rows">Injected provider rows for sandbox tests</label>
          <textarea id="provider-rows" value={form.providerRows} onChange={(e) => setForm((v) => ({ ...v, providerRows: e.target.value }))} className="mt-2 min-h-24 w-full rounded-md border border-border bg-surface-muted p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30" placeholder='[{"providerPaymentId":"pay_123","amount":"499.00","settledAt":"2026-06-27T10:00:00.000Z"}]' />
          {generate.data ? <ReconciliationSummary report={generate.data} /> : null}
          {generate.error ? <p className="mt-2 text-sm text-destructive">{generate.error instanceof Error ? generate.error.message : "Report failed"}</p> : null}
        </section>
        <QueryState isLoading={reports.isLoading} isError={reports.isError} error={reports.error} onRetry={() => reports.refetch()}>
          <FinanceTable headers={["Report", "Totals", "Matches", "State"]} empty="No reconciliation reports">
            {(reports.data?.items ?? []).map((report) => <ReconciliationRow key={report.id} report={report} />)}
          </FinanceTable>
        </QueryState>
      </FinancePanel>
    </FinancePermissionBoundary>
  );
}
export function OpsInvoicesPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ referenceType: "ORDER" as FinanceInvoice["type"], referenceId: "" });
  const [selected, setSelected] = useState<string | null>(null);
  const invoices = useQuery({ queryKey: ["finance-invoices"], queryFn: () => financeInvoices({ limit: 50 }) });
  const generate = useMutation({ mutationFn: () => generateFinanceInvoice(form), onSuccess: (invoice) => { setSelected(invoice.id); queryClient.invalidateQueries({ queryKey: ["finance-invoices"] }); } });

  return (
    <FinancePermissionBoundary action={PermissionAction.FinanceInvoiceManage}>
      <FinancePanel title="Invoices" icon={<ReceiptText className="size-5" aria-hidden="true" />} filters={<div className="grid gap-2 md:grid-cols-[10rem_1fr_auto]"><select className="rounded-md border border-border bg-surface px-3 text-sm" value={form.referenceType} onChange={(e) => setForm((v) => ({ ...v, referenceType: e.target.value as FinanceInvoice["type"] }))}><option>ORDER</option><option>RIDE</option><option>COURIER</option><option>HOME_SERVICE</option></select><Input value={form.referenceId} onChange={(e) => setForm((v) => ({ ...v, referenceId: e.target.value }))} placeholder="Reference id" /><Button disabled={!form.referenceId || generate.isPending} onClick={() => generate.mutate()}>Generate</Button></div>}>
        <div className="grid gap-4 xl:grid-cols-[1fr_26rem]">
          <QueryState isLoading={invoices.isLoading} isError={invoices.isError} error={invoices.error} onRetry={() => invoices.refetch()}>
            <FinanceTable headers={["Invoice", "Reference", "Customer", "Amount", "State"]} empty="No invoices">
              {(invoices.data?.items ?? []).map((invoice) => <InvoiceRow key={invoice.id} invoice={invoice} onSelect={() => setSelected(invoice.id)} />)}
            </FinanceTable>
          </QueryState>
          <aside className="min-h-[32rem] rounded-md border border-border bg-surface p-3">
            {selected ? <iframe title="Invoice preview" src={financeInvoiceHtmlUrl(selected)} className="h-[30rem] w-full rounded-md border border-border bg-white" /> : <EmptyState title="No invoice selected" description="Generate or select an invoice to preview the HTML." />}
          </aside>
        </div>
      </FinancePanel>
    </FinancePermissionBoundary>
  );
}

function FinancePermissionBoundary({ action, children }: { action: PermissionAction; children: ReactNode }) {
  const access = useOpsPermission(action);
  if (access.isLoading) {
    return <Skeleton className="h-48" />;
  }
  if (!access.can) {
    return <EmptyState title="No access" description="This finance view is hidden by the permission matrix for your role." />;
  }
  return <>{children}</>;
}

function FinancePanel({ title, icon, filters, children }: { title: string; icon: ReactNode; filters?: ReactNode; children: ReactNode }) {
  return <div className="space-y-4"><section className="rounded-md border border-border bg-surface p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="rounded-md border border-border bg-surface-muted p-2 text-brand">{icon}</span><h2 className="text-lg font-semibold text-foreground">{title}</h2></div><StatusPill label="Finance" tone="info" /></div>{filters ? <div className="mt-4">{filters}</div> : null}</section>{children}</div>;
}

function FinanceTable({ headers, empty, children }: { headers: string[]; empty: string; children: ReactNode }) {
  const rows = Array.isArray(children) ? children.filter(Boolean) : children;
  return <div className="overflow-hidden rounded-md border border-border bg-surface"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-surface-muted text-xs uppercase text-muted-foreground"><tr>{headers.map((header) => <th key={header} className="px-3 py-2 font-semibold">{header}</th>)}</tr></thead><tbody>{children}</tbody></table>{(!rows || (Array.isArray(rows) && rows.length === 0)) ? <EmptyState title={empty} description="Adjust filters or check back later." /> : null}</div>;
}

function Cell({ children }: { children: ReactNode }) {
  return <td className="px-3 py-3 align-top">{children}</td>;
}

function Primary({ text, sub }: { text: string; sub?: string }) {
  return <div><p className="font-medium text-foreground">{text}</p>{sub ? <p className="mt-1 max-w-md truncate text-xs text-muted-foreground">{sub}</p> : null}</div>;
}

function LedgerRow({ entry }: { entry: FinanceLedgerEntry }) {
  return <tr className="border-t border-border"><Cell><Primary text={entry.type} sub={entry.id} /></Cell><Cell><Primary text={entry.user?.name ?? entry.user?.email ?? entry.userId} sub={entry.userRole} /></Cell><Cell>{entry.amount}</Cell><Cell>{entry.paymentMethod ?? "-"}</Cell><Cell><StatusPill label={entry.isSettled ? "Settled" : "Open"} tone={entry.isSettled ? "success" : "warning"} /></Cell></tr>;
}

function PayoutRow({ payout, onMark, disabled }: { payout: FinancePayout; onMark: () => void; disabled?: boolean }) {
  return <tr className="border-t border-border"><Cell><Primary text={payout.reference ?? payout.id} sub={payout.id} /></Cell><Cell><Primary text={payout.user?.name ?? payout.user?.email ?? payout.userId} sub={payout.userRole} /></Cell><Cell>{payout.amount}</Cell><Cell><Primary text={payout.bankAccountName} sub={`${payout.bankIfsc} / ${payout.bankAccountNumber}`} /></Cell><Cell><StatusPill label={payout.status} tone={payout.status === "PAID" ? "success" : payout.status === "FAILED" ? "danger" : "warning"} /></Cell><Cell><Button size="sm" variant="secondary" disabled={disabled || payout.status === "PAID"} onClick={onMark}>Sync</Button></Cell></tr>;
}

function InvoiceRow({ invoice, onSelect }: { invoice: FinanceInvoice; onSelect: () => void }) {
  return <tr className="border-t border-border"><Cell><button type="button" className="text-left font-medium text-brand underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30" onClick={onSelect}>{invoice.invoiceNumber}</button><p className="mt-1 text-xs text-muted-foreground">{invoice.id}</p></Cell><Cell>{invoice.type} {invoice.referenceId}</Cell><Cell>{invoice.customer?.name ?? invoice.customer?.email ?? invoice.customerId}</Cell><Cell>{invoice.amount}</Cell><Cell><StatusPill label={invoice.status} tone={invoice.status === "PAID" ? "success" : "info"} /></Cell></tr>;
}
function ReconciliationSummary({ report }: { report: FinanceReconciliationReport }) {
  return <div className="mt-3 rounded-md border border-border bg-surface-muted p-3 text-sm"><p className="font-semibold text-foreground">Report {report.status}</p><p className="mt-1 text-muted-foreground">Provider Rs {Number(report.providerTotal).toFixed(2)} vs ledger Rs {Number(report.ledgerTotal).toFixed(2)}. Mismatches: {report.mismatchCount}.</p></div>;
}

function ReconciliationRow({ report }: { report: FinanceReconciliationReport }) {
  const mismatches = Array.isArray(report.mismatches) ? report.mismatches : [];
  return <tr className="border-t border-border"><Cell><Primary text={new Date(report.createdAt).toLocaleString()} sub={`${report.from} to ${report.to}`} /></Cell><Cell><Primary text={`Provider ${report.providerTotal}`} sub={`Ledger ${report.ledgerTotal}`} /></Cell><Cell>{report.matchedCount} matched / {report.mismatchCount} flagged{mismatches[0] ? <p className="mt-1 max-w-sm truncate text-xs text-muted-foreground">{JSON.stringify(mismatches[0])}</p> : null}</Cell><Cell><StatusPill label={report.status} tone={report.status === "CLEAR" ? "success" : "danger"} /></Cell></tr>;
}

function parseProviderRows(value: string): Array<Record<string, unknown>> | undefined {
  if (!value.trim()) return undefined;
  const parsed = JSON.parse(value) as unknown;
  return Array.isArray(parsed) ? parsed.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item))) : undefined;
}

function startOfDayInput(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return localDateTime(next);
}

function endOfDayInput(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 0, 0);
  return localDateTime(next);
}

function localDateTime(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}