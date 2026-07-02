import Link from "next/link";
import { ArrowRight, Bike, Building2, CheckCircle2, ChevronRight, Clock3, Headphones, Home, IndianRupee, LocateFixed, MapPin, Package, Pill, Search, ShoppingBasket, Sparkles, Star, Store, Truck, Utensils, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { dietaryLabels, resolveDietaryType, type DietaryType } from "@/lib/dietary";
import { findPublicStore, heroImageUrl, isPublicStoreType, partnerTracks, publicOffers, publicServices, publicStores, rideOptions, storesByType, type PublicOffer, type PublicService, type PublicStore, type PublicStoreType } from "@/lib/public-site-data";

const navItems = [
  { label: "Home", href: "/", key: "home" },
  { label: "Stores", href: "/stores", key: "stores" },
  { label: "Rides", href: "/rides", key: "rides" },
  { label: "Offers", href: "/offers", key: "offers" },
  { label: "Partner", href: "/partner", key: "partner" },
  { label: "Get Help", href: "/support", key: "support" },
  { label: "About", href: "/about", key: "about" },
] as const;

type PublicNavKey = (typeof navItems)[number]["key"];

const serviceIcons: Record<string, LucideIcon> = {
  food: Utensils,
  grocery: ShoppingBasket,
  pharmacy: Pill,
  rides: Bike,
  courier: Package,
  home: Home,
};

const storeTone: Record<PublicStoreType, string> = {
  FOOD: "bg-food-soft text-food",
  GROCERY: "bg-grocery-soft text-grocery",
  PHARMACY: "bg-pharmacy-soft text-pharmacy",
};

const storeLabel: Record<PublicStoreType, string> = {
  FOOD: "Food",
  GROCERY: "Grocery",
  PHARMACY: "Pharmacy",
};

const offerIcons: Record<PublicOffer["service"], LucideIcon> = {
  Food: Utensils,
  Grocery: ShoppingBasket,
  Pharmacy: Pill,
  Rides: Bike,
  Courier: Package,
  "Home services": Home,
};

const offerTone: Record<PublicOffer["service"], string> = {
  Food: "bg-food-soft text-food",
  Grocery: "bg-grocery-soft text-grocery",
  Pharmacy: "bg-pharmacy-soft text-pharmacy",
  Rides: "bg-ride-soft text-ride",
  Courier: "bg-courier-soft text-courier",
  "Home services": "bg-home-services-soft text-home-services",
};

const dietaryTone: Record<DietaryType, string> = {
  VEG: "border-success/35 bg-success/10 text-success",
  NON_VEG: "border-destructive/35 bg-destructive/10 text-destructive",
  EGG: "border-warning/35 bg-warning/10 text-warning",
};

export function PublicSiteShell({ active, children }: { active?: PublicNavKey; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/92 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30" aria-label="MoveX home">
            <LogoMark />
            <div className="hidden sm:block">
              <p className="text-base font-medium leading-none">MoveX</p>
              <p className="mt-1 text-xs text-muted-foreground">Delivery, rides, services</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Public navigation">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className={cn("rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30", active === item.key && "bg-surface-muted text-foreground")}>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/customer">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      {children}

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.3fr_0.7fr_0.7fr_0.7fr] lg:px-8">
          <div>
            <div className="flex items-center gap-3">
              <LogoMark />
              <div>
                <p className="text-lg font-medium">MoveX</p>
                <p className="text-sm text-muted-foreground">One account. Every vertical.</p>
              </div>
            </div>
            <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">A multi-vertical local-services platform for food, grocery, pharmacy, mobility, courier, and home services.</p>
          </div>
          <FooterColumn title="Company" links={[{ label: "About", href: "/about" }, { label: "Partner", href: "/partner" }, { label: "Get Help", href: "/support" }]} />
          <FooterColumn title="Services" links={[{ label: "Stores", href: "/stores" }, { label: "Rides", href: "/rides" }, { label: "Offers", href: "/offers" }]} />
          <FooterColumn title="Apps" links={[{ label: "Customer", href: "/customer" }, { label: "Partner dashboard", href: "/partner/dashboard" }, { label: "Ops console", href: "/ops" }]} />
        </div>
      </footer>
    </div>
  );
}

