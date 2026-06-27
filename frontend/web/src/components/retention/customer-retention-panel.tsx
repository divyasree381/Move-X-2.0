"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gift, Heart, TicketPercent, WalletCards } from "lucide-react";

import { Button, EmptyState, Input, StatusPill } from "@/components/ui";
import { applyReferralCode, listFavorites, retentionSummary } from "@/lib/api";

export function CustomerRetentionPanel() {
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const retention = useQuery({ queryKey: ["retention-summary"], queryFn: retentionSummary });
  const favorites = useQuery({ queryKey: ["favorites", "profile"], queryFn: () => listFavorites(), retry: false });
  const applyReferral = useMutation({
    mutationFn: () => applyReferralCode(code.trim()),
    onSuccess: () => {
      setCode("");
      queryClient.invalidateQueries({ queryKey: ["retention-summary"] });
    },
  });
  const data = retention.data;

  return (
    <section className="rounded-md border border-border bg-surface p-4" aria-labelledby="retention-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-brand">Rewards</p>
          <h2 id="retention-heading" className="text-lg font-semibold text-foreground">Customer value</h2>
        </div>
        {data?.referralCode ? <StatusPill label={data.referralCode} tone="warning" /> : null}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Metric icon={<TicketPercent className="size-4" aria-hidden="true" />} label="Points" value={data?.loyaltyPoints ?? "0"} />
        <Metric icon={<WalletCards className="size-4" aria-hidden="true" />} label="Referral credits" value={`Rs ${Number(data?.referralCredits ?? 0).toFixed(0)}`} />
        <Metric icon={<Gift className="size-4" aria-hidden="true" />} label="Friends joined" value={String(data?.referralsMade ?? 0)} />
      </div>

      {!data?.referralReceived ? (
        <form className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]" onSubmit={(event) => { event.preventDefault(); if (code.trim()) applyReferral.mutate(); }}>
          <Input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="Referral code" aria-label="Referral code" />
          <Button type="submit" disabled={!code.trim() || applyReferral.isPending}><Gift className="size-4" aria-hidden="true" /> Apply</Button>
          {applyReferral.error ? <p className="text-sm text-destructive sm:col-span-2">{applyReferral.error instanceof Error ? applyReferral.error.message : "Could not apply referral"}</p> : null}
        </form>
      ) : (
        <p className="mt-4 rounded-md border border-border bg-surface-muted p-3 text-sm text-muted-foreground">Referral applied: {data.referralReceived.code}</p>
      )}

      <div className="mt-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground"><Heart className="size-4 text-destructive" aria-hidden="true" /> Favorites</div>
        {(favorites.data?.items ?? []).length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {(favorites.data?.items ?? []).slice(0, 4).map((favorite) => (
              <Link key={favorite.id} href={favorite.store ? `/customer/stores/${favorite.store.id}` : favorite.menuItem ? `/customer/stores/${favorite.menuItem.store.id}` : "/customer"} className="rounded-md border border-border p-3 text-sm transition hover:border-brand/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
                <span className="font-semibold text-foreground">{favorite.store?.name ?? favorite.menuItem?.name ?? "Favorite"}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{favorite.store?.type ?? favorite.menuItem?.store.name ?? favorite.type}</span>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title="No favorites yet" description="Save stores and items for faster repeat bookings." />
        )}
      </div>
    </section>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface-muted p-3">
      <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">{icon} {label}</p>
      <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
    </div>
  );
}