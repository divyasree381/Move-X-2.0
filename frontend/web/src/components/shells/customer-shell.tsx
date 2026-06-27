import type { ReactNode } from "react";
import { UserRole } from "@movex/shared";
import { Bell, MapPin } from "lucide-react";

import { CartDrawer } from "@/components/orders";
import { Button, EmptyState, StatusPill } from "@/components/ui";
import { customerNav, navForRole } from "./shell-nav";

export function CustomerShell({ children, role = UserRole.CUSTOMER }: { children?: ReactNode; role?: UserRole }) {
  const nav = navForRole(role, customerNav);

  return (
    <div className="min-h-screen bg-surface-muted text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-brand">MoveX</p>
            <h1 className="text-xl font-semibold">Customer</h1>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill label="Serviceable" tone="success" />
            <CartDrawer />
            <Button variant="secondary" size="icon" aria-label="Notifications">
              <Bell className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-5 lg:grid-cols-[14rem_1fr]">
        <nav className="rounded-md border border-border bg-surface p-2" aria-label="Customer navigation">
          {nav.map((item) => (
            <a key={item.href} href={item.href} className="flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
              <item.icon className="size-4" aria-hidden="true" />
              {item.label}
            </a>
          ))}
        </nav>
        <main className="space-y-4">
          <section className="grid gap-3 rounded-md border border-border bg-surface p-4 sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Pinned Location</p>
              <p className="mt-1 flex items-center gap-2 text-sm font-semibold"><MapPin className="size-4 text-brand" aria-hidden="true" /> Bengaluru</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Active Orders</p>
              <p className="mt-1 text-2xl font-semibold">0</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Wallet</p>
              <p className="mt-1 text-2xl font-semibold">Rs 0</p>
            </div>
          </section>
          {children ?? <EmptyState title="No active journey" description="Confirmed orders and rides will appear here." />}
        </main>
      </div>
    </div>
  );
}