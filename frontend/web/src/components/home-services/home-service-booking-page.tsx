"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { SelectedLocation } from "@movex/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarClock, Home, IndianRupee, MapPin, Wallet } from "lucide-react";

import { MapPicker } from "@/components/location/map-picker";
import { CancellationPolicyCard } from "@/components/trust";
import { Button, Input, StatusPill } from "@/components/ui";
import { createHomeService, estimateHomeService, homeServiceCatalog, type HomeServiceCreateResponse } from "@/lib/api";
import { RideMap } from "@/components/rides";
import { cn } from "@/lib/utils";

const DEFAULT_ADDRESS: SelectedLocation = { address: "Indiranagar, Bengaluru", lat: 12.9784, lng: 77.6408, source: "gps" };
const PAYMENTS = ["CASH", "WALLET", "ONLINE"] as const;

export function HomeServiceBookingPage() {
  const [address, setAddress] = useState<SelectedLocation>(DEFAULT_ADDRESS);
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENTS)[number]>("CASH");
  const [serviceCode, setServiceCode] = useState("AC_SERVICE");
  const [scheduledFor, setScheduledFor] = useState(defaultSlotValue());
  const [note, setNote] = useState("");
  const [created, setCreated] = useState<HomeServiceCreateResponse | null>(null);

  const catalog = useQuery({ queryKey: ["home-service-catalog"], queryFn: () => homeServiceCatalog() });
  const selected = catalog.data?.items.find((item) => item.code === serviceCode) ?? catalog.data?.items[0];
  const estimate = useQuery({ queryKey: ["home-service-estimate", serviceCode], queryFn: () => estimateHomeService({ serviceCode }), enabled: Boolean(serviceCode) });
  const createMutation = useMutation({
    mutationFn: () => createHomeService({ serviceCode, address, scheduledFor: new Date(scheduledFor).toISOString(), note: note.trim() || undefined, paymentMethod }),
    onSuccess: setCreated,
  });
  const categories = useMemo(() => Array.from(new Set((catalog.data?.items ?? []).map((item) => item.category))), [catalog.data]);

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-border bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-delivery">Home services</p>
            <h2 className="text-xl font-semibold text-foreground">Book a professional</h2>
          </div>
          {selected ? <StatusPill label={`${selected.durationMinutes} min`} tone="info" /> : null}
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_22rem]">
          <div className="space-y-4">
            <section className="rounded-md border border-border bg-surface-muted p-3" aria-labelledby="service-catalog-heading">
              <h3 id="service-catalog-heading" className="flex items-center gap-2 text-sm font-semibold text-foreground"><Home className="size-4 text-brand" aria-hidden="true" /> Service catalog</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {categories.map((category) => <StatusPill key={category} label={category} tone="info" />)}
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {(catalog.data?.items ?? []).map((item) => {
                  const active = serviceCode === item.code;
                  return (
                    <button key={item.code} type="button" aria-pressed={active} onClick={() => setServiceCode(item.code)} className={cn("rounded-md border border-border bg-surface p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30", active && "border-delivery bg-delivery/10")}>
                      <span className="text-sm font-semibold text-foreground">{item.name}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{item.description}</span>
                      <span className="mt-2 block text-sm font-semibold text-foreground">Rs {Number(item.price).toFixed(0)}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-md border border-border bg-surface-muted p-3">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground"><MapPin className="size-4 text-ride" aria-hidden="true" /> Service address</p>
              <MapPicker value={address} onChange={setAddress} />
            </section>
          </div>

          <aside className="space-y-4 rounded-md border border-border bg-surface-muted p-4">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><CalendarClock className="size-4 text-brand" aria-hidden="true" /> Slot</p>
              <Input className="mt-2" type="datetime-local" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} />
              <Input className="mt-2" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Access note, issue details" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Payment</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {PAYMENTS.map((method) => <Button key={method} type="button" size="sm" variant={paymentMethod === method ? "primary" : "secondary"} onClick={() => setPaymentMethod(method)}><Wallet className="size-4" aria-hidden="true" /> {method}</Button>)}
              </div>
            </div>
            <div className="rounded-md border border-border bg-surface p-3">
              <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><IndianRupee className="size-4" aria-hidden="true" /> Estimated total</p>
              <p className="mt-1 text-3xl font-semibold text-foreground">Rs {estimate.data ? Number(estimate.data.estimatedFare).toFixed(0) : "--"}</p>
              <p className="mt-1 text-xs text-muted-foreground">{estimate.data ? `${estimate.data.durationMinutes} min scheduled service` : "Pick a service"}</p>
            </div>
            <CancellationPolicyCard serviceType="HOME_SERVICE" />
            <Button type="button" className="w-full" disabled={!estimate.data || createMutation.isPending || !scheduledFor} onClick={() => createMutation.mutate()}>{createMutation.isPending ? "Finding professionals" : "Schedule service"}</Button>
            {createMutation.error ? <p role="status" className="text-sm text-destructive">{createMutation.error instanceof Error ? createMutation.error.message : "Booking failed"}</p> : null}
          </aside>
        </div>
      </section>

      {created ? (
        <section className="rounded-md border border-border bg-surface p-4">
          <StatusPill label="Service scheduled" tone="success" />
          <h3 className="mt-2 text-lg font-semibold text-foreground">Professionals offered: {created.offeredProfessionals}</h3>
          {created.devStartOtp ? <p className="mt-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-foreground">Dev start OTP: {created.devStartOtp}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild><Link href={`/customer/home-services/${created.booking.id}`}>Track booking</Link></Button>
            <Button asChild variant="secondary"><Link href="/customer/home-services">Book another</Link></Button>
          </div>
        </section>
      ) : null}

      <RideMap phase="booking" />
    </div>
  );
}

function defaultSlotValue() {
  const date = new Date(Date.now() + 2 * 60 * 60 * 1000);
  date.setMinutes(0, 0, 0);
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}