"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ShoppingBag } from "lucide-react";

import { Button } from "@/components/ui";
import { getCart, type CartResponse } from "@/lib/api";

const CART_QUERY_KEY = ["cart"] as const;
const CART_IMAGE_FALLBACK = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Crect width='160' height='160' rx='20' fill='%23ecfdf5'/%3E%3Ccircle cx='112' cy='42' r='36' fill='%23a7f3d0'/%3E%3Crect x='34' y='64' width='92' height='54' rx='14' fill='%23059669' opacity='.2'/%3E%3Cpath d='M50 101h60v10H50zM60 80h42v10H60z' fill='%23059669'/%3E%3C/svg%3E";

export function CartButton() {
  const pathname = usePathname();
  const cartQuery = useQuery({ queryKey: CART_QUERY_KEY, queryFn: getCart });
  const cart = cartQuery.data;

  const itemCount = useMemo(() => cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0, [cart]);
  const hasItems = Boolean(cart && cart.items.length > 0);
  const cartTotal = cart?.pricing.total ?? "0";

  // Hide the sticky bottom cart bar on the cart page itself and during checkout.
  const shouldHideBottomBar = pathname === "/cart" || pathname === "/customer/checkout";

  return (
    <>
      <Button asChild variant="secondary" size="icon" className="relative" aria-label={`Cart with ${itemCount} items`}>
        <Link href="/cart">
          <ShoppingBag className="size-4" aria-hidden="true" />
          {itemCount > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[0.65rem] font-semibold leading-5 text-primary-foreground shadow-sm" aria-hidden="true">
              {itemCount > 9 ? "9+" : itemCount}
            </span>
          ) : null}
        </Link>
      </Button>

      {hasItems && !shouldHideBottomBar ? (
        <Link
          href="/cart"
          className="fixed inset-x-4 bottom-4 z-40 flex min-h-16 items-center justify-between gap-3 rounded-full border border-primary/20 bg-primary px-4 text-left text-primary-foreground shadow-[var(--shadow-shell)] transition hover:-translate-y-0.5 md:left-auto md:right-6 md:w-[24rem]"
          aria-label={`View cart with ${itemCount} items totaling Rs ${Number(cartTotal).toFixed(0)}`}
        >
          <span className="flex min-w-0 items-center gap-3">
            <CartImageStack cart={cart} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">View cart</span>
              <span className="block text-xs text-primary-foreground/78">{itemCount} item{itemCount === 1 ? "" : "s"} - Rs {Number(cartTotal).toFixed(0)}</span>
            </span>
          </span>
          <ArrowRight className="size-5 shrink-0" aria-hidden="true" />
        </Link>
      ) : null}
    </>
  );
}

function CartImageStack({ cart }: { cart?: CartResponse }) {
  const items = cart?.items.slice(0, 3) ?? [];

  return (
    <span className="flex -space-x-2">
      {items.length > 0 ? items.map((item) => (
        <span key={item.menuItemId} className="relative block size-10 overflow-hidden rounded-full border-2 border-primary bg-surface">
          <Image src={item.imageUrl || CART_IMAGE_FALLBACK} alt="" fill sizes="40px" className="object-cover" unoptimized={!item.imageUrl} />
        </span>
      )) : <span className="grid size-10 place-items-center rounded-full bg-primary-hover"><ShoppingBag className="size-5" aria-hidden="true" /></span>}
    </span>
  );
}
