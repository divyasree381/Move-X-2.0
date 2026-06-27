"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { SelectedLocation } from "@movex/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { IndianRupee, MapPin, PackageCheck, UserRound, Wallet } from "lucide-react";

import { MapPicker } from "@/components/location/map-picker";
import { CancellationPolicyCard } from "@/components/trust";
import { Button, Input, StatusPill } from "@/components/ui";
import { createCourier, estimateCourier, type CourierContactInput, type CourierCreateResponse } from "@/lib/api";
import { RideMap } from "@/components/rides";

const DEFAULT_PICKUP: SelectedLocation = { address: "Indiranagar, Bengaluru", lat: 12.9784, lng: 77.6408, source: "gps" };
const DEFAULT_DROP: SelectedLocation = { address: "Koramangala, Bengaluru", lat: 12.9352, lng: 77.6245, source: "map-click" };
const PAYMENTS = ["CASH", "WALLET", "ONLINE"] as const;

export function CourierBookingPage() {
  const [pickup, setPickup] = useState<SelectedLocation>(DEFAULT_PICKUP);
  const [drop, setDrop] = useState<SelectedLocation>(DEFAULT_DROP);
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENTS)[number]>("CASH");
  const [packageDescription, setPackageDescription] = useState("Documents / small parcel");
  const [packageWeightKg, setPackageWeightKg] = useState("1");
  const [sender, setSender] = useState<CourierContactInput>({ name: "Sender", phone: "+919900000001" });
  const [recipient, setRecipient] = useState<CourierContactInput>({ name: "Recipient", phone: "+919900000002" });
  const [created, setCreated] = useState<CourierCreateResponse | null>(null);

  const weight = Number(packageWeightKg);
  const estimateInput = useMemo(
    () => ({ pickup, drop, packageDescription, packageWeightKg: Number.isFinite(weight) && weight > 0 ? weight : undefined }),
    [drop, packageDescription, pickup, weight],
  );
  const estimate = useQuery({
    queryKey: ["courier-estimate", pickup.lat, pickup.lng, drop.lat, drop.lng, packageDescription, estimateInput.packageWeightKg],
    queryFn: () => estimateCourier(estimateInput),
    enabled: packageDescription.trim().length > 1,
  });
  const createMutation = useMutation({
    mutationFn: () => createCourier({ ...estimateInput, sender, recipient, paymentMethod }),
    onSuccess: setCreated,
  });

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-border bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ride">Courier</p>
            <h2 className="text-xl font-semibold text-foreground">Send a parcel</h2>
          </div>
          {estimate.data ? <StatusPill label={`${estimate.data.durationMinutes} min ETA`} tone="info" /> : null}
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_22rem]">
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <LocationPanel title="Pickup" value={pickup} onChange={setPickup} />
              <LocationPanel title="Drop" value={drop} onChange={setDrop} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <ContactPanel title="Sender" value={sender} onChange={setSender} />
              <ContactPanel title="Recipient" value={recipient} onChange={setRecipient} />
            </div>
          </div>

          <aside className="space-y-4 rounded-md border border-border bg-surface-muted p-4">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><PackageCheck className="size-4 text-brand" aria-hidden="true" /> Parcel</p>
              <Input className="mt-2" value={packageDescription} onChange={(event) => setPackageDescription(event.target.value)} placeholder="Documents, medicines, clothes" />
              <Input className="mt-2" inputMode="decimal" value={packageWeightKg} onChange={(event) => setPackageWeightKg(event.target.value)} placeholder="Weight in kg" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Payment</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {PAYMENTS.map((method) => (
                  <Button key={method} type="button" size="sm" variant={paymentMethod === method ? "primary" : "secondary"} onClick={() => setPaymentMethod(method)}>
                    <Wallet className="size-4" aria-hidden="true" /> {method}
                  </Button>
                ))}
              </div>
            </div>
            <div className="rounded-md border border-border bg-surface p-3">
              <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><IndianRupee className="size-4" aria-hidden="true" /> Estimated fare</p>
              <p className="mt-1 text-3xl font-semibold text-foreground">Rs {estimate.data ? Number(estimate.data.estimatedFare).toFixed(0) : "--"}</p>
              <p className="mt-1 text-xs text-muted-foreground">{estimate.data ? `${estimate.data.distanceKm} km bike courier route` : estimate.isLoading ? "Calculating route" : "Move pins to calculate"}</p>
            </div>
            <CancellationPolicyCard serviceType="COURIER" />
            <Button type="button" className="w-full" disabled={!estimate.data || createMutation.isPending || !sender.name || !recipient.name || !packageDescription.trim()} onClick={() => createMutation.mutate()}>
              {createMutation.isPending ? "Finding partners" : "Request courier"}
            </Button>
            {createMutation.error ? <p role="status" className="text-sm text-destructive">{createMutation.error instanceof Error ? createMutation.error.message : "Courier could not be created"}</p> : null}
          </aside>
        </div>
      </section>

      {created ? (
        <section className="rounded-md border border-border bg-surface p-4">
          <StatusPill label="Courier requested" tone="success" />
          <h3 className="mt-2 text-lg font-semibold text-foreground">Partners offered: {created.offeredPartners}</h3>
          {created.devOtps ? <p className="mt-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-foreground">Dev OTPs: pickup {created.devOtps.pickup} | delivery {created.devOtps.delivery}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild><Link href={`/customer/couriers/${created.courier.id}`}>Track courier</Link></Button>
            <Button asChild variant="secondary"><Link href="/customer/couriers">Send another</Link></Button>
          </div>
        </section>
      ) : null}

      <RideMap phase="booking" />
    </div>
  );
}

function LocationPanel({ title, value, onChange }: { title: string; value: SelectedLocation; onChange: (location: SelectedLocation) => void }) {
  return (
    <section className="rounded-md border border-border bg-surface-muted p-3">
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground"><MapPin className="size-4 text-ride" aria-hidden="true" /> {title}</p>
      <MapPicker value={value} onChange={onChange} />
    </section>
  );
}

function ContactPanel({ title, value, onChange }: { title: string; value: CourierContactInput; onChange: (value: CourierContactInput) => void }) {
  return (
    <section className="rounded-md border border-border bg-surface-muted p-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><UserRound className="size-4 text-brand" aria-hidden="true" /> {title}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Input value={value.name} onChange={(event) => onChange({ ...value, name: event.target.value })} placeholder={`${title} name`} />
        <Input value={value.phone} onChange={(event) => onChange({ ...value, phone: event.target.value })} placeholder="Phone" />
      </div>
      <Input className="mt-2" value={value.note ?? ""} onChange={(event) => onChange({ ...value, note: event.target.value })} placeholder="Optional note" />
    </section>
  );
}