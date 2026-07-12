"use client";

import type { SelectedLocation } from "@movex/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ComponentType, type FormEvent, type ReactNode,
} from "react";
import {
  BadgeCheck,
  Bike,
  ChevronRight,
  ClipboardList,
  Gift,
  Heart,
  Home,
  LifeBuoy,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Mail,
  MapPin,
  Package,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
  WalletCards,
  Wrench,
} from "lucide-react";

import { MapPicker } from "@/components/location/map-picker";
import {
  Button,
  Dialog,
  DialogContent,
  EmptyState,
  ErrorState,
  Input,
  Skeleton,
  StatusPill,
  useToast,
} from "@/components/ui";
import {
  createCustomerAddress,
  createWalletTopUp,
  currentUser,
  deleteCustomerAddress,
  geocodeAddress,
  listCouriers,
  listCustomerAddresses,
  listFavorites,
  listHomeServices,
  listOrders,
  listRides,
  logoutAllSessions,
  retentionSummary,
  updateCustomerAddress,
  updateCustomerProfile,
  type AuthUser,
  type CustomerAddress,
  type CustomerAddressInput,
} from "@/lib/api";
import { beginOnlinePayment } from "@/lib/payment-checkout";
import { cn } from "@/lib/utils";

const sectionLinks = [
  { id: "personal", label: "Personal details", icon: UserRound },
  { id: "addresses", label: "Saved addresses", icon: MapPin },
  { id: "activity", label: "Your activity", icon: ClipboardList },
  { id: "rewards", label: "Wallet and rewards", icon: Gift },
  { id: "favorites", label: "Favorites", icon: Heart },
  { id: "help", label: "Help and safety", icon: LifeBuoy },
  { id: "security", label: "Account security", icon: LockKeyhole },
] as const;

const emptyAddressDraft: AddressDraft = {
  id: null,
  line: "",
  city: "",
  state: "",
  pincode: "",
  isDefault: false,
  location: null,
};

