import Link from "next/link";
import type { ReactNode } from "react";
import { UserRole } from "@movex/shared";
import { Bell, MapPin, Search, WalletCards } from "lucide-react";

import { CartDrawer } from "@/components/orders";
import { Button, EmptyState, StatusPill } from "@/components/ui";
import { customerNav, navForRole } from "./shell-nav";

export function CustomerShell({ children, role = UserRole.CUSTOMER }: { children?: ReactNode; role?: UserRole }) {
  const nav = navForRole(role, customerNav);

  return (
    <div className="min-h-screen bg-[#f4f6f8] text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-white/92 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/customer" className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
            <span className="flex size-10 items-center justify-center rounded-lg bg-brand text-lg font-black text-white shadow-sm">M</span>
            <span>
              <span className="block text-lg font-black tracking-normal text-[#111827]">MoveX</span>
              <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground"><MapPin className="size-3.5 text-brand" aria-hidden={true} /> Bengaluru</span>
            </span>
          </Link>
          <div className="hidden min-w-0 flex-1 justify-center md:flex">
            <div className="flex min-h-10 w-full max-w-md items-center gap-2 rounded-full border border-border bg-surface-muted px-4 text-sm text-muted-foreground">
              <Search className="size-4" aria-hidden={true} /> Search food, rides, medicine
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill label="Serviceable" tone="success" className="hidden sm:inline-flex" />
            <CartDrawer />
            <Button variant="secondary" size="icon" aria-label="Notifications">
              <Bell className="size-4" aria-hidden={true} />
            </Button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-3 md:hidden" aria-label="Customer navigation">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-border bg-surface px-3 text-sm font-semibold text-muted-foreground">
              <item.icon className="size-4" aria-hidden={true} />
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 lg:grid-cols-[13rem_1fr]">
        <aside className="hidden lg:block">
          <nav className="sticky top-24 rounded-lg border border-border bg-surface p-2 shadow-sm" aria-label="Customer navigation">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className="flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold text-muted-foreground hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
                <item.icon className="size-4" aria-hidden={true} />
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="space-y-5">
          <section className="grid gap-3 md:grid-cols-3">
            <SummaryCard label="Pinned location" value="Bengaluru" detail="Fastest partners nearby" icon={MapPin} />
            <SummaryCard label="Active journeys" value="0" detail="Orders and rides" />
            <SummaryCard label="Wallet" value="Rs 0" detail="Ledger backed" icon={WalletCards} />
          </section>
          {children ?? <EmptyState title="No active journey" description="Confirmed orders and rides will appear here." />}
        </main>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon?: typeof MapPin }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-black tracking-normal text-foreground">{value}</p>
          <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
        </div>
        {Icon ? <span className="flex size-10 items-center justify-center rounded-md bg-brand/10 text-brand"><Icon size={18} aria-hidden={true} /></span> : null}
      </div>
    </div>
  );
}