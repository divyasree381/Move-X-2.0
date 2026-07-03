"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { PermissionAction } from "@movex/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Eye, EyeOff, Flag, Home, RefreshCw, Search } from "lucide-react";

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

export function OpsHomepagePage() {
  const [heroTitle, setHeroTitle] = useState("Order food, book rides, and get home services nearby.");
  const [heroSubtitle, setHeroSubtitle] = useState("Preview the public homepage controls before backend-managed content APIs are connected.");
  const [visibleServices, setVisibleServices] = useState(() => new Set(homepageServices.map((service) => service.id)));
  const [offerStripVisible, setOfferStripVisible] = useState(true);

  function toggleService(serviceId: string) {
    setVisibleServices((current) => {
      const next = new Set(current);

      if (next.has(serviceId)) {
        next.delete(serviceId);
      } else {
        next.add(serviceId);
      }

      return next;
    });
  }

  return (
    <PlatformPermissionBoundary action={PermissionAction.PlatformHomepageManage}>
      <PlatformPanel
        title="Homepage Control"
        description="Super Admin-only controls for public services, banners, and launch surfaces."
        icon={<Home className="size-5" aria-hidden="true" />}
        filters={<div className="flex flex-wrap gap-2"><StatusPill label="SUPER_ADMIN only" tone="success" /><StatusPill label="Preview only" tone="warning" /></div>}
      >
        <section className="rounded-md border border-warning/30 bg-warning/10 p-4 text-sm text-foreground">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold">Preview-only controls</p>
              <p className="mt-1 leading-6 text-muted-foreground">Changes on this page are local UI previews. Persistence should connect to SystemConfig, audit logs, and the public homepage API in a backend pass.</p>
            </div>
            <Button asChild variant="secondary" size="sm"><Link href="/">Open public homepage</Link></Button>
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
          <section className="space-y-4 rounded-md border border-border bg-surface p-4">
            <div>
              <h3 className="font-semibold text-foreground">Hero banner</h3>
              <p className="mt-1 text-sm text-muted-foreground">Draft the main public homepage message. Saving will connect to system config later.</p>
            </div>
            <div className="grid gap-3">
              <label className="space-y-1.5 text-sm font-medium text-foreground">
                <span>Headline</span>
                <Input value={heroTitle} onChange={(event) => setHeroTitle(event.target.value)} />
              </label>
              <label className="space-y-1.5 text-sm font-medium text-foreground">
                <span>Supporting copy</span>
                <Input value={heroSubtitle} onChange={(event) => setHeroSubtitle(event.target.value)} />
              </label>
            </div>
          </section>

          <section className="rounded-md border border-border bg-foreground p-4 text-background">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-background/60">Preview</p>
            <h3 className="mt-4 text-2xl font-semibold leading-tight">{heroTitle}</h3>
            <p className="mt-3 text-sm leading-6 text-background/70">{heroSubtitle}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {homepageServices.filter((service) => visibleServices.has(service.id)).map((service) => (
                <span key={service.id} className="rounded-full bg-background/10 px-3 py-1.5 text-xs font-medium text-background/80">{service.label}</span>
              ))}
            </div>
          </section>
        </div>

        <section className="rounded-md border border-border bg-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-foreground">Service visibility</h3>
              <p className="mt-1 text-sm text-muted-foreground">Hide or show customer-facing services without changing login roles.</p>
            </div>
            <StatusPill label={`${visibleServices.size} visible`} tone="info" />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {homepageServices.map((service) => {
              const visible = visibleServices.has(service.id);

              return (
                <button
                  key={service.id}
                  type="button"
                  aria-pressed={visible}
                  className="rounded-md border border-border bg-surface-muted p-4 text-left transition hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                  onClick={() => toggleService(service.id)}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span>
                      <span className="block font-semibold text-foreground">{service.label}</span>
                      <span className="mt-1 block text-sm leading-6 text-muted-foreground">{service.description}</span>
                    </span>
                    {visible ? <Eye className="size-5 text-success" aria-hidden="true" /> : <EyeOff className="size-5 text-muted-foreground" aria-hidden="true" />}
                  </span>
                  <span className="mt-3 inline-flex rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-muted-foreground">{visible ? "Visible" : "Hidden"}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-md border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-foreground">Launch offers strip</h3>
              <p className="mt-1 text-sm text-muted-foreground">Super Admin can hide public promo previews while real coupon validation remains server-side.</p>
            </div>
            <Button type="button" variant={offerStripVisible ? "primary" : "secondary"} onClick={() => setOfferStripVisible((value) => !value)}>
              {offerStripVisible ? "Shown on homepage" : "Hidden from homepage"}
            </Button>
          </div>
        </section>
      </PlatformPanel>
    </PlatformPermissionBoundary>
  );
}

const homepageServices = [
  { id: "food", label: "Food", description: "Restaurants and prepared meals." },
  { id: "grocery", label: "Grocery", description: "Daily essentials and staples." },
  { id: "pharmacy", label: "Pharmacy", description: "Prescription-ready medicine orders." },
  { id: "rides", label: "Rides", description: "Bike, auto, and cab booking." },
  { id: "courier", label: "Courier", description: "Parcel pickup and delivery." },
  { id: "home-services", label: "Home services", description: "One service partner path for plumbing, electrical, repair, and more." },
];
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