export function PublicHomePage() {
  const featuredStores = publicStores.slice(0, 4);

  return (
    <PublicSiteShell active="home">
      <section className="relative overflow-hidden bg-primary text-white">
        <img src={heroImageUrl} alt="MoveX delivery, mobility, and local services" className="absolute inset-0 size-full object-cover object-center" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,23,0.82)_0%,rgba(2,6,23,0.58)_48%,rgba(2,6,23,0.22)_100%)]" aria-hidden={true} />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.42)_0%,rgba(2,6,23,0)_44%,rgba(2,6,23,0.34)_100%)]" aria-hidden={true} />
        <div className="relative mx-auto flex min-h-[34rem] max-w-7xl items-center px-4 pb-24 pt-20 sm:px-6 sm:pb-24 sm:pt-24 lg:min-h-[36rem] lg:px-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/10 px-3 py-1.5 text-sm font-medium text-white backdrop-blur">
              <Sparkles className="size-4 text-accent" aria-hidden={true} />
              One MoveX account for the whole city
            </div>
            <h1 className="mt-6 max-w-3xl text-4xl font-medium leading-[1.04] tracking-normal text-white sm:text-5xl lg:text-6xl">Get food, rides, essentials, and help nearby.</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/78 sm:text-lg">Food, grocery, pharmacy, rides, courier, and home services come together in one location-first customer experience.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="min-h-12 px-6">
                <Link href="/stores"><Search className="size-4" aria-hidden={true} /> Explore stores</Link>
              </Button>
              <Button asChild size="lg" variant="secondary" className="min-h-12 border-white/25 bg-white/10 px-6 text-white hover:bg-white/15">
                <Link href="/rides"><Bike className="size-4" aria-hidden={true} /> Book a ride</Link>
              </Button>
            </div>
            <div className="mt-8 flex max-w-2xl flex-wrap gap-2">
              {publicServices.map((service) => {
                const Icon = serviceIcons[service.id] ?? Sparkles;

                return (
                  <Link key={service.id} href={service.href} className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/86 backdrop-blur transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35">
                    <Icon className="size-3.5" aria-hidden={true} />
                    {service.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <main>
        <section className="relative z-10 mx-auto -mt-12 max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-3 rounded-lg border border-border bg-surface p-3 shadow-[var(--shadow-shell)] md:grid-cols-[1fr_1fr_auto] md:items-center">
            <div className="flex items-center gap-3 rounded-md bg-surface-muted px-3 py-3">
              <LocateFixed className="size-5 text-primary" aria-hidden={true} />
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Browsing around</p>
                <p className="text-sm font-medium">Indiranagar, Bengaluru</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-md bg-surface-muted px-3 py-3">
              <Clock3 className="size-5 text-primary" aria-hidden={true} />
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Fastest promise</p>
                <p className="text-sm font-medium">12 min pharmacy dispatch</p>
              </div>
            </div>
            <Button asChild className="min-h-12 px-6">
              <Link href="/login">Set location</Link>
            </Button>
          </div>
        </section>
        <Section eyebrow="Services" title="Choose one vertical now. Discover the rest when you need them." description="The public site mirrors the old MoveX service discovery flow while connecting into the new authenticated app when a user is ready to order.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {publicServices.map((service) => <ServiceCard key={service.id} service={service} />)}
          </div>
        </Section>

        <section className="bg-surface-muted py-14 sm:py-16">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
            <div>
              <p className="text-sm font-medium text-primary">Mobility preview</p>
              <h2 className="mt-2 text-3xl font-medium tracking-normal sm:text-4xl">Compare ride options before you sign in.</h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">The public rides page gives customers a clear price and vehicle preview, then moves them into the secure booking flow.</p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Button asChild><Link href="/rides">See ride options</Link></Button>
                <Button asChild variant="secondary"><Link href="/customer/rides">Open ride app</Link></Button>
              </div>
            </div>
            <RideFarePanel />
          </div>
        </section>

        <Section eyebrow="Marketplace" title="Popular stores near you" description="Food, grocery, and pharmacy reuse the same catalog and fulfillment spine behind the scenes.">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {featuredStores.map((store) => <PublicStoreCard key={store.id} store={store} compact />)}
          </div>
        </Section>

        <section className="border-y border-border bg-primary py-14 text-primary-foreground sm:py-16">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_1fr] lg:items-center lg:px-8">
            <div>
              <p className="text-sm font-medium text-primary-foreground/76">Partner network</p>
              <h2 className="mt-2 text-3xl font-medium tracking-normal sm:text-4xl">Stores, drivers, and service professionals operate from one queue.</h2>
              <p className="mt-4 text-base leading-7 text-primary-foreground/76">MoveX keeps partner flows connected to orders, rides, courier jobs, home-service bookings, ledger entries, and payouts.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {partnerTracks.map((track) => (
                <Link key={track.title} href="/partner" className="rounded-lg border border-primary-foreground/16 bg-primary-foreground/10 p-4 transition hover:-translate-y-0.5 hover:bg-primary-foreground/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/35">
                  <p className="text-sm font-medium">{track.title}</p>
                  <p className="mt-3 text-xs leading-5 text-primary-foreground/72">{track.metrics}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <Section eyebrow="Offers" title="Launch perks coming soon" description="A frontend preview of the benefits MoveX can unlock across food, rides, grocery, pharmacy, and home services.">
          <div className="grid gap-4 md:grid-cols-3">
            {publicOffers.slice(0, 3).map((offer) => <OfferCard key={offer.id} offer={offer} />)}
          </div>
        </Section>
      </main>
    </PublicSiteShell>
  );
}

export function PublicStoresPage({ selectedType }: { selectedType?: PublicStoreType }) {
  const stores = storesByType(selectedType);

  return (
    <PublicSiteShell active="stores">
      <PageHeader eyebrow="Marketplace" title="Browse food, grocery, and pharmacy stores" description="The public store directory keeps the old MoveX browsing flow alive while the authenticated checkout runs through the new customer app." />
      <main className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-wrap gap-2">
          <FilterChip href="/stores" label="All stores" active={!selectedType} />
          <FilterChip href="/stores?type=FOOD" label="Food" active={selectedType === "FOOD"} />
          <FilterChip href="/stores?type=GROCERY" label="Grocery" active={selectedType === "GROCERY"} />
          <FilterChip href="/stores?type=PHARMACY" label="Pharmacy" active={selectedType === "PHARMACY"} />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {stores.map((store) => <PublicStoreCard key={store.id} store={store} />)}
        </div>
      </main>
    </PublicSiteShell>
  );
}

export function PublicStoreDetailPage({ storeId }: { storeId: string }) {
  const store = findPublicStore(storeId);

  if (!store) {
    return null;
  }

  const sections = [...new Set(store.menu.map((item) => item.section))];

  return (
    <PublicSiteShell active="stores">
      <main>
        <section className="relative min-h-[28rem] overflow-hidden bg-surface text-white">
          <img src={store.imageUrl} alt="" className="absolute inset-0 size-full object-cover" />
          <div className="absolute inset-0 bg-slate-950/68" aria-hidden={true} />
          <div className="relative mx-auto flex min-h-[28rem] max-w-7xl flex-col justify-end px-4 py-10 sm:px-6 lg:px-8">
            <Link href="/stores" className="mb-6 inline-flex w-fit items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm font-medium text-white/85 transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40">
              Back to stores
            </Link>
            <span className={cn("w-fit rounded-full px-3 py-1 text-xs font-medium", storeTone[store.type])}>{storeLabel[store.type]}</span>
            <h1 className="mt-4 max-w-3xl text-4xl font-medium leading-tight tracking-normal sm:text-6xl">{store.name}</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/76">{store.description}</p>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_20rem] lg:px-8">
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-4">
              <Metric icon={Star} label="Rating" value={`${store.rating.toFixed(1)} (${store.ratingCount})`} />
              <Metric icon={Clock3} label="ETA" value={`${store.etaMinutes} min`} />
              <Metric icon={IndianRupee} label="Minimum" value={`Rs ${store.minOrder}`} />
              <Metric icon={MapPin} label="Distance" value={`${store.distanceKm.toFixed(1)} km`} />
            </div>

            {sections.map((section) => (
              <section key={section} aria-labelledby={`${section}-menu`}>
                <h2 id={`${section}-menu`} className="text-2xl font-medium tracking-normal">{section}</h2>
                <div className="mt-3 grid gap-3">
                  {store.menu.filter((item) => item.section === section).map((item) => (
                    <article key={item.name} className="rounded-lg border border-border bg-surface p-4 shadow-sm">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-medium">{item.name}</h3>
                            <MenuDietaryBadge item={item} storeType={store.type} />
                            {item.badge ? <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">{item.badge}</span> : null}
                          </div>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.description}</p>
                        </div>
                        <p className="shrink-0 text-sm font-medium">{item.price === 0 ? "Review required" : `Rs ${item.price}`}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <aside className="h-fit rounded-lg border border-border bg-surface p-4 shadow-[var(--shadow-shell)]">
            <h2 className="text-lg font-medium">Ready to order?</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Sign in to use the live cart, pricing, coupons, prescriptions, and OTP-tracked fulfillment.</p>
            <div className="mt-4 grid gap-2">
              <Button asChild><Link href={`/customer/stores/${store.id}`}>Open in customer app</Link></Button>
              <Button asChild variant="secondary"><Link href="/login">Log in first</Link></Button>
            </div>
          </aside>
        </section>
      </main>
    </PublicSiteShell>
  );
}

function MenuDietaryBadge({ item, storeType }: { item: { dietaryType?: DietaryType | null; name?: string; description?: string; tags?: string[] }; storeType: PublicStoreType }) {
  const dietaryType = resolveDietaryType(item, storeType);

  return dietaryType ? <DietaryBadge type={dietaryType} /> : null;
}

function DietaryBadge({ type }: { type: DietaryType }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium", dietaryTone[type])} aria-label={`${dietaryLabels[type]} item`}>
      <span className="grid size-3 place-items-center rounded-[3px] border border-current" aria-hidden={true}>
        <span className="size-1.5 rounded-full bg-current" />
      </span>
      {dietaryLabels[type]}
    </span>
  );
}
export function PublicOffersPage() {
  return (
    <PublicSiteShell active="offers">
      <PageHeader eyebrow="Offers" title="Launch perks across MoveX" description="These cards preview planned launch benefits for each vertical. They are not active coupon codes yet." />
      <main className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {publicOffers.map((offer) => <OfferCard key={offer.id} offer={offer} />)}
        </div>
      </main>
    </PublicSiteShell>
  );
}

export function PublicRidesPage() {
  return (
    <PublicSiteShell active="rides">
      <PageHeader eyebrow="Rides" title="Book bikes, autos, and cabs from the same MoveX account" description="This public ride preview keeps the old route alive. The real booking flow continues in the authenticated customer app with route pricing and OTP start verification." />
      <main className="mx-auto grid max-w-7xl gap-6 px-4 pb-14 sm:px-6 lg:grid-cols-[1fr_24rem] lg:px-8">
        <RideFarePanel />
        <aside className="rounded-lg border border-border bg-surface p-5 shadow-[var(--shadow-shell)]">
          <h2 className="text-xl font-medium">Plan a city trip</h2>
          <div className="mt-4 space-y-3">
            <RouteField label="Pickup" value="Indiranagar, Bengaluru" />
            <RouteField label="Drop" value="MG Road, Bengaluru" />
          </div>
          <div className="mt-5 rounded-md bg-ride-soft p-4 text-ride">
            <p className="text-sm font-medium">Live route pricing is available after sign-in.</p>
            <p className="mt-1 text-sm leading-6">The app uses MapsProvider routes, surge config, and driver freshness checks.</p>
          </div>
          <Button asChild className="mt-5 w-full"><Link href="/customer/rides">Continue to ride booking</Link></Button>
        </aside>
      </main>
    </PublicSiteShell>
  );
}

export function PublicPartnerPage() {
  return (
    <PublicSiteShell active="partner">
      <PageHeader eyebrow="Partner with MoveX" title="One operating system for stores, drivers, and service professionals" description="Use this public page for onboarding. Approved partners keep using the preserved dashboard at /partner/dashboard." />
      <main className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {partnerTracks.map((track) => (
            <article key={track.title} className="rounded-lg border border-border bg-surface p-5 shadow-sm">
              <span className="flex size-11 items-center justify-center rounded-md bg-primary/10 text-primary"><Building2 className="size-5" aria-hidden={true} /></span>
              <h2 className="mt-5 text-xl font-medium">{track.title}</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{track.description}</p>
              <p className="mt-4 rounded-md bg-surface-muted px-3 py-2 text-sm font-medium text-foreground">{track.metrics}</p>
              <Button asChild className="mt-5 w-full"><Link href={track.href}>Sign in to continue</Link></Button>
            </article>
          ))}
        </div>

        <section className="mt-10 rounded-lg border border-border bg-surface-muted p-5 sm:p-7">
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="text-sm font-medium text-primary">How approval works</p>
              <h2 className="mt-2 text-3xl font-medium tracking-normal">Submit profile, get reviewed, then go online.</h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">The partner profile flow sets approval to pending and keeps online/location controls blocked until an admin approves the account.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                "Create partner account",
                "Upload licenses and bank details",
                "Accept live jobs after approval",
              ].map((step, index) => (
                <div key={step} className="rounded-lg border border-border bg-surface p-4">
                  <p className="text-sm font-medium text-primary">0{index + 1}</p>
                  <p className="mt-2 text-sm leading-6 text-foreground">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </PublicSiteShell>
  );
}

export function PublicSupportPage() {
  return (
    <PublicSiteShell active="support">
      <PageHeader eyebrow="Get Help" title="Help for orders, rides, refunds, and partner operations" description="Find the right support path for customer bookings, partner operations, payments, and account questions." />
      <main className="mx-auto grid max-w-7xl gap-6 px-4 pb-14 sm:px-6 lg:grid-cols-[1fr_22rem] lg:px-8">
        <section className="grid gap-4 md:grid-cols-2">
          <SupportCard icon={Package} title="Order help" description="Track missing items, substitutions, cancellations, refunds, and delivery OTP issues." />
          <SupportCard icon={Bike} title="Ride help" description="Review trip status, start OTP, fare questions, cancellation fees, and safety reports." />
          <SupportCard icon={Truck} title="Courier help" description="Get assistance with pickup, drop OTP, parcel condition, and live tracking." />
          <SupportCard icon={Store} title="Partner help" description="Resolve approval, menu, payout, online status, and location heartbeat issues." />
        </section>
        <aside className="h-fit rounded-lg border border-border bg-surface p-5 shadow-[var(--shadow-shell)]">
          <Headphones className="size-8 text-primary" aria-hidden={true} />
          <h2 className="mt-4 text-xl font-medium">Need account-specific help?</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Sign in so support can attach the ticket to the exact customer, partner, order, ride, or payment record.</p>
          <div className="mt-5 grid gap-2">
            <Button asChild><Link href="/login">Log in for support</Link></Button>
            <Button asChild variant="secondary"><Link href="/ops/support">Ops support console</Link></Button>
          </div>
        </aside>
      </main>
    </PublicSiteShell>
  );
}

export function PublicAboutPage() {
  return (
    <PublicSiteShell active="about">
      <PageHeader eyebrow="About MoveX" title="A local-services super-app built around one shared service spine" description="Locate, estimate, confirm, match, track, complete, and rate. Every vertical uses the same operational loop instead of isolated workflows." />
      <main className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
        <section className="grid gap-4 md:grid-cols-3">
          <AboutMetric value="6" label="Verticals" description="Food, grocery, pharmacy, rides, courier, and home services." />
          <AboutMetric value="8" label="Roles" description="Customer, partner, delivery, driver, support, finance, admin, and super admin." />
          <AboutMetric value="1" label="Ledger" description="Money movement flows through one authoritative financial spine." />
        </section>
        <section className="mt-10 rounded-lg border border-border bg-surface p-5 shadow-sm sm:p-7">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <p className="text-sm font-medium text-primary">Operating model</p>
              <h2 className="mt-2 text-3xl font-medium tracking-normal">Designed for city-scale local commerce.</h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">MoveX connects public discovery pages to authenticated customer, partner, and ops surfaces. The public site now gives new visitors the same entry points as the older Vercel app while the new system powers the deeper workflows.</p>
            </div>
            <div className="grid gap-3">
              {["Location-first discovery", "Shared checkout and fulfillment loop", "Partner matching with live heartbeats", "Finance and support surfaces for operations"].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-md bg-surface-muted p-3">
                  <CheckCircle2 className="size-5 text-success" aria-hidden={true} />
                  <span className="text-sm font-medium">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </PublicSiteShell>
  );
}

function LogoMark() {
  return <span className="flex size-10 items-center justify-center rounded-md bg-primary text-base font-medium text-primary-foreground shadow-sm">M</span>;
}

function FooterColumn({ title, links }: { title: string; links: Array<{ label: string; href: string }> }) {
  return (
    <div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <div className="mt-3 grid gap-2">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="text-sm text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

function Section({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
      <div className="mb-7 max-w-3xl">
        <p className="text-sm font-medium text-primary">{eyebrow}</p>
        <h2 className="mt-2 text-3xl font-medium tracking-normal sm:text-4xl">{title}</h2>
        <p className="mt-3 text-base leading-7 text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function PageHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <section className="border-b border-border bg-surface-muted">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
        <p className="text-sm font-medium text-primary">{eyebrow}</p>
        <h1 className="mt-3 max-w-4xl text-4xl font-medium leading-tight tracking-normal sm:text-6xl">{title}</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">{description}</p>
      </div>
    </section>
  );
}

function ServiceCard({ service }: { service: PublicService }) {
  const Icon = serviceIcons[service.id] ?? Sparkles;

  return (
    <Link href={service.href} className="group rounded-lg border border-border bg-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
      <span className={cn("flex size-12 items-center justify-center rounded-md", service.tone)}>
        <Icon className="size-5" aria-hidden={true} />
      </span>
      <h3 className="mt-5 text-lg font-medium">{service.label}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{service.description}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">Explore <ChevronRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden={true} /></span>
    </Link>
  );
}

function PublicStoreCard({ store, compact = false }: { store: PublicStore; compact?: boolean }) {
  return (
    <Link href={`/stores/${store.id}`} className="group overflow-hidden rounded-lg border border-border bg-surface shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
      <div className={cn("relative bg-surface-muted", compact ? "h-44" : "h-52")}>
        <img src={store.imageUrl} alt="" className="size-full object-cover transition duration-300 group-hover:scale-[1.03]" />
        <span className={cn("absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-medium shadow-sm", storeTone[store.type])}>{storeLabel[store.type]}</span>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-medium">{store.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{store.area}, {store.city}</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warning/10 px-2 py-1 text-xs font-medium text-warning"><Star className="size-3.5" aria-hidden={true} /> {store.rating.toFixed(1)}</span>
        </div>
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">{store.description}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-surface-muted px-2.5 py-1">{store.etaMinutes} min</span>
          <span className="rounded-full bg-surface-muted px-2.5 py-1">Rs {store.minOrder} minimum</span>
          <span className="rounded-full bg-surface-muted px-2.5 py-1">{store.distanceKm.toFixed(1)} km</span>
        </div>
      </div>
    </Link>
  );
}

function OfferCard({ offer }: { offer: PublicOffer }) {
  const Icon = offerIcons[offer.service];

  return (
    <article className="group flex min-h-full flex-col rounded-lg border border-border bg-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <span className={cn("flex size-12 items-center justify-center rounded-md", offerTone[offer.service])}>
          <Icon className="size-5" aria-hidden={true} />
        </span>
        <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">Coming soon</span>
      </div>
      <p className="mt-5 text-sm font-medium text-primary">{offer.service}</p>
      <h3 className="mt-1 text-xl font-medium">{offer.title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{offer.description}</p>
      <div className="mt-5 rounded-md border border-border bg-surface-muted p-3 text-sm text-foreground">
        <span className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden={true} />
          <span>{offer.plannedBenefit}</span>
        </span>
      </div>
      <Button asChild variant="secondary" className="mt-5 w-full">
        <Link href={offer.href}>{offer.ctaLabel}<ArrowRight className="size-4" aria-hidden={true} /></Link>
      </Button>
    </article>
  );
}

function RideFarePanel() {
  return (
    <section className="rounded-lg border border-border bg-surface p-5 shadow-[var(--shadow-shell)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-ride">Fare preview</p>
          <h2 className="mt-1 text-2xl font-medium tracking-normal">Indiranagar to MG Road</h2>
        </div>
        <span className="rounded-full bg-ride-soft px-3 py-1 text-sm font-medium text-ride">4.8 km</span>
      </div>
      <div className="mt-5 grid gap-3">
        {rideOptions.map((option) => (
          <div key={option.type} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md border border-border bg-surface-muted p-3">
            <span className="flex size-11 items-center justify-center rounded-md bg-ride-soft text-ride"><Bike className="size-5" aria-hidden={true} /></span>
            <div>
              <p className="text-sm font-medium">{option.type}</p>
              <p className="text-xs text-muted-foreground">{option.note} / {option.eta}</p>
            </div>
            <p className="text-sm font-medium">{option.price}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Metric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
      <Icon className="size-5 text-primary" aria-hidden={true} />
      <p className="mt-3 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

function RouteField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface-muted p-3">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

function FilterChip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link href={href} className={cn("rounded-full border px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30", active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-muted-foreground hover:text-foreground")}>
      {label}
    </Link>
  );
}

function SupportCard({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <article className="rounded-lg border border-border bg-surface p-5 shadow-sm">
      <Icon className="size-7 text-primary" aria-hidden={true} />
      <h2 className="mt-4 text-xl font-medium">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      <Link href="/login" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary">Start ticket <ArrowRight className="size-4" aria-hidden={true} /></Link>
    </article>
  );
}

function AboutMetric({ value, label, description }: { value: string; label: string; description: string }) {
  return (
    <article className="rounded-lg border border-border bg-surface p-5 shadow-sm">
      <p className="text-4xl font-medium text-primary">{value}</p>
      <h2 className="mt-3 text-lg font-medium">{label}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </article>
  );
}

export function resolvePublicStoreType(value: unknown): PublicStoreType | undefined {
  return isPublicStoreType(value) ? value : undefined;
}

