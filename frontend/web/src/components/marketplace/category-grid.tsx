"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui";
import type { StoreListItem } from "@/lib/api";
import { publicServices, type PublicService } from "@/lib/public-site-data";
import { cn } from "@/lib/utils";

type Category = PublicService & {
  type?: StoreListItem["type"];
  customerHref?: string;
};

const categoriesById = new Map(publicServices.map((service) => [service.id, service]));
const category = (id: string, additions: Pick<Category, "type" | "customerHref"> = {}): Category => ({ ...categoriesById.get(id)!, ...additions });
const primaryCategories = [
  category("food", { type: "FOOD" }),
  category("grocery", { type: "GROCERY" }),
  category("rides", { customerHref: "/customer/rides" }),
  category("pharmacy", { type: "PHARMACY" }),
];
const additionalCategories = [
  category("courier", { customerHref: "/customer/couriers" }),
  category("home", { customerHref: "/customer/home-services" }),
];

export function CategoryGrid({ selectedType, onSelectType }: { selectedType?: StoreListItem["type"]; onSelectType: (type?: StoreListItem["type"]) => void }) {
  const [expanded, setExpanded] = useState(false);
  const categories = expanded ? [...primaryCategories, ...additionalCategories] : primaryCategories;

  return (
    <section aria-labelledby="category-heading">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-primary">Services</p>
          <h2 id="category-heading" className="mt-1 text-2xl font-bold text-foreground">What do you need today?</h2>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
          {expanded ? "Show Less" : "View All"}<ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} aria-hidden="true" />
        </Button>
      </div>

      <div className={cn("mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4", expanded && "lg:grid-cols-6")}>
        {categories.map((item) => {
          const selected = item.type !== undefined && selectedType === item.type;
          const content = (
            <>
              <span className="relative block aspect-[4/3] overflow-hidden bg-surface-muted">
                <Image src={item.imageUrl} alt="" fill unoptimized sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 220px" className="object-cover transition duration-300 group-hover:scale-[1.04]" />
                <span className={cn("absolute left-2 top-2 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm", item.tone)}>{item.label}</span>
              </span>
              <span className="block p-3">
                <span className="block text-sm font-bold text-foreground">{item.label}</span>
                <span className="mt-1 line-clamp-1 block text-xs text-muted-foreground">{item.description}</span>
              </span>
            </>
          );
          const className = cn("group overflow-hidden rounded-lg border bg-surface text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30", selected ? "border-primary ring-2 ring-primary/15" : "border-border");

          if (item.customerHref) return <Link key={item.id} href={item.customerHref} className={className}>{content}</Link>;
          return <button key={item.id} type="button" className={className} aria-pressed={selected} onClick={() => item.type && onSelectType(selected ? undefined : item.type)}>{content}</button>;
        })}
      </div>
    </section>
  );
}
