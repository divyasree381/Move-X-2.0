"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, ShoppingBag } from "lucide-react";

import { Button, Dialog, DialogContent, Input } from "@/components/ui";
import { addCartItem, type MarketplaceMenuItem } from "@/lib/api";

type Option = {
  name: string;
  priceDelta?: number;
};

type Group = {
  name: string;
  options: Option[];
};

export function CustomizationModal({ item, open, onOpenChange }: { item: MarketplaceMenuItem | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [allowSubstitution, setAllowSubstitution] = useState(true);
  const [substitutionNote, setSubstitutionNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const groups = useMemo(() => parseCustomizationGroups(item?.customizations), [item]);
  const addMutation = useMutation({
    mutationFn: () => addCartItem({ menuItemId: item?.id ?? "", quantity, customizations: {}, note: note.trim() || undefined, substitutionPreference: { allow: allowSubstitution, note: substitutionNote.trim() || null } }),
    onMutate: () => setError(null),
    onSuccess: (cart) => {
      queryClient.setQueryData(["cart"], cart);
      setQuantity(1);
      setNote("");
      setAllowSubstitution(true);
      setSubstitutionNote("");
      onOpenChange(false);
    },
    onError: (caught) => setError(caught instanceof Error ? caught.message : "Could not add item"),
  });

  if (!item) {
    return null;
  }

  const unlimited = item.stock === -1;
  const outOfStock = item.stock === 0;
  const maxQuantity = unlimited ? 99 : Math.max(item.stock, 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={item.name} description={item.description}>
        <div className="mt-5 space-y-4">
          <div className="rounded-md border border-border bg-surface-muted p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-muted-foreground">Base price</span>
              <span className="text-base font-semibold text-foreground">Rs {Number(item.price).toFixed(0)}</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {unlimited ? "Available" : outOfStock ? "Out of stock" : `${item.stock} left`}
            </p>
          </div>

          {groups.length > 0 ? (
            <div className="space-y-3">
              {groups.map((group) => (
                <fieldset key={group.name} className="rounded-md border border-border p-3">
                  <legend className="px-1 text-sm font-semibold text-foreground">{group.name}</legend>
                  <div className="mt-2 space-y-2">
                    {group.options.map((option) => (
                      <label key={option.name} className="flex min-h-9 items-center justify-between gap-3 rounded-md px-2 text-sm hover:bg-surface-muted">
                        <span className="inline-flex items-center gap-2">
                          <input type="checkbox" className="size-4 accent-brand" />
                          {option.name}
                        </span>
                        {option.priceDelta ? <span className="text-muted-foreground">+ Rs {option.priceDelta}</span> : <span className="text-muted-foreground">Included</span>}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
          ) : null}

          <label className="block text-sm font-medium text-foreground" htmlFor="menu-note">
            Note for partner
          </label>
          <Input id="menu-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Less spicy, no onions, etc." />


          <div className="rounded-md border border-border p-3">
            <label className="flex items-start gap-3 text-sm text-foreground">
              <input type="checkbox" className="mt-1 size-4 accent-brand" checked={allowSubstitution} onChange={(event) => setAllowSubstitution(event.target.checked)} />
              <span>
                <span className="font-medium">Allow replacement if unavailable</span>
                <span className="mt-1 block text-xs text-muted-foreground">Useful for grocery and pharmacy picking. You can still review proposed substitutions before handoff.</span>
              </span>
            </label>
            {allowSubstitution ? <Input className="mt-3" value={substitutionNote} onChange={(event) => setSubstitutionNote(event.target.value)} placeholder="Replacement preference, brand, pack size" /> : null}
          </div>
          <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
            <span className="text-sm font-medium text-foreground">Quantity</span>
            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" size="icon" aria-label="Decrease quantity" disabled={quantity <= 1} onClick={() => setQuantity((value) => Math.max(1, value - 1))}>
                <Minus className="size-4" aria-hidden="true" />
              </Button>
              <span className="w-8 text-center text-sm font-semibold" aria-live="polite">{quantity}</span>
              <Button type="button" variant="secondary" size="icon" aria-label="Increase quantity" disabled={quantity >= maxQuantity} onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 1))}>
                <Plus className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>

          {error ? <p className="text-sm text-destructive" role="status">{error}</p> : null}
          <Button type="button" className="w-full" disabled={outOfStock || addMutation.isPending} onClick={() => addMutation.mutate()}>
            <ShoppingBag className="size-4" aria-hidden="true" />
            {outOfStock ? "Unavailable" : addMutation.isPending ? "Adding" : "Add to cart"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function parseCustomizationGroups(customizations: unknown): Group[] {
  if (!customizations || typeof customizations !== "object") {
    return [];
  }

  const rawGroups = (customizations as { groups?: unknown }).groups;

  if (!Array.isArray(rawGroups)) {
    return [];
  }

  return rawGroups
    .map((group) => {
      if (!group || typeof group !== "object") {
        return null;
      }

      const record = group as { name?: unknown; options?: unknown };
      if (typeof record.name !== "string" || !Array.isArray(record.options)) {
        return null;
      }

      const options = record.options
        .map((option) => {
          if (!option || typeof option !== "object") {
            return null;
          }

          const optionRecord = option as { name?: unknown; priceDelta?: unknown };
          if (typeof optionRecord.name !== "string") {
            return null;
          }

          return {
            name: optionRecord.name,
            priceDelta: typeof optionRecord.priceDelta === "number" ? optionRecord.priceDelta : undefined,
          };
        })
        .filter((option): option is Option => option !== null);

      return { name: record.name, options };
    })
    .filter((group): group is Group => group !== null && group.options.length > 0);
}