export function CustomerAccountPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [profileOpen, setProfileOpen] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("500");
  const [showAddressMap, setShowAddressMap] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: "", email: "", avatarUrl: "" });
  const [addressDraft, setAddressDraft] = useState<AddressDraft>(emptyAddressDraft);
  const topUp = useMutation({
    mutationFn: async () => {
      const amount = Number(topUpAmount);
      if (!Number.isFinite(amount) || amount < 10) throw new Error("Enter an amount of at least Rs 10");
      const reference = await createWalletTopUp({ amount, idempotencyKey: crypto.randomUUID() });
      await beginOnlinePayment("WALLET_TOPUP", reference.id);
      return reference;
    },
    onSuccess: () => {
      setTopUpOpen(false);
      queryClient.invalidateQueries({ queryKey: ["retention-summary"] });
      toast({ kind: "success", title: "Wallet top-up submitted", description: "Your balance updates after payment confirmation." });
    },
  });

  const me = useQuery({ queryKey: ["auth-me"], queryFn: currentUser, retry: false });
  const authenticated = Boolean(me.data?.user);
  const user = me.data?.user;
  const addresses = useQuery({ queryKey: ["customer-addresses"], queryFn: listCustomerAddresses, enabled: authenticated, retry: false,
  });
  const retention = useQuery({ queryKey: ["retention-summary"], queryFn: retentionSummary, enabled: authenticated, retry: false,
  });
  const favorites = useQuery({ queryKey: ["favorites", "profile"], queryFn: () => listFavorites(), enabled: authenticated, retry: false,
  });
  const orders = useQuery({ queryKey: ["orders", "profile-summary"], queryFn: () => listOrders({ limit: 5 }), enabled: authenticated, retry: false,
  });
  const rides = useQuery({ queryKey: ["rides", "profile-summary"], queryFn: () => listRides({ limit: 5 }), enabled: authenticated, retry: false,
  });
  const couriers = useQuery({ queryKey: ["couriers", "profile-summary"], queryFn: () => listCouriers({ limit: 5 }), enabled: authenticated, retry: false,
  });
  const homeServices = useQuery({ queryKey: ["home-services", "profile-summary"], queryFn: () => listHomeServices({ limit: 5 }), enabled: authenticated, retry: false,
  });

  useEffect(() => {
    if (!user) return;
    setProfileForm({ name: user.name ?? "", email: user.email ?? "", avatarUrl: user.avatarUrl ?? "",
    });
  }, [user]);

  const updateProfile = useMutation({
    mutationFn: () => updateCustomerProfile({
      name: profileForm.name.trim() || undefined,
      email: profileForm.email.trim() || undefined,
      avatarUrl: profileForm.avatarUrl.trim() || undefined,
    }),
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(["auth-me"], { user: updatedUser });
      setProfileOpen(false);
      toast({ kind: "success", title: "Profile updated", description: "Your MoveX account details are current.",
      });
    },
  });

  const saveAddress = useMutation({
    mutationFn: async () => {
      const location = addressDraft.location ??
        (await geocodeAddress([addressDraft.line, addressDraft.city, addressDraft.state, addressDraft.pincode].filter(Boolean).join(", "),
        ));
      const input: CustomerAddressInput = {
        line: addressDraft.line.trim() || location.address,
        city: addressDraft.city.trim(),
        state: addressDraft.state.trim(),
        pincode: addressDraft.pincode.trim(),
        lat: location.lat,
        lng: location.lng,
        isDefault: addressDraft.isDefault,
      };
      return addressDraft.id ? updateCustomerAddress(addressDraft.id, input) : createCustomerAddress(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-addresses"] });
      setAddressOpen(false);
      setShowAddressMap(false);
      toast({ kind: "success", title: addressDraft.id ? "Address updated" : "Address saved", description: "This location is ready for delivery and service bookings.",
      });
    },
  });

  const setDefaultAddress = useMutation({
    mutationFn: (addressId: string) => updateCustomerAddress(addressId, { isDefault: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-addresses"] });
      toast({ kind: "success", title: "Default address changed" });
    },
  });

  const removeAddress = useMutation({
    mutationFn: deleteCustomerAddress,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-addresses"] });
      toast({ kind: "success", title: "Address removed" });
    },
  });

  const logoutEverywhere = useMutation({
    mutationFn: logoutAllSessions,
    onSuccess: () => {
      queryClient.clear();
      router.replace("/");
      router.refresh();
    },
  });

  const activity = useMemo(() => [
    { label: "Orders", description: "Food, grocery, and pharmacy", href: "/customer/orders", icon: ClipboardList, count: queryCount(orders.data?.items, orders.isLoading, Boolean(orders.data?.nextCursor)),
      },
    { label: "Rides", description: "Bike, auto, and cab trips", href: "/customer/rides", icon: Bike, count: queryCount(rides.data?.items, rides.isLoading, Boolean(rides.data?.nextCursor)),
      },
    { label: "Courier", description: "Parcel pickups and deliveries", href: "/customer/couriers", icon: Package, count: queryCount(couriers.data?.items, couriers.isLoading, Boolean(couriers.data?.nextCursor),
        ),
      },
    { label: "Home services", description: "Scheduled professional visits", href: "/customer/home-services", icon: Wrench, count: queryCount(homeServices.data?.items, homeServices.isLoading, Boolean(homeServices.data?.nextCursor),
        ),
      },
  ], [couriers.data?.items, couriers.isLoading, homeServices.data?.items, homeServices.isLoading, orders.data?.items, orders.isLoading, rides.data?.items, rides.isLoading,
    ],
  );

  function openNewAddress() {
    setAddressDraft(emptyAddressDraft);
    setShowAddressMap(false);
    setAddressOpen(true);
  }

  function openExistingAddress(address: CustomerAddress) {
    setAddressDraft({
      id: address.id,
      line: address.line,
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      isDefault: address.isDefault,
      location: { address: [address.line, address.city, address.state, address.pincode].filter(Boolean).join(", "), lat: Number(address.lat), lng: Number(address.lng), source: "map-click",
      },
    });
    setShowAddressMap(false);
    setAddressOpen(true);
  }

  if (me.isLoading) return <AccountSkeleton />;

  if (!user) {
    return (
      <ErrorState
        title="Sign in to view your account"
        description="Your profile, addresses, rewards, and service history are protected by your MoveX session."
        action={<Button asChild><Link href="/login/customer">Customer login</Link></Button>}
      />
    );
  }

  return (
    <div className="space-y-5">
      <ProfileHeader user={user} onEdit={() => setProfileOpen(true)} />

      <div className="grid items-start gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="sticky top-20 hidden rounded-lg border border-border bg-surface p-2 shadow-sm lg:block">
          <nav aria-label="Account sections">
            {sectionLinks.map((item) => (
              <a key={item.id} href={`#${item.id}`} className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
                <item.icon className="size-4" aria-hidden={true} />{item.label}
              </a>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
          <AccountSection id="personal" eyebrow="Account" title="Personal details" action={<Button type="button" variant="secondary" size="sm" onClick={() => setProfileOpen(true)}><Pencil className="size-4" aria-hidden={true} />Edit</Button>}>
            <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <Detail label="Full name" value={user.name || "Add your name"} icon={UserRound} />
              <Detail label="Phone number" value={user.phoneE164 || "Not available"} icon={BadgeCheck} note={user.phoneE164 ? "Verified with OTP" : undefined} />
              <Detail label="Email" value={user.email || "Add an email address"} icon={Mail} />
              <Detail label="Member since" value={formatDate(user.createdAt)} icon={ShieldCheck} />
            </div>
          </AccountSection>

          <AccountSection id="addresses" eyebrow="Delivery" title="Saved addresses" action={<Button type="button" size="sm" onClick={openNewAddress}><Plus className="size-4" aria-hidden={true} />Add address</Button>}>
            {addresses.isLoading ? (
              <div className="grid gap-3 sm:grid-cols-2"><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
            ) : null}
            {addresses.isError ? (
              <ErrorState title="Addresses could not be loaded" description="Please check your connection and try again." action={<Button type="button" variant="secondary" onClick={() => addresses.refetch()}>Retry</Button>} />
            ) : null}
            {!addresses.isLoading && !addresses.isError && (addresses.data?.length ?? 0) === 0 ? (
              <EmptyState title="No saved addresses" description="Add home, work, or another delivery location." action={<Button type="button" onClick={openNewAddress}>Add your first address</Button>} />
            ) : null}
            {(addresses.data?.length ?? 0) > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {addresses.data?.map((address) => (
                  <article key={address.id} className="rounded-lg border border-border bg-background p-4">
                    <div className="flex items-start gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"><Home className="size-5" aria-hidden={true} /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold text-foreground">{address.isDefault ? "Default address" : address.city}</h3>
                          {address.isDefault ? <StatusPill label="Default" tone="success" /> : null}
                        </div>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">{address.line}, {address.city}, {address.state} {address.pincode}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
                      <Button type="button" variant="ghost" size="sm" onClick={() => openExistingAddress(address)}><Pencil className="size-4" aria-hidden={true} />Edit</Button>
                      {!address.isDefault ? (
                        <Button type="button" variant="ghost" size="sm" disabled={setDefaultAddress.isPending} onClick={() => setDefaultAddress.mutate(address.id)}>Make default</Button>
                      ) : null}
                      <Button type="button" variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" disabled={removeAddress.isPending} onClick={() => { if (window.confirm("Remove this saved address?")) removeAddress.mutate(address.id); }}><Trash2 className="size-4" aria-hidden={true} />Remove</Button>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </AccountSection>

          <AccountSection id="activity" eyebrow="History" title="Your MoveX activity">
            <div className="grid gap-2 sm:grid-cols-2">
              {activity.map((item) => (
                <AccountLink key={item.label} {...item} />))}
            </div>
          </AccountSection>

          <AccountSection id="rewards" eyebrow="Benefits" title="Wallet and rewards">
            <div className="mb-4 flex justify-end"><Button type="button" size="sm" onClick={() => setTopUpOpen(true)}><Plus className="size-4" aria-hidden="true" /> Add money</Button></div>
            {retention.isLoading ? (
              <div className="grid gap-3 sm:grid-cols-4"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
            ) : null}
            {retention.isError ? (
              <ErrorState title="Benefits are temporarily unavailable" description="We could not load your balance and rewards. Please try again shortly." />
            ) : null}
            {retention.data ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <RewardMetric icon={WalletCards} label="Wallet" value={formatMoney(retention.data.walletBalance)} />
                <RewardMetric icon={Gift} label="Loyalty points" value={retention.data.loyaltyPoints} />
                <RewardMetric icon={BadgeCheck} label="Referral credits" value={formatMoney(retention.data.referralCredits)} />
                <RewardMetric icon={UserRound} label="Friends joined" value={String(retention.data.referralsMade)} />
              </div>
            ) : null}
            {retention.data?.referralCode ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-warning/30 bg-warning/10 p-3"><div><p className="text-xs font-medium text-muted-foreground">Your referral code</p><p className="mt-1 font-semibold text-foreground">{retention.data.referralCode}</p></div><StatusPill label="Ready to share" tone="warning" /></div>
            ) : null}
          </AccountSection>

          <Dialog open={topUpOpen} onOpenChange={setTopUpOpen}>
            <DialogContent title="Add money to wallet" description="Choose an amount and complete secure online payment.">
              <label className="block text-sm font-medium text-foreground" htmlFor="wallet-top-up">Amount</label>
              <Input id="wallet-top-up" type="number" min="10" max="100000" step="1" value={topUpAmount} onChange={(event) => setTopUpAmount(event.target.value)} className="mt-2" />
              {topUp.error ? <p className="mt-2 text-sm text-destructive" role="status">{topUp.error instanceof Error ? topUp.error.message : "Top-up failed"}</p> : null}
              <div className="mt-4 flex justify-end gap-2"><Button variant="secondary" onClick={() => setTopUpOpen(false)}>Cancel</Button><Button disabled={topUp.isPending} onClick={() => topUp.mutate()}>{topUp.isPending ? "Opening payment" : "Continue"}</Button></div>
            </DialogContent>
          </Dialog>

          <AccountSection id="favorites" eyebrow="Saved" title="Favorites">
            {favorites.isLoading ? (
              <div className="grid gap-3 sm:grid-cols-2"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
            ) : null}
            {favorites.isError ? (
              <ErrorState title="Favorites could not be loaded" description="Try again after checking your connection." />
            ) : null}
            {!favorites.isLoading && !favorites.isError && (favorites.data?.items.length ?? 0) === 0 ? (
              <EmptyState title="Nothing saved yet" description="Favorite stores and items will appear here for quick repeat orders." action={<Button asChild variant="secondary"><Link href="/stores">Browse stores</Link></Button>} />
            ) : null}
            {(favorites.data?.items.length ?? 0) > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {favorites.data?.items.slice(0, 6).map((favorite) => {
                  const imageUrl = favorite.store?.imageUrl ?? favorite.menuItem?.imageUrl;
                  const title = favorite.store?.name ?? favorite.menuItem?.name ?? "Saved item";
                  const subtitle = favorite.store?.type ?? favorite.menuItem?.store.name ?? favorite.type;
                  const href = favorite.store ? `/customer/stores/${favorite.store.id}` : favorite.menuItem ? `/customer/stores/${favorite.menuItem.store.id}` : "/customer";
                  return (
                    <Link key={favorite.id} href={href} className="group flex min-h-20 items-center gap-3 rounded-lg border border-border bg-background p-3 transition hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
                      <span className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-md bg-surface-muted text-destructive">
                        {imageUrl ? (
                          <Image src={imageUrl} alt="" fill unoptimized sizes="56px" className="object-cover" />
                        ) : (
                          <Heart className="size-5" aria-hidden={true} />
                        )}
                      </span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-foreground">{title}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{subtitle}</span></span>
                      <ChevronRight className="size-4 text-muted-foreground transition group-hover:translate-x-0.5" aria-hidden={true} />
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </AccountSection>

          <AccountSection id="help" eyebrow="Care" title="Help and safety">
            <div className="grid gap-2 sm:grid-cols-2">
              <AccountLink label="Get help" description="Orders, rides, payments, or account support" href="/support" icon={LifeBuoy} />
              <AccountLink label="Orders and refunds" description="Review delivery status and payment outcomes" href="/customer/orders" icon={ClipboardList} />
              <AccountLink label="Ride safety" description="Trip details, driver information, and support" href="/customer/rides" icon={ShieldCheck} />
              <AccountLink label="Terms and policies" description="Privacy, cancellations, and service disclaimers" href="/about" icon={LockKeyhole} />
            </div>
          </AccountSection>

          <AccountSection id="security" eyebrow="Security" title="Account access">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-xl"><p className="text-sm font-semibold text-foreground">Sign out from every device</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Revokes every active MoveX session, including this browser. Use this if a device is lost or account access looks unfamiliar.</p></div>
              <Button type="button" variant="destructive" disabled={logoutEverywhere.isPending} onClick={() => { if (window.confirm("Log out of MoveX on every device?")) logoutEverywhere.mutate(); }}>
                {logoutEverywhere.isPending ? (
                  <LoaderCircle className="size-4 animate-spin" aria-hidden={true} />
                ) : (
                  <LogOut className="size-4" aria-hidden={true} />
                )}Log out all
              </Button>
            </div>
            {logoutEverywhere.error ? (
              <p className="mt-3 text-sm text-destructive" role="status">{logoutEverywhere.error instanceof Error ? logoutEverywhere.error.message : "Could not revoke sessions."}</p>
            ) : null}
          </AccountSection>
        </div>
      </div>

      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} form={profileForm} onFormChange={setProfileForm} pending={updateProfile.isPending} error={updateProfile.error} onSubmit={() => updateProfile.mutate()} />
      <AddressDialog open={addressOpen} onOpenChange={setAddressOpen} draft={addressDraft} onDraftChange={setAddressDraft} showMap={showAddressMap} onShowMapChange={setShowAddressMap} pending={saveAddress.isPending} error={saveAddress.error} onSubmit={() => saveAddress.mutate()} />
    </div>
  );
}

function ProfileHeader({ user, onEdit }: { user: AuthUser; onEdit: () => void }) {
  const name = user.name || "MoveX customer";
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
      <div className="h-20 bg-primary" aria-hidden={true} />
      <div className="flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-end gap-4">
          <span className="relative -mt-10 grid size-24 shrink-0 place-items-center overflow-hidden rounded-lg border-4 border-surface bg-primary text-3xl font-semibold text-primary-foreground shadow-sm">
            {user.avatarUrl ? (
              <Image src={user.avatarUrl} alt={`${name} profile`} fill unoptimized sizes="96px" className="object-cover" />
            ) : (
              initials(name)
            )}
          </span>
          <div className="min-w-0 pb-1">
            <div className="flex flex-wrap items-center gap-2"><h1 className="truncate text-2xl font-semibold text-foreground">{name}</h1><StatusPill label="Customer" tone="success" /></div>
            <p className="mt-1 truncate text-sm text-muted-foreground">{user.phoneE164 ?? user.email ?? "MoveX account"}</p>
          </div>
        </div>
        <Button type="button" variant="secondary" onClick={onEdit}><Pencil className="size-4" aria-hidden={true} />Edit profile</Button>
      </div>
    </section>
  );
}

function AccountSection({ id, eyebrow, title, action, children,
}: { id: string; eyebrow: string; title: string; action?: ReactNode; children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-b border-border p-5 last:border-b-0 sm:p-6" aria-labelledby={`${id}-heading`}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase text-primary">{eyebrow}</p><h2 id={`${id}-heading`} className="mt-1 text-xl font-semibold text-foreground">{title}</h2></div>{action}</div>
      {children}
    </section>
  );
}

function Detail({ label, value, icon: Icon, note,
}: { label: string; value: string; icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>; note?: string;
}) {
  return (
    <div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-md bg-surface-muted text-primary"><Icon className="size-4" aria-hidden={true} /></span><div className="min-w-0"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 break-words text-sm font-semibold text-foreground">{value}</p>{note ? <p className="mt-1 text-xs text-success">{note}</p> : null}</div></div>
  );
}

function AccountLink({ label, description, href, icon: Icon, count,
}: { label: string; description: string; href: string; icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>; count?: string;
}) {
  return (
    <Link href={href} className="group flex min-h-20 items-center gap-3 rounded-lg border border-border bg-background p-3 transition hover:border-primary/40 hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
      <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"><Icon className="size-5" aria-hidden={true} /></span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-foreground">{label}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span></span>
      {count ? (
        <span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-semibold text-foreground">{count}</span>
      ) : null}<ChevronRight className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" aria-hidden={true} />
    </Link>
  );
}

function RewardMetric({ icon: Icon, label, value,
}: { icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>; label: string; value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-4"><Icon className="size-5 text-primary" aria-hidden={true} /><p className="mt-3 text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold text-foreground">{value}</p></div>
  );
}

function ProfileDialog({ open, onOpenChange, form, onFormChange, pending, error, onSubmit,
}: { open: boolean; onOpenChange: (open: boolean) => void; form: ProfileForm; onFormChange: (form: ProfileForm) => void; pending: boolean; error: Error | null; onSubmit: () => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); onSubmit(); }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Edit profile" description="Keep your customer details accurate for deliveries, invoices, and support.">
        <form className="mt-5 space-y-4" onSubmit={submit}>
          <Field label="Full name"><Input value={form.name} onChange={(event) => onFormChange({ ...form, name: event.target.value })} maxLength={120} placeholder="Your full name" /></Field>
          <Field label="Email address"><Input type="email" value={form.email} onChange={(event) => onFormChange({ ...form, email: event.target.value })} placeholder="you@example.com" /></Field>
          {error ? (
            <p className="text-sm text-destructive" role="status">{error.message}</p>
          ) : null}
          <div className="flex justify-end gap-2 border-t border-border pt-4"><Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={pending}>{pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden={true} /> : null}Save profile</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddressDialog({ open, onOpenChange, draft, onDraftChange, showMap, onShowMapChange, pending, error, onSubmit,
}: { open: boolean; onOpenChange: (open: boolean) => void; draft: AddressDraft; onDraftChange: (draft: AddressDraft) => void; showMap: boolean; onShowMapChange: (show: boolean) => void; pending: boolean; error: Error | null; onSubmit: () => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); onSubmit(); }
  function selectLocation(location: SelectedLocation) { onDraftChange({ ...draft, line: draft.line.trim() ? draft.line : location.address, location }); }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] max-w-5xl overflow-y-auto" title={draft.id ? "Edit saved address" : "Add a saved address"} description="The map pin is the delivery source of truth; the written address helps the partner find the entrance.">
        <form className="mt-5" onSubmit={submit}>
          <div className={cn("grid gap-5", showMap && "lg:grid-cols-[0.8fr_1.2fr]")}>
            <div className="space-y-4">
              <Field label="Address line"><Input required maxLength={240} value={draft.line} onChange={(event) => onDraftChange({ ...draft, line: event.target.value })} placeholder="Building, street, area" /></Field>
              <div className="grid grid-cols-2 gap-3"><Field label="City"><Input required maxLength={80} value={draft.city} onChange={(event) => onDraftChange({ ...draft, city: event.target.value })} /></Field><Field label="State"><Input required maxLength={80} value={draft.state} onChange={(event) => onDraftChange({ ...draft, state: event.target.value })} /></Field></div>
              <Field label="Pincode"><Input required inputMode="numeric" maxLength={12} value={draft.pincode} onChange={(event) => onDraftChange({ ...draft, pincode: event.target.value })} /></Field>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground"><input type="checkbox" className="size-4 accent-primary" checked={draft.isDefault} onChange={(event) => onDraftChange({ ...draft, isDefault: event.target.checked })} />Use as my default address</label>
              <Button type="button" variant="secondary" className="w-full" onClick={() => onShowMapChange(!showMap)}><MapPin className="size-4" aria-hidden={true} />{showMap ? "Hide map" : draft.location ? "Refine map pin" : "Choose exact location on map"}</Button>
              {draft.location ? (
                <p className="rounded-md border border-success/30 bg-success/10 p-3 text-xs leading-5 text-foreground"><span className="font-semibold text-success">Map pin selected.</span> {" "}
                  {draft.location.address}</p>
              ) : null}
            </div>
            {showMap ? (
              <MapPicker value={draft.location} onChange={selectLocation} showAdvancedControls={false} />
            ) : null}
          </div>
          {error ? (
            <p className="mt-4 text-sm text-destructive" role="status">{error.message}</p>
          ) : null}
          <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4"><Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={pending}>{pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden={true} /> : null}{draft.id ? "Save changes" : "Save address"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, note, children }: { label: string; note?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5 text-sm font-medium text-foreground"><span>{label}</span>{children}{note ? (
        <span className="block text-xs font-normal leading-5 text-muted-foreground">{note}</span>
      ) : null}</label>
  );
}

function AccountSkeleton() {
  return (
    <div className="space-y-5"><Skeleton className="h-44" /><div className="grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]"><Skeleton className="hidden h-80 lg:block" /><div className="space-y-1 overflow-hidden rounded-lg border border-border bg-surface p-6"><Skeleton className="h-8 w-48" /><Skeleton className="mt-6 h-28" /><Skeleton className="mt-6 h-40" /></div></div></div>
  );
}

function queryCount(items: unknown[] | undefined, loading: boolean, hasMore: boolean) { return loading ? "..." : items ? `${items.length}${hasMore ? "+" : ""}` : "--"; }
function formatMoney(value: string | undefined) { return `Rs ${Number(value ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`; }
function formatDate(value?: string) { return value ? new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" }).format(new Date(value)) : "Account active"; }
function initials(name: string) { return (
    name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "M"
  ); }

type ProfileForm = { name: string; email: string; avatarUrl: string };
type AddressDraft = { id: string | null; line: string; city: string; state: string; pincode: string; isDefault: boolean; location: SelectedLocation | null;
};
