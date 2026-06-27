"use client";

import Link from "next/link";
import { createContext, useContext, type ReactNode } from "react";
import { UserRole, hasPermission } from "@movex/shared";
import type { PermissionAction } from "@movex/shared";
import { useQuery } from "@tanstack/react-query";
import { Activity, Shield, TerminalSquare } from "lucide-react";

import { EmptyState, StatusPill } from "@/components/ui";
import { currentUser } from "@/lib/api";
import { navForRole, opsNav } from "./shell-nav";

type OpsRole = UserRole.SUPPORT | UserRole.FINANCE | UserRole.ADMIN | UserRole.SUPER_ADMIN;

type OpsPermissionContextValue = {
  role: OpsRole | null;
  isLoading: boolean;
  can: (action: PermissionAction) => boolean;
};

const OpsPermissionContext = createContext<OpsPermissionContextValue>({
  role: null,
  isLoading: true,
  can: () => false,
});

export function useOpsPermission(action: PermissionAction) {
  const context = useContext(OpsPermissionContext);
  return { can: context.can(action), isLoading: context.isLoading, role: context.role };
}

export function OpsConsoleShell({ children, role: fallbackRole }: { children?: ReactNode; role?: OpsRole }) {
  const me = useQuery({ queryKey: ["auth-me"], queryFn: currentUser, retry: false });
  const sessionRole = toOpsRole(me.data?.user.role);
  const role = sessionRole ?? fallbackRole ?? null;
  const nav = role ? navForRole(role, opsNav) : [];
  const permissionContext: OpsPermissionContextValue = {
    role,
    isLoading: me.isLoading,
    can: (action) => Boolean(role && hasPermission(role, action)),
  };

  return (
    <OpsPermissionContext.Provider value={permissionContext}>
      <div className="min-h-screen bg-[#eef1f5] text-foreground">
        <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-[#202a37] bg-[#0f1722] p-4 text-white lg:block">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-brand text-white">
              <TerminalSquare className="size-5" aria-hidden={true} />
            </span>
            <div>
              <p className="text-sm font-black">MoveX Ops</p>
              <p className="text-xs text-white/55">{role ?? (me.isLoading ? "Loading" : "No ops role")}</p>
            </div>
          </div>
          <nav className="mt-7 space-y-1" aria-label="Operations navigation">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className="flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold text-white/62 hover:bg-white/8 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
                <item.icon className="size-4" aria-hidden={true} />
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="lg:pl-64">
          <header className="border-b border-border bg-surface/95 backdrop-blur-xl">
            <div className="flex min-h-16 items-center justify-between gap-4 px-4 lg:px-6">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.12em] text-brand">Ops Console</p>
                <h1 className="text-2xl font-black tracking-normal">Control Room</h1>
              </div>
              <StatusPill label="Permission filtered" tone="info" />
            </div>
          </header>
          <main className="space-y-5 p-4 lg:p-6">
            <section className="grid gap-3 md:grid-cols-3">
              <OpsMetric label="Visible nav" value={role ? String(nav.length) : "0"} detail="Matrix driven" icon={Activity} />
              <OpsMetric label="Role" value={role ?? "Resolving"} detail="Session derived" icon={Shield} />
              <OpsMetric label="Open queue" value="0" detail="Alerts and reviews" />
            </section>
            {children ?? <EmptyState title="No operational alerts" description="Support, finance, and partner-review work queues will surface here." />}
          </main>
        </div>
      </div>
    </OpsPermissionContext.Provider>
  );
}

function OpsMetric({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon?: typeof Activity }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
          <p className="mt-2 truncate text-2xl font-black tracking-normal text-foreground">{value}</p>
          <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
        </div>
        {Icon ? <span className="flex size-10 items-center justify-center rounded-md bg-ride/10 text-ride"><Icon size={18} aria-hidden={true} /></span> : null}
      </div>
    </div>
  );
}

function toOpsRole(role?: string): OpsRole | null {
  if (role === UserRole.SUPPORT || role === UserRole.FINANCE || role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN) {
    return role;
  }

  return null;
}