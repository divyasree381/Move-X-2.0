"use client";

import { createContext, useContext, type ReactNode } from "react";
import { UserRole, hasPermission } from "@movex/shared";
import type { PermissionAction } from "@movex/shared";
import { useQuery } from "@tanstack/react-query";
import { Shield, TerminalSquare } from "lucide-react";

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
      <div className="min-h-screen bg-surface-muted text-foreground">
        <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-border bg-surface p-4 lg:block">
          <div className="flex items-center gap-2">
            <TerminalSquare className="size-5 text-brand" aria-hidden={true} />
            <div>
              <p className="text-sm font-semibold">MoveX Ops</p>
              <p className="text-xs text-muted-foreground">{role ?? (me.isLoading ? "Loading" : "No ops role")}</p>
            </div>
          </div>
          <nav className="mt-6 space-y-1" aria-label="Operations navigation">
            {nav.map((item) => (
              <a key={item.href} href={item.href} className="flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
                <item.icon className="size-4" aria-hidden={true} />
                {item.label}
              </a>
            ))}
          </nav>
        </aside>
        <div className="lg:pl-64">
          <header className="border-b border-border bg-surface">
            <div className="flex min-h-16 items-center justify-between gap-4 px-4 lg:px-6">
              <div>
                <p className="text-sm font-semibold text-brand">Ops Console</p>
                <h1 className="text-xl font-semibold">Control Room</h1>
              </div>
              <StatusPill label="Permission filtered" tone="info" />
            </div>
          </header>
          <main className="space-y-4 p-4 lg:p-6">
            <section className="grid gap-3 md:grid-cols-3">
              <div className="rounded-md border border-border bg-surface p-4">
                <p className="text-xs font-medium text-muted-foreground">Visible Nav Items</p>
                <p className="mt-1 text-2xl font-semibold">{role ? nav.length : 0}</p>
              </div>
              <div className="rounded-md border border-border bg-surface p-4">
                <p className="text-xs font-medium text-muted-foreground">Role</p>
                <p className="mt-1 flex items-center gap-2 text-sm font-semibold"><Shield className="size-4 text-brand" aria-hidden={true} /> {role ?? "Resolving"}</p>
              </div>
              <div className="rounded-md border border-border bg-surface p-4">
                <p className="text-xs font-medium text-muted-foreground">Queue</p>
                <p className="mt-1 text-2xl font-semibold">0</p>
              </div>
            </section>
            {children ?? <EmptyState title="No operational alerts" description="Support, finance, and partner-review work queues will surface here." />}
          </main>
        </div>
      </div>
    </OpsPermissionContext.Provider>
  );
}

function toOpsRole(role?: string): OpsRole | null {
  if (role === UserRole.SUPPORT || role === UserRole.FINANCE || role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN) {
    return role;
  }

  return null;
}