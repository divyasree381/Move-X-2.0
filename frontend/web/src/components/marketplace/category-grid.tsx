"use client";

import Link from "next/link";
import { useState } from "react";
import { Bike, ChevronDown, Home, Package, Pill, ShoppingBasket, Utensils, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { StoreListItem } from "@/lib/api";

type Category = {
  label: string;
  description: string;
  tone: string;
  type?: StoreListItem["type"];
  icon: LucideIcon;
  href?: string;
};

const storeCategories: Category[] = [
  { label: "Food", description: "Hot meals from nearby kitchens", type: "FOOD", icon: Utensils, tone: "from-[#ff6b00] to-[#ff9b4d]" },
  { label: "Grocery", description: "Fresh essentials and staples", type: "GROCERY", icon: ShoppingBasket, tone: "from-[#12a36b] to-[#4ade80]" },
  { label: "Pharmacy", description: "Medicines with prescription flow", type: "PHARMACY", icon: Pill, tone: "from-[#2563eb] to-[#60a5fa]" },
];

const moreCategories: Category[] = [
  { label: "Rides", description: "Bike, auto, and cab booking", icon: Bike, href: "/customer/rides", tone: "from-[#1d4ed8] to-[#38bdf8]" },
  { label: "Courier", description: "Parcel pickup and drop", icon: Package, href: "/customer/couriers", tone: "from-[#7c3aed] to-[#f472b6]" },
  { label: "Home Services", description: "Trusted professionals by slot", icon: Home, href: "/customer/home-services", tone: "from-[#0f766e] to-[#2dd4bf]" },
];

export function CategoryGrid({ selectedType, onSelectType }: { selectedType?: StoreListItem["type"]; onSelectType: (type?: StoreListItem["type"]) => void }) {
  const [expanded, setExpanded] = useState(false);
  const categories = expanded ? [...storeCategories, ...moreCategories] : storeCategories;

  return (
    <section aria-labelledby="category-heading" className="rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand">Services</p>
          <h2 id="category-heading" className="mt-1 text-2xl font-black tracking-normal text-foreground">What do you need now?</h2>
        </div>
        {selectedType ? (
          <Button type="button" variant="secondary" size="sm" onClick={() => onSelectType(undefined)}>
            Clear filter
          </Button>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {categories.map((category) => {
          const Icon = category.icon;
          const selected = category.type !== undefined && selectedType === category.type;
          const content = (
            <>
              <span className={cn("flex size-11 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm", category.tone)}>
                <Icon className="size-5" aria-hidden={true} />
              </span>
              <span className="mt-4 block text-sm font-black text-foreground">{category.label}</span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">{category.description}</span>
            </>
          );

          if (category.href) {
            return (
              <Link
                key={category.label}
                href={category.href}
                className="min-h-36 rounded-lg border border-border bg-surface-muted p-3 text-left transition hover:-translate-y-0.5 hover:border-brand/45 hover:bg-surface hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                {content}
              </Link>
            );
          }

          return (
            <button
              key={category.label}
              type="button"
              onClick={() => category.type && onSelectType(category.type)}
              className={cn(
                "min-h-36 rounded-lg border border-border bg-surface-muted p-3 text-left transition hover:-translate-y-0.5 hover:border-brand/45 hover:bg-surface hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                selected && "border-brand bg-brand/10 shadow-md",
              )}
              aria-pressed={selected}
            >
              {content}
            </button>
          );
        })}
      </div>

      <Button type="button" variant="ghost" size="sm" className="mt-3" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
        <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} aria-hidden={true} />
        {expanded ? "Show fewer" : "More services"}
      </Button>
    </section>
  );
}