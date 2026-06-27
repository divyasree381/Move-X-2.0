"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SelectedLocation } from "@movex/shared";
import { ArrowLeft, CreditCard, FileUp, MapPin, ShieldCheck, Wallet, type LucideIcon } from "lucide-react";

import { MapPicker } from "@/components/location/map-picker";
import { QueryState } from "@/providers/query-state";
import { CancellationPolicyCard } from "@/components/trust";
import { Button, EmptyState, ErrorState, Input, StatusPill } from "@/components/ui";
import { ApiError, checkoutOrder, getCart, uploadCartPrescription, type CheckoutAddress, type CheckoutResponse } from "@/lib/api";

const DEFAULT_LOCATION: SelectedLocation = {
  address: "Bengaluru, Karnataka, India",
  lat: 12.9716,
  lng: 77.5946,
  source: "gps",
};

export function CheckoutPage() {
  const queryClient = useQueryClient();
  const cartQuery = useQuery({ queryKey: ["cart"], queryFn: getCart });
  const [location, setLocation] = useState<SelectedLocation | null>(DEFAULT_LOCATION);
  const [addressLine, setAddressLine] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"WALLET" | "CASH" | "ONLINE">("ONLINE");
  const [idempotencyKey, setIdempotencyKey] = useState(() => createIdempotencyKey());
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutResult, setCheckoutResult] = useState<CheckoutResponse | null>(null);
  const [prescriptionNote, setPrescriptionNote] = useState("");
  const [prescriptionError, setPrescriptionError] = useState<string | null>(null);

  const checkoutMutation = useMutation({
    mutationFn: () => {
      if (!location) {
        throw new Error("Choose a delivery location");
      }

      return checkoutOrder({
        paymentMethod,
        idempotencyKey,
        address: toCheckoutAddress(location, addressLine),
      });
    },
    onMutate: () => setCheckoutError(null),
    onSuccess: (result) => {
      setCheckoutResult(result);
      setIdempotencyKey(createIdempotencyKey());
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (error) => setCheckoutError(error instanceof ApiError || error instanceof Error ? error.message : "Checkout failed"),
  });


  const prescriptionMutation = useMutation({
    mutationFn: async (file: File) => {
      const contentBase64 = await fileToBase64(file);
      return uploadCartPrescription({ fileName: file.name, contentType: file.type || "application/octet-stream", contentBase64, note: prescriptionNote.trim() || undefined });
    },
    onMutate: () => setPrescriptionError(null),
    onSuccess: (nextCart) => {
      queryClient.setQueryData(["cart"], nextCart);
      queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
    onError: (error) => setPrescriptionError(error instanceof Error ? error.message : "Prescription upload failed"),
  });
  const cart = cartQuery.data;
  const hasItems = Boolean(cart?.items.length);
  const unavailableItems = useMemo(() => cart?.items.filter((item) => !item.available) ?? [], [cart]);

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link href="/customer"><ArrowLeft className="size-4" aria-hidden="true" /> Back to stores</Link>
      </Button>

      <QueryState isLoading={cartQuery.isLoading} isError={cartQuery.isError} error={cartQuery.error} onRetry={() => cartQuery.refetch()}>
        {!cart || !hasItems ? (
          <EmptyState title="Your cart is empty" description="Add items from a store before checkout." action={<Button asChild><Link href="/customer">Browse stores</Link></Button>} />
        ) : checkoutResult ? (
          <section className="rounded-md border border-border bg-surface p-5">
            <StatusPill label="Order placed" tone="success" />
            <h2 className="mt-3 text-xl font-semibold text-foreground">Order {checkoutResult.order.id}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {checkoutResult.paymentRequired ? "Online payment is ready for the payment step." : "Your order has been confirmed."}
            </p>
            {checkoutResult.devOtps ? (
              <div className="mt-4 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-foreground">
                <p className="font-semibold">Dev handoff OTPs</p>
                <p className="mt-1 text-muted-foreground">Pickup: {checkoutResult.devOtps.pickup} | Delivery: {checkoutResult.devOtps.delivery}</p>
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild><Link href={`/customer/orders/${checkoutResult.order.id}`}>View order</Link></Button>
              <Button asChild variant="secondary"><Link href="/customer">Continue shopping</Link></Button>
            </div>
          </section>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
            <div className="space-y-4">
              <section className="rounded-md border border-border bg-surface p-4" aria-labelledby="address-heading">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 id="address-heading" className="text-base font-semibold text-foreground">Delivery address</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Pin the map, then add a clear typed address for the partner.</p>
                  </div>
                  <MapPin className="size-5 text-brand" aria-hidden="true" />
                </div>
                <div className="mt-4">
                  <MapPicker value={location} onChange={setLocation} />
                </div>
                <label className="mt-4 block text-sm font-medium text-foreground" htmlFor="address-line">Flat, floor, landmark</label>
                <Input id="address-line" value={addressLine} onChange={(event) => setAddressLine(event.target.value)} placeholder="Apartment, street, landmark" className="mt-2" />
              </section>


              {cart.store?.type === "PHARMACY" ? (
                <section className="rounded-md border border-border bg-surface p-4" aria-labelledby="prescription-heading">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 id="prescription-heading" className="text-base font-semibold text-foreground">Prescription</h2>
                      <p className="mt-1 text-sm text-muted-foreground">Upload before checkout. The pharmacy verifies it before accepting the order.</p>
                    </div>
                    <FileUp className="size-5 text-brand" aria-hidden="true" />
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                    <Input value={prescriptionNote} onChange={(event) => setPrescriptionNote(event.target.value)} placeholder="Optional note for pharmacist" />
                    <label className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-medium text-white focus-within:ring-2 focus-within:ring-ring/30">
                      Upload
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="sr-only"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) {
                            prescriptionMutation.mutate(file);
                          }
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                  </div>
                  {cart.prescription ? <p className="mt-3 text-sm text-muted-foreground">{cart.prescription.files.length} file{cart.prescription.files.length === 1 ? "" : "s"} uploaded. Status: {cart.prescription.status}</p> : <p className="mt-3 text-sm text-warning">Prescription required for pharmacy checkout.</p>}
                  {prescriptionError ? <p className="mt-2 text-sm text-destructive" role="status">{prescriptionError}</p> : null}
                </section>
              ) : null}
              <section className="rounded-md border border-border bg-surface p-4" aria-labelledby="payment-heading">
                <h2 id="payment-heading" className="text-base font-semibold text-foreground">Payment</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <PaymentOption label="Online" value="ONLINE" selected={paymentMethod} onSelect={setPaymentMethod} icon={CreditCard} description="Pay after order creation" />
                  <PaymentOption label="Wallet" value="WALLET" selected={paymentMethod} onSelect={setPaymentMethod} icon={Wallet} description="Uses ledger balance" />
                  <PaymentOption label="Cash" value="CASH" selected={paymentMethod} onSelect={setPaymentMethod} icon={ShieldCheck} description="Pay on delivery" />
                </div>
              </section>

              {unavailableItems.length > 0 ? <ErrorState title="Some items changed" description="Remove unavailable items from the cart before checkout." /> : null}
              {checkoutError ? <ErrorState title="Checkout needs attention" description={checkoutError} action={<Button type="button" variant="secondary" onClick={() => checkoutMutation.mutate()}>Try again</Button>} /> : null}
            </div>

            <aside className="h-fit rounded-md border border-border bg-surface p-4" aria-labelledby="summary-heading">
              <h2 id="summary-heading" className="text-base font-semibold text-foreground">Order summary</h2>
              <div className="mt-4 space-y-3">
                {cart.items.map((item) => (
                  <div key={item.menuItemId} className="flex items-start justify-between gap-3 text-sm">
                    <div>
                      <p className="font-medium text-foreground">{item.name}</p>
                      <p className="text-xs text-muted-foreground">Qty {item.quantity}</p>
                    </div>
                    <p className="font-semibold text-foreground">Rs {Number(item.lineTotal).toFixed(0)}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
                <SummaryRow label="Subtotal" value={cart.pricing.subtotal} />
                <SummaryRow label="Discount" value={cart.pricing.discount} prefix="- " />
                {cart.coupon ? (
                  <div className="rounded-md border border-brand/25 bg-brand/10 p-3 text-xs text-foreground">
                    <p className="font-semibold">{cart.coupon.campaignName ?? cart.coupon.title ?? cart.coupon.code}</p>
                    <p className="mt-1 text-muted-foreground">{cart.coupon.serviceType ? `${cart.coupon.serviceType} campaign` : "MoveX campaign"}</p>
                  </div>
                ) : null}
                <SummaryRow label="Estimated taxes" value={cart.pricing.taxes} />
                <p className="rounded-md border border-delivery/25 bg-delivery/10 p-3 text-xs text-foreground">Earn about {estimatedPoints(cart.pricing.total)} points after delivery.</p>
                <p className="text-xs text-muted-foreground">Delivery fee is finalized after address validation.</p>
                <div className="border-t border-border pt-2">
                  <SummaryRow label="Cart total" value={cart.pricing.total} strong />
                </div>
              </div>
              <CancellationPolicyCard serviceType={cart.store?.type ?? "FOOD"} />
              <Button type="button" className="mt-4 w-full" disabled={checkoutMutation.isPending || unavailableItems.length > 0 || (cart.store?.type === "PHARMACY" && !cart.prescription)} onClick={() => checkoutMutation.mutate()}>
                {checkoutMutation.isPending ? "Placing order" : "Place order"}
              </Button>
            </aside>
          </div>
        )}
      </QueryState>
    </div>
  );
}

function PaymentOption({
  label,
  value,
  selected,
  onSelect,
  icon: Icon,
  description,
}: {
  label: string;
  value: "WALLET" | "CASH" | "ONLINE";
  selected: "WALLET" | "CASH" | "ONLINE";
  onSelect: (value: "WALLET" | "CASH" | "ONLINE") => void;
  icon: LucideIcon;
  description: string;
}) {
  const isSelected = selected === value;

  return (
    <button
      type="button"
      className={isSelected ? "min-h-28 rounded-md border border-brand bg-brand/10 p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30" : "min-h-28 rounded-md border border-border bg-surface-muted p-3 text-left hover:border-brand/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"}
      aria-pressed={isSelected}
      onClick={() => onSelect(value)}
    >
      <Icon className={isSelected ? "size-5 text-brand" : "size-5 text-muted-foreground"} aria-hidden="true" />
      <span className="mt-3 block text-sm font-semibold text-foreground">{label}</span>
      <span className="mt-1 block text-xs text-muted-foreground">{description}</span>
    </button>
  );
}

function estimatedPoints(total: string) {
  return Math.max(0, Math.round(Number(total) * 0.02));
}
function SummaryRow({ label, value, prefix = "", strong = false }: { label: string; value: string; prefix?: string; strong?: boolean }) {
  return (
    <div className={strong ? "flex items-center justify-between font-semibold text-foreground" : "flex items-center justify-between text-muted-foreground"}>
      <span>{label}</span>
      <span>{prefix}Rs {Number(value).toFixed(0)}</span>
    </div>
  );
}

function toCheckoutAddress(location: SelectedLocation, line: string): CheckoutAddress {
  return {
    address: line.trim() ? `${line.trim()}, ${location.address}` : location.address,
    line: line.trim() || undefined,
    placeId: location.placeId,
    lat: location.lat,
    lng: location.lng,
    source: location.source,
  };
}

function createIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.includes(",") ? result.split(",").pop() ?? "" : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}