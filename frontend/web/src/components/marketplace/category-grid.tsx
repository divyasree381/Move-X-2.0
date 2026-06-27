"use client";

import { useState } from "react";
import { Bike, ChevronDown, Home, Package, Pill, ShoppingBasket, Utensils, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { StoreListItem } from "@/lib/api";

type Category = {
  label: string;
  description: string;
  type?: StoreListItem["type"];
  icon: LucideIcon;
  disabled?: boolean;
  href?: string;
};

const storeCategories: Category[] = [
  { label: "Food", description: "Restaurants nearby", type: "FOOD", icon: Utensils },
  { label: "Grocery", description: "Daily essentials", type: "GROCERY", icon: ShoppingBasket },
  { label: "Pharmacy", description: "Medicine stores", type: "PHARMACY", icon: Pill },
];

const moreCategories: Category[] = [
  { label: "Rides", description: "Book bike, auto, or cab", icon: Bike, href: "/customer/rides" },
  { label: "Courier", description: "Send parcels now", icon: Package, href: "/customer/couriers" },
  { label: "Home Services", description: "Book a pro", icon: Home, href: "/customer/home-services" },
];

export function CategoryGrid({ selectedType, onSelectType }: { selectedType?: StoreListItem["type"]; onSelectType: (type?: StoreListItem["type"]) => void }) {
  const [expanded, setExpanded] = useState(false);
  const categories = expanded ? [...storeCategories, ...moreCategories] : storeCategories;

  return (
    <section aria-labelledby="category-heading" className="rounded-md border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="category-heading" className="text-base font-semibold text-foreground">What do you need now?</h2>
          <p className="mt-1 text-sm text-muted-foreground">Start with nearby delivery categories, then branch out when needed.</p>
        </div>
        {selectedType ? (
          <Button type="button" variant="secondary" size="sm" onClick={() => onSelectType(undefined)}>
            Clear filter
          </Button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {categories.map((category) => {
          const Icon = category.icon;
          const selected = category.type !== undefined && selectedType === category.type;

          return (
            <button
              key={category.label}
              type="button"
              disabled={category.disabled}
              onClick={() => {
                if (category.href) {
                  window.location.href = category.href;
                  return;
                }
                if (category.type) {
                  onSelectType(category.type);
                }
              }}
              className={cn(
                "min-h-24 rounded-md border border-border bg-surface-muted p-3 text-left transition hover:border-brand/45 hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60",
                selected && "border-brand bg-brand/10",
              )}
              aria-pressed={selected}
            >
              <span className="flex items-center justify-between gap-3">
                <Icon className={cn("size-5", selected ? "text-brand" : "text-muted-foreground")} aria-hidden="true" />
                {category.disabled ? <span className="text-xs font-medium text-muted-foreground">Soon</span> : null}
              </span>
              <span className="mt-3 block text-sm font-semibold text-foreground">{category.label}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{category.description}</span>
            </button>
          );
        })}
      </div>

      <Button type="button" variant="ghost" size="sm" className="mt-3" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
        <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} aria-hidden="true" />
        {expanded ? "Show fewer" : "More services"}
      </Button>
    </section>
  );
}