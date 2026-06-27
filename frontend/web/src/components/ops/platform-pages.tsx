"use client";

import { useState, type ReactNode } from "react";
import { PermissionAction } from "@movex/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Flag, RefreshCw, Search } from "lucide-react";

import { QueryState } from "@/providers/query-state";
import { useOpsPermission } from "@/components/shells";
import { Button, EmptyState, Input, Skeleton, StatusPill } from "@/components/ui";
import {
  platformAnalytics,
  platformFeatureFlags,
  refreshPlatformAnalytics,
  requestPlatformSearchRebuild,
  upsertPlatformFeatureFlag,
  type PlatformAnalyticsRow,
  type PlatformFeatureFlag,
} from "@/lib/api";

export function OpsAnalyticsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 13);
    return date.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(today);
  const analytics = useQuery({ queryKey: ["platform-analytics", from, to], queryFn: () => platformAnalytics({ from, to }) });
  const refresh = useMutation({ mutationFn: () => refreshPlatformAnalytics({ from, to }), onSuccess: () => analytics.refetch() });

  return (
    <PlatformPermissionBoundary action={PermissionAction.PlatformAnalyticsRead}>
      <PlatformPanel
        title="Analytics"
        description="Projection-backed orders, rides, GMV, and partner activity."
        icon={<BarChart3 className="size-5" aria-hidden="true" />}
        filters={<div className="grid gap-2 md:grid-cols-[10rem_10rem_auto]"><Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /><Input type="date" value={to} onChange={(event) => setTo(event.target.value)} /><Button variant="secondary" disabled={refresh.isPending} onClick={() => refresh.mutate()}><RefreshCw className="size-4" aria-hidden="true" /> Refresh projections</Button></div>}
      >
        <QueryState isLoading={analytics.isLoading} isError={analytics.isError} error={analytics.error} onRetry={() => analytics.refetch()}>
          {analytics.data ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Metric label="Orders" value={analytics.data.totals.ordersCount.toLocaleString()} />
                <Metric label="Rides" value={analytics.data.totals.ridesCount.toLocaleString()} />
                <Metric label="GMV" value={formatMoney(analytics.data.totals.gmv)} />
                <Metric label="Active partners" value={analytics.data.totals.activePartners.toLocaleString()} />
              </div>
              <ProjectionTable rows={analytics.data.rows} />
              {refresh.isSuccess ? <p className="text-sm text-success">Projection refresh accepted for {refresh.data.upserted} rows.</p> : null}
            </div>
          ) : null}
        </QueryState>
      </PlatformPanel>
    </PlatformPermissionBoundary>
  );
}

