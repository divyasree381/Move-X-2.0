"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ChevronDown, LayoutDashboard, LogOut, MapPin, UserRound } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { CartButton } from "@/components/orders";
import { Button, StatusPill } from "@/components/ui";
import { currentUser, logout, routeForAuthenticatedUser, type AuthUser } from "@/lib/api";

const NAVBAR_MENU_OPEN_EVENT = "movex:navbar-menu-open";

export function PublicHeaderActions() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, staleTime: 30_000, refetchOnWindowFocus: false },
          mutations: { retry: 0 },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <PublicHeaderActionsContent />
    </QueryClientProvider>
  );
}

function PublicHeaderActionsContent() {
  const me = useQuery({ queryKey: ["auth-me"], queryFn: currentUser, retry: false });
  const user = me.data?.user ?? null;

  if (me.isLoading) {
    return (
      <div className="flex items-center gap-2" aria-label="Loading account state">
        <span className="hidden h-9 w-24 animate-pulse rounded-md bg-surface-muted sm:block" />
        <span className="h-9 w-24 animate-pulse rounded-md bg-surface-muted" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
          <Link href="/login">Log in</Link>
        </Button>
        <Button asChild size="sm">
          <Link href="/login/customer">Get started</Link>
        </Button>
      </div>
    );
  }

  return <LoggedInHeaderActions user={user} />;
}

function LoggedInHeaderActions({ user }: { user: AuthUser }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const homeHref = routeForAuthenticatedUser(user);
  const accountMenuId = useId();
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const accountMenuButtonRef = useRef<HTMLButtonElement>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.clear();
      router.refresh();
    },
  });

  useEffect(() => {
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!accountMenuOpen || accountMenuRef.current?.contains(event.target as Node)) return;
      setAccountMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !accountMenuOpen) return;
      setAccountMenuOpen(false);
      accountMenuButtonRef.current?.focus();
    };
    const closeForAnotherMenu = (event: Event) => {
      const menuEvent = event as CustomEvent<{ id: string }>;
      if (menuEvent.detail?.id !== accountMenuId) setAccountMenuOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener(NAVBAR_MENU_OPEN_EVENT, closeForAnotherMenu);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener(NAVBAR_MENU_OPEN_EVENT, closeForAnotherMenu);
    };
  }, [accountMenuId, accountMenuOpen]);

  const toggleAccountMenu = () => {
    const nextOpen = !accountMenuOpen;
    if (nextOpen) {
      document.dispatchEvent(
        new CustomEvent(NAVBAR_MENU_OPEN_EVENT, { detail: { id: accountMenuId } }),
      );
    }
    setAccountMenuOpen(nextOpen);
  };

  return (
    <div className="flex items-center gap-2">
      <StatusPill label="Serviceable" tone="success" className="hidden md:inline-flex" />
      <Link
        href="/customer"
        className="hidden min-h-9 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-medium text-foreground transition hover:border-primary/35 hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 lg:inline-flex"
      >
        <MapPin className="size-4 text-primary" aria-hidden="true" />
        Bengaluru
      </Link>
      {user.role === "CUSTOMER" ? <CartButton /> : null}
      <div ref={accountMenuRef} className="relative">
        <button
          ref={accountMenuButtonRef}
          type="button"
          className="flex min-h-9 items-center gap-2 rounded-md border border-border bg-surface px-2.5 text-sm font-medium text-foreground shadow-sm transition hover:border-primary/35 hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          aria-label={`${user.name || roleLabel(user.role)} account menu`}
          aria-expanded={accountMenuOpen}
          aria-controls={`${accountMenuId}-menu`}
          onClick={toggleAccountMenu}
        >
          <span className="grid size-7 place-items-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
            {initials(user)}
          </span>
          <span className="hidden max-w-28 truncate sm:block">
            {user.name || roleLabel(user.role)}
          </span>
          <ChevronDown
            className={`size-4 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none ${accountMenuOpen ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
        <div
          id={`${accountMenuId}-menu`}
          aria-hidden={!accountMenuOpen}
          className={`absolute right-0 top-[calc(100%+0.5rem)] z-50 w-72 origin-top-right rounded-lg border border-border bg-surface p-2 shadow-[var(--shadow-shell)] transition-[opacity,transform,visibility] duration-200 ease-out motion-reduce:transition-none ${
            accountMenuOpen
              ? "visible translate-y-0 opacity-100"
              : "pointer-events-none invisible -translate-y-1 opacity-0"
          }`}
        >
          <div className="rounded-md bg-surface-muted p-3">
            <p className="text-sm font-semibold text-foreground">
              {user.name || roleLabel(user.role)}
            </p>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {user.phoneE164 ?? user.email ?? "MoveX account"}
            </p>
          </div>
          <MenuLink href="/" icon={<MapPin className="size-4" aria-hidden="true" />}>
            Main home
          </MenuLink>
          <MenuLink
            href={homeHref}
            icon={<LayoutDashboard className="size-4" aria-hidden="true" />}
          >
            Dashboard
          </MenuLink>
          {user.role === "CUSTOMER" ? (
            <MenuLink
              href="/customer/profile"
              icon={<UserRound className="size-4" aria-hidden="true" />}
            >
              Profile and addresses
            </MenuLink>
          ) : null}
          <button
            type="button"
            className="mt-1 flex min-h-10 w-full items-center gap-2 rounded-md px-3 text-left text-sm font-medium text-destructive transition hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
          >
            <LogOut className="size-4" aria-hidden="true" />
            {logoutMutation.isPending ? "Logging out" : "Logout"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MenuLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="mt-1 flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground transition hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
    >
      {icon}
      {children}
    </Link>
  );
}

function initials(user: AuthUser) {
  const source = user.name || user.email || user.phoneE164 || user.role;
  return source.slice(0, 1).toUpperCase();
}

function roleLabel(role: AuthUser["role"]) {
  return role
    .replace("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
