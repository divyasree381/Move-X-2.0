import Link from "next/link";
import type { ReactNode } from "react";
import { UserRole } from "@movex/shared";
import { ArrowLeft, CircleHelp, Search, UserRound } from "lucide-react";

import { CartDrawer } from "@/components/orders";
import { Button, EmptyState, StatusPill } from "@/components/ui";
import { customerNav, navForRole } from "./shell-nav";

type CustomerShellProps = {
  children?: ReactNode;
  role?: UserRole;
  mode?: "default" | "focused";
};

const desktopLabels = new Set(["Orders", "Rides", "Courier"]);
const mobileLabels = new Set(["Home", "Orders", "Rides", "Home Services", "Profile"]);

export function CustomerShell({ children, role = UserRole.CUSTOMER, mode = "default" }: CustomerShellProps) {
  const nav = navForRole(role, customerNav);
  const desktopNav = nav.filter((item) => desktopLabels.has(item.label));
  const mobileNav = nav.filter((item) => mobileLabels.has(item.label));
  const focused = mode === "focused";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/94 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-2">
            {focused ? (
              <Button asChild variant="ghost" size="icon">
                <Link href="/customer" aria-label="Back to customer home"><ArrowLeft className="size-5" aria-hidden="true" /></Link>
              </Button>
            ) : null}
            <Link href="/customer" className="flex shrink-0 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-lg font-black text-primary-foreground shadow-sm">M</span>
              <span className="hidden text-lg font-black tracking-normal text-foreground sm:block">MoveX</span>
            </Link>

          </div>

          {focused ? <span aria-hidden="true" /> : (
            <>
              <Link href="/customer#search" className="hidden min-h-10 w-full max-w-sm items-center gap-2 rounded-full border border-border bg-surface-muted px-4 text-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 md:flex">
                <Search className="size-4" aria-hidden="true" />Search food, grocery, rides, and more
              </Link>
              <nav className="hidden items-center gap-1 lg:flex" aria-label="Customer shortcuts">
                {desktopNav.map((item) => (
                  <Link key={item.href} href={item.href} className="rounded-md px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">{item.label}</Link>
                ))}
              </nav>
            </>
          )}

          <div className="flex shrink-0 items-center gap-2">
            <StatusPill label="Serviceable" tone="success" className="hidden xl:inline-flex" />
            {focused ? (
              <>
                <Button asChild variant="secondary" size="icon"><Link href="/support" aria-label="Support"><CircleHelp className="size-4" aria-hidden="true" /></Link></Button>
                <Button asChild variant="secondary" size="icon"><Link href="/customer/profile" aria-label="Customer profile"><UserRound className="size-4" aria-hidden="true" /></Link></Button>
              </>
            ) : (
              <>
                <CartDrawer />
                <Button asChild variant="secondary" size="icon"><Link href="/customer/profile" aria-label="Customer profile"><UserRound className="size-4" aria-hidden="true" /></Link></Button>
              </>
            )}
          </div>
        </div>
      </header>

      {focused ? (
        <main className="min-h-[calc(100dvh-4rem)]">{children}</main>
      ) : (
        <main className="mx-auto max-w-7xl px-4 pb-24 pt-5 md:pb-8">
          {children ?? <EmptyState title="Nothing here yet" description="Your MoveX services will appear here." />}
        </main>
      )}

      {!focused ? (
        <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-surface/96 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl md:hidden" aria-label="Customer navigation">
          {mobileNav.map((item) => (
            <Link key={item.href} href={item.href} className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-md px-1 text-[0.68rem] font-semibold text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
              <item.icon className="size-5" aria-hidden={true} />
              <span className="max-w-full truncate">{item.label === "Home Services" ? "Services" : item.label}</span>
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