export function OpsFeatureFlagsPage() {
  const queryClient = useQueryClient();
  const [key, setKey] = useState("vertical.pharmacy.enabled");
  const [description, setDescription] = useState("Gate a vertical or experiment");
  const [enabled, setEnabled] = useState(false);
  const [rollout, setRollout] = useState('{"audience":"internal"}');
  const flags = useQuery({ queryKey: ["platform-feature-flags"], queryFn: () => platformFeatureFlags({ limit: 100 }) });
  const save = useMutation({
    mutationFn: () => upsertPlatformFeatureFlag(key, { enabled, description, rollout: JSON.parse(rollout) as Record<string, unknown> }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform-feature-flags"] }),
  });

  return (
    <PlatformPermissionBoundary action={PermissionAction.PlatformFeatureFlagsManage}>
      <PlatformPanel
        title="Feature Flags"
        description="Gate verticals and experiments without changing callers."
        icon={<Flag className="size-5" aria-hidden="true" />}
        filters={<div className="grid gap-2 lg:grid-cols-[16rem_1fr_1fr_auto_auto]"><Input value={key} onChange={(event) => setKey(event.target.value)} /><Input value={description} onChange={(event) => setDescription(event.target.value)} /><Input value={rollout} onChange={(event) => setRollout(event.target.value)} /><label className="flex min-h-10 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> Enabled</label><Button disabled={!key || save.isPending} onClick={() => save.mutate()}>Save</Button></div>}
      >
        <QueryState isLoading={flags.isLoading} isError={flags.isError} error={flags.error} onRetry={() => flags.refetch()}>
          <FeatureFlagTable flags={flags.data?.items ?? []} />
          {save.error ? <p className="text-sm text-destructive">{save.error instanceof Error ? save.error.message : "Feature flag save failed"}</p> : null}
        </QueryState>
      </PlatformPanel>
    </PlatformPermissionBoundary>
  );
}

export function OpsSearchPage() {
  const rebuild = useMutation({ mutationFn: () => requestPlatformSearchRebuild({ scope: "stores" }) });

  return (
    <PlatformPermissionBoundary action={PermissionAction.PlatformSearchRebuildManage}>
      <PlatformPanel title="Search Operations" description="Backfill and rebuild the real search index through the worker outbox." icon={<Search className="size-5" aria-hidden="true" />}>
        <div className="rounded-md border border-border bg-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-foreground">Store index rebuild</h3>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Creates a worker outbox event. The request path does not talk to Meilisearch directly.</p>
            </div>
            <Button disabled={rebuild.isPending} onClick={() => rebuild.mutate()}><RefreshCw className="size-4" aria-hidden="true" /> Rebuild</Button>
          </div>
          {rebuild.data ? <p className="mt-3 text-sm text-success">Queued as outbox event {rebuild.data.eventId}</p> : null}
          {rebuild.error ? <p className="mt-3 text-sm text-destructive">{rebuild.error instanceof Error ? rebuild.error.message : "Rebuild request failed"}</p> : null}
        </div>
      </PlatformPanel>
    </PlatformPermissionBoundary>
  );
}

function PlatformPermissionBoundary({ action, children }: { action: PermissionAction; children: ReactNode }) {
  const access = useOpsPermission(action);

  if (access.isLoading) {
    return <Skeleton className="h-48" />;
  }

  if (!access.can) {
    return <EmptyState title="No access" description="This view is hidden by the permission matrix for your role." />;
  }

  return <>{children}</>;
}

function PlatformPanel({ title, description, icon, filters, children }: { title: string; description: string; icon: ReactNode; filters?: ReactNode; children: ReactNode }) {
  return <div className="space-y-4"><section className="rounded-md border border-border bg-surface p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-3"><div className="rounded-md border border-border bg-surface-muted p-2 text-primary">{icon}</div><div><h2 className="text-lg font-semibold text-foreground">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div></div><StatusPill label="Projection-backed" tone="info" /></div>{filters ? <div className="mt-4">{filters}</div> : null}</section>{children}</div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-border bg-surface p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold text-foreground">{value}</p></div>;
}

function ProjectionTable({ rows }: { rows: PlatformAnalyticsRow[] }) {
  return <div className="overflow-hidden rounded-md border border-border bg-surface"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-surface-muted text-xs uppercase text-muted-foreground"><tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Scope</th><th className="px-3 py-2">Orders</th><th className="px-3 py-2">Rides</th><th className="px-3 py-2">Courier</th><th className="px-3 py-2">Services</th><th className="px-3 py-2">GMV</th><th className="px-3 py-2">Partners</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t border-border"><td className="px-3 py-3">{row.date}</td><td className="px-3 py-3"><StatusPill label={row.scope} tone="info" /></td><td className="px-3 py-3">{row.ordersCount}</td><td className="px-3 py-3">{row.ridesCount}</td><td className="px-3 py-3">{row.courierCount}</td><td className="px-3 py-3">{row.homeServiceCount}</td><td className="px-3 py-3">{formatMoney(row.gmv)}</td><td className="px-3 py-3">{row.activePartners}</td></tr>)}</tbody></table>{rows.length === 0 ? <EmptyState title="No projections" description="Refresh projections for the selected date range." /> : null}</div>;
}

function FeatureFlagTable({ flags }: { flags: PlatformFeatureFlag[] }) {
  return <div className="overflow-hidden rounded-md border border-border bg-surface"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-surface-muted text-xs uppercase text-muted-foreground"><tr><th className="px-3 py-2">Flag</th><th className="px-3 py-2">State</th><th className="px-3 py-2">Rollout</th><th className="px-3 py-2">Updated</th></tr></thead><tbody>{flags.map((flag) => <tr key={flag.key} className="border-t border-border"><td className="px-3 py-3"><p className="font-medium text-foreground">{flag.key}</p><p className="mt-1 text-xs text-muted-foreground">{flag.description ?? "No description"}</p></td><td className="px-3 py-3"><StatusPill label={flag.enabled ? "Enabled" : "Disabled"} tone={flag.enabled ? "success" : "warning"} /></td><td className="px-3 py-3"><code className="text-xs">{JSON.stringify(flag.rollout)}</code></td><td className="px-3 py-3">{new Date(flag.updatedAt).toLocaleString()}</td></tr>)}</tbody></table>{flags.length === 0 ? <EmptyState title="No feature flags" description="Create a flag to gate a vertical or experiment." /> : null}</div>;
}

function formatMoney(value: string) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value));
}
