"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Bike, Building2, CheckCircle2, ChevronRight, Clock3, Headphones, Home, IndianRupee, LocateFixed, MapPin, Package, Pill, ShoppingBasket, Sparkles, Star, Store, Truck, Utensils, type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui";
import { listStores, publicPlatformConfig } from "@/lib/api";
import { PublicHeaderActions } from "./public-header-actions";
import { ServiceHeroCarousel } from "./service-hero-carousel";
import { cn } from "@/lib/utils";
import { dietaryLabels, resolveDietaryType, type DietaryType } from "@/lib/dietary";
import { findPublicStore, isPublicStoreType, partnerTracks, publicHeroSlides,
  publicServices, publicStores,
  storesByType, type PublicHeroSlide, type PublicService, type PublicStore, type PublicStoreType,
} from "@/lib/public-site-data";

const navItems = [
  { label: "Home", href: "/", key: "home" },
  { label: "Stores", href: "/stores", key: "stores" },
  { label: "Rides", href: "/rides", key: "rides" },
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

const dietaryTone: Record<DietaryType, string> = {
  VEG: "border-success/35 bg-success/10 text-success",
  NON_VEG: "border-destructive/35 bg-destructive/10 text-destructive",
  EGG: "border-warning/35 bg-warning/10 text-warning",
};

export function PublicSiteShell({ active, children,
}: { active?: PublicNavKey; children: ReactNode;
}) {
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
              <Link key={item.href} href={item.href} className={cn("rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30", active === item.key && "bg-surface-muted text-foreground",
                )}>
                {item.label}
              </Link>
            ))}
          </nav>
          <PublicHeaderActions />
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
                <p className="text-sm text-muted-foreground">One account. Every service.</p>
              </div>
            </div>
            <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">A multi-service local platform for food, grocery, pharmacy, mobility, courier, and home services.</p>
          </div>
          <FooterColumn title="Company" links={[{ label: "About", href: "/about" }, { label: "Partner", href: "/partner" }, { label: "Get Help", href: "/support" },
            ]} />
          <FooterColumn title="Services" links={[{ label: "Stores", href: "/stores" }, { label: "Rides", href: "/customer/rides" },
            ]} />
          <FooterColumn title="Apps" links={[{ label: "Customer", href: "/customer" }, { label: "Partner dashboard", href: "/partner/dashboard" }, { label: "Ops console", href: "/ops" },
            ]} />
        </div>
      </footer>
    </div>
  );
}

export function PublicHomePage() {
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [homepage, setHomepage] = useState<Record<string, unknown>>({});
  const [liveStores, setLiveStores] = useState<PublicStore[] | null>(null);
  useEffect(() => {
    let active = true;
    void publicPlatformConfig().then((config) => { if (active) { setFlags(config.featureFlags); setHomepage(config.homepage); } }).catch(() => undefined);
    void listStores({ limit: 4 }).then((response) => {
      if (!active) return;
      setLiveStores(response.items.map((store) => ({ id: store.id, type: store.type, name: store.name, area: "Nearby", city: "", description: store.description, imageUrl: store.imageUrl ?? publicStores.find((sample) => sample.type === store.type)?.imageUrl ?? "", rating: Number(store.ratingAverage), ratingCount: store.ratingCount, etaMinutes: store.etaMinutes, minOrder: Number(store.minOrder), distanceKm: store.distanceKm ?? 0, tags: [], isOpen: store.isOpen, menu: [] })));
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  const visible = (id: string) => flags[`vertical.${id === "home" ? "home-service" : id}.enabled`] !== false;
  const configuredSlides = Array.isArray(homepage.heroSlides)
    ? homepage.heroSlides.filter(isHeroSlide)
    : [];
  const sourceSlides = configuredSlides.length > 0 ? configuredSlides : publicHeroSlides;
  const visibleSlides = sourceSlides.filter((slide) => visible(slide.id));
  const visibleServices = publicServices.filter((service) => visible(service.id));
  const featuredStores = liveStores ?? publicStores.slice(0, 4);

  return (
    <PublicSiteShell active="home">
      <ServiceHeroCarousel slides={visibleSlides.length > 0 ? visibleSlides : publicHeroSlides} />

      <main>
        <section className="relative z-10 mx-auto -mt-12 max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-3 rounded-lg border border-border bg-surface p-3 shadow-[var(--shadow-shell)] md:grid-cols-[1fr_1fr_auto] md:items-center">
            <div className="flex items-center gap-3 rounded-md bg-surface-muted px-3 py-3">
              <LocateFixed className="size-5 text-primary" aria-hidden={true} />
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Choose your area
                </p>
                <p className="text-sm font-medium">Set a location to browse nearby</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-md bg-surface-muted px-3 py-3">
              <Clock3 className="size-5 text-primary" aria-hidden={true} />
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Across MoveX
                </p>
                <p className="text-sm font-medium">Food, rides, courier, and more</p>
              </div>
            </div>
            <Button asChild className="min-h-12 px-6">
              <Link href="/login">Set location</Link>
            </Button>
          </div>
        </section>
        <Section eyebrow="Services" title="What do you need today?" description="Explore food, groceries, medicines, rides, courier, and home services from one place.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleServices.map((service) => (
              <ServiceCard key={service.id} service={service} />))}
          </div>
        </Section>

        <Section
          eyebrow="Marketplace"
          title="Popular stores near you"
          description="Explore restaurants, everyday essentials, and nearby pharmacies in one place.">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {featuredStores.map((store) => (
              <PublicStoreCard key={store.id} store={store} compact />
            ))}
          </div>
        </Section>
        <section className="border-y border-border bg-primary py-14 text-primary-foreground sm:py-16">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_1fr] lg:items-center lg:px-8">
            <div>
              <p className="text-sm font-medium text-primary-foreground/76">Partner network</p>
              <h2 className="mt-2 text-3xl font-medium tracking-normal sm:text-4xl">
                Stores, drivers, and service professionals operate from one queue.</h2>
              <p className="mt-4 text-base leading-7 text-primary-foreground/76">
                Partners can manage jobs, availability, earnings, and payouts from one place.</p>
              </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {partnerTracks.map((track) => (
                <Link
                  key={track.title}
                  href="/partner"
                  className="rounded-lg border border-primary-foreground/16 bg-primary-foreground/10 p-4 transition hover:-translate-y-0.5 hover:bg-primary-foreground/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/35">
                  <p className="text-sm font-medium">{track.title}</p>
              <p className="mt-3 text-xs leading-5 text-primary-foreground/72">
                    {track.metrics}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>{" "}
          </main>
    </PublicSiteShell>
  );
}

function isHeroSlide(value: unknown): value is PublicHeroSlide {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const slide = value as Record<string, unknown>;
  return ["id", "label", "eyebrow", "title", "description", "promise", "ctaLabel", "href", "imageUrl", "imageAlt"].every((key) => typeof slide[key] === "string") && ["food", "grocery", "pharmacy", "rides", "courier", "home"].includes(String(slide.id));
}

export function PublicStoresPage({ selectedType }: { selectedType?: PublicStoreType }) {
  const stores = storesByType(selectedType);

  return (
    <PublicSiteShell active="stores">
      <PageHeader eyebrow="Marketplace" title="Browse food, grocery, and pharmacy stores" description="Explore nearby restaurants, grocery stores, and pharmacies, then sign in when you are ready to order." />
      <main className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-wrap gap-2">
          <FilterChip href="/stores" label="All stores" active={!selectedType} />
          <FilterChip href="/stores?type=FOOD" label="Food" active={selectedType === "FOOD"} />
          <FilterChip href="/stores?type=GROCERY" label="Grocery" active={selectedType === "GROCERY"} />
          <FilterChip href="/stores?type=PHARMACY" label="Pharmacy" active={selectedType === "PHARMACY"} />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {stores.map((store) => (
            <PublicStoreCard key={store.id} store={store} />))}
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
            <span className={cn("w-fit rounded-full px-3 py-1 text-xs font-medium", storeTone[store.type],
              )}>{storeLabel[store.type]}</span>
            <h1 className="mt-4 max-w-3xl text-4xl font-medium leading-tight tracking-normal sm:text-6xl">{store.name}</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/76">{store.description}</p>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_20rem] lg:px-8">
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Metric icon={Star} label="Rated by customers" value={`${store.rating.toFixed(1)} (${store.ratingCount})`} accent={store.rating > 3.0 ? "text-success" : "text-warning"} />
              <Metric icon={Clock3} label="Arrives in" value={`${store.etaMinutes}-${store.etaMinutes + 8} min`} />
              <Metric icon={Truck} label="Delivery fee" value="Rs 29" />
              <Metric icon={IndianRupee} label="Min order" value={`Rs ${store.minOrder}`} />
              <Metric icon={MapPin} label="Store distance" value={`${store.distanceKm.toFixed(1)} km away`} />
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
                            {item.badge ? (
                                <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">{item.badge}</span>
                              ) : null}
                          </div>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.description}</p>
                        </div>
                        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                          <p className="text-sm font-medium">{item.price === 0 ? "Review required" : `Rs ${item.price}`}</p>
                          <Button asChild size="sm" variant="secondary">
                            <Link href={`/customer/stores/${store.id}`}>Add to cart</Link>
                          </Button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <aside className="h-fit rounded-lg border border-border bg-surface p-4 shadow-[var(--shadow-shell)] lg:sticky lg:top-24">
            <p className="text-sm font-medium text-primary">Live ordering</p>
            <h2 className="mt-1 text-xl font-medium">Build your cart in the customer app</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Browse the menu, add items to your cart, and continue to secure checkout when you are
              ready.</p>
            <div className="mt-4 grid gap-2 rounded-md border border-border bg-surface-muted p-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2"><Clock3 className="size-4 text-primary" aria-hidden="true" /> Arrives in {" "}
                {store.etaMinutes}-{store.etaMinutes + 8} min</span>
              <span className="inline-flex items-center gap-2"><IndianRupee className="size-4 text-primary" aria-hidden="true" /> Minimum order Rs {" "}
                {store.minOrder}</span>
              <span className="inline-flex items-center gap-2"><MapPin className="size-4 text-primary" aria-hidden="true" /> Delivering near selected location</span>
            </div>
            <div className="mt-4 grid gap-2">
              <Button asChild><Link href={`/customer/stores/${store.id}`}>Start adding items</Link></Button>
              <Button asChild variant="secondary"><Link href="/login/customer">Continue with customer login</Link></Button>
            </div>
          </aside>
        </section>
      </main>
    </PublicSiteShell>
  );
}

function MenuDietaryBadge({ item, storeType,
}: { item: { dietaryType?: DietaryType | null; name?: string; description?: string; tags?: string[] }; storeType: PublicStoreType;
}) {
  const dietaryType = resolveDietaryType(item, storeType);

  return dietaryType ? <DietaryBadge type={dietaryType} /> : null;
}

function DietaryBadge({ type }: { type: DietaryType }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium", dietaryTone[type],
      )} aria-label={`${dietaryLabels[type]} item`}>
      <span className="grid size-3 place-items-center rounded-[3px] border border-current" aria-hidden={true}>
        <span className="size-1.5 rounded-full bg-current" />
      </span>
      {dietaryLabels[type]}
    </span>
  );
}
export function PublicPartnerPage() {
  return (
    <PublicSiteShell active="partner">
      <PageHeader eyebrow="Partner with MoveX" title="One operating system for stores, drivers, and service professionals" description="Choose your partner type, complete verification, and start accepting work after approval." />
      <main className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {partnerTracks.map((track) => (
            <article
              key={track.title}
              className="rounded-lg border border-border bg-surface p-5 shadow-sm">
          <span className="flex size-11 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Building2 className="size-5" aria-hidden={true} />
          </span>
          <h2 className="mt-5 text-xl font-medium">{track.title}</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{track.description}</p>
            <p className="mt-4 rounded-md bg-surface-muted px-3 py-2 text-sm font-medium text-foreground">
                {track.metrics}
              </p>
          <Button asChild className="mt-5 w-full"><Link href={track.href}>Sign in to continue</Link></Button>
        </article>
  ))}
        </div>
      <section className="mt-10 rounded-lg border border-border bg-surface-muted p-5 sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div>
              <p className="text-sm font-medium text-primary">How approval works</p>
              <h2 className="mt-2 text-3xl font-medium tracking-normal">
                Submit profile, get reviewed, then go online.
              </h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                The partner profile flow sets approval to pending and keeps online/location controls
                blocked until an admin approves the account.
              </p>
              </div>
            <div className="grid gap-3 sm:grid-cols-3">{[
                "Create partner account",
                "Upload licenses and bank details",
                "Accept live jobs after approval",
              ].map((step, index) => (
                <div key={step} className="rounded-lg border border-border bg-surface p-4"><p className="text-sm font-medium text-primary">0{index + 1}</p>
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
      <PageHeader
        eyebrow="Get Help"
        title="Help for orders, rides, refunds, and partner operations"
        description="Find the right support path for customer bookings, partner operations, payments, and account questions."
      />
      <main className="mx-auto grid max-w-7xl gap-6 px-4 pb-14 sm:px-6 lg:grid-cols-[1fr_22rem] lg:px-8">
            <section className="grid gap-4 md:grid-cols-2">
          <SupportCard
            icon={Package}
            title="Order help"
            description="Track missing items, substitutions, cancellations, refunds, and delivery OTP issues."
          />
            <SupportCard
            icon={Bike}
            title="Ride help"
            description="Review trip status, start OTP, fare questions, cancellation fees, and safety reports."
          />
          <SupportCard
            icon={Truck}
            title="Courier help"
            description="Get assistance with pickup, drop OTP, parcel condition, and live tracking."
          />
          <SupportCard
            icon={Store}
            title="Partner help"
            description="Resolve approval, menu, payout, online status, and location-sharing issues."
          />
        </section>
        <aside className="h-fit rounded-lg border border-border bg-surface p-5 shadow-[var(--shadow-shell)]">
                  <Headphones className="size-8 text-primary" aria-hidden={true} />
                  <h2 className="mt-4 text-xl font-medium">Need account-specific help?</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Sign in so support can attach the ticket to the exact customer, partner, order, ride, or
            payment record.
          </p>
      <div className="mt-5 grid gap-2">
            <Button asChild>
              <Link href="/login">Log in for support</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/ops/support">Ops support console</Link>
            </Button>
    </div>
        </aside>
      </main>
    </PublicSiteShell>
  );
}

export function PublicAboutPage() {
  return (
    <PublicSiteShell active="about">
      <PageHeader
        eyebrow="About MoveX"
        title="A local-services super-app built around one shared service spine"
        description="Locate, estimate, confirm, match, track, complete, and rate. Every service uses the same operational loop instead of isolated workflows."
      />
      <main className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
      <section className="grid gap-4 md:grid-cols-3">
        <AboutMetric
            value="6"
            label="Services"
            description="Food, grocery, pharmacy, rides, courier, and home services."
          />
        <AboutMetric
            value="8"
            label="Roles"
            description="Customer, partner, delivery, driver, support, finance, admin, and super admin."
          />
      <AboutMetric
            value="1"
            label="Secure balance"
            description="Credits, payments, and refunds stay consistent across every service."
          />
        </section>
        <section className="mt-10 rounded-lg border border-border bg-surface p-5 shadow-sm sm:p-7">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div>
              <p className="text-sm font-medium text-primary">Operating model</p>
        <h2 className="mt-2 text-3xl font-medium tracking-normal">
                Designed for city-scale local commerce.
              </h2>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
                MoveX brings everyday local services into one account, with clear booking steps,
                secure payments, and support throughout each journey.
              </p>
      </div>
    <div className="grid gap-3">
              {[
                "Location-first discovery",
                "Shared checkout and fulfillment loop",
                "Partner matching with fresh live locations",
                "Finance and support surfaces for operations",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-md bg-surface-muted p-3">
          <CheckCircle2 className="size-5 text-success" aria-hidden={true} />
        <span className="text-sm font-medium">{item}</span>
        </div>
              ))}</div>
          </div>
        </section>
      </main>
    </PublicSiteShell>
  );
}

function LogoMark() {
  return (
    <span className="flex size-10 items-center justify-center rounded-md bg-primary text-base font-medium text-primary-foreground shadow-sm">
      M
    </span>
  );
}
function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: Array<{ label: string; href: string }>;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <div className="mt-3 grid gap-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-sm text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          >{link.label}</Link>
        ))}
      </div>
      </div>
  );
}

function Section({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
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

function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="border-b border-border bg-surface-muted">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
        <p className="text-sm font-medium text-primary">{eyebrow}</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-medium leading-tight tracking-normal sm:text-6xl">
          {title}
        </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">{description}
        </p>
      </div>
    </section>
  );
}

function ServiceCard({ service }: { service: PublicService }) {
  const Icon = serviceIcons[service.id] ?? Sparkles;

  return (
    <Link
      href={service.href}
      className="group overflow-hidden rounded-lg border border-border bg-surface shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
      <div className="relative h-36 overflow-hidden bg-surface-muted">
        <img src={service.imageUrl} alt="" className="size-full object-cover transition duration-300 group-hover:scale-[1.03]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.02)_0%,rgba(2,6,23,0.38)_100%)]" aria-hidden={true} />
        <span className={cn("absolute bottom-3 left-3 flex size-12 items-center justify-center rounded-md border border-white/40 bg-white/92 shadow-sm backdrop-blur",
            service.tone,
          )}>
          <Icon className="size-5" aria-hidden={true} />
        </span>
        </div>
        <div className="p-5">
          <h3 className="text-lg font-medium">{service.label}</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{service.description}</p>
        <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
          Explore{" "}
          <ChevronRight
            className="size-4 transition group-hover:translate-x-0.5" aria-hidden={true} />
        </span>
        </div>
        </Link>
  );
}
function PublicStoreCard({ store, compact = false }: { store: PublicStore; compact?: boolean }) {
  return (
    <Link
      href={`/stores/${store.id}`}
      className="group overflow-hidden rounded-lg border border-border bg-surface shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
      <div className={cn("relative bg-surface-muted", compact ? "h-44" : "h-52")}>
        <img
          src={store.imageUrl}
          alt="" className="size-full object-cover transition duration-300 group-hover:scale-[1.03]"
        />
          <span
          className={cn(
            "absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-medium shadow-sm",
            storeTone[store.type],
          )}>{storeLabel[store.type]}
        </span>
      </div>
    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
            <h3 className="truncate text-lg font-medium">{store.name}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
              {store.area}, {store.city}
            </p>
      </div>
      <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-medium",
              store.rating > 3.0 ? "bg-success/10 text-success" : "bg-warning/10 text-warning",
            )}
          ><Star className="size-3.5" aria-hidden={true} /> {store.rating.toFixed(1)}
          </span>
            </div>
              <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">{store.description}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-surface-muted px-2.5 py-1">{store.etaMinutes} min</span>
          <span className="rounded-full bg-surface-muted px-2.5 py-1">
            Rs {store.minOrder} minimum
          </span>
            <span className="rounded-full bg-surface-muted px-2.5 py-1">{store.distanceKm.toFixed(1)} km
          </span>
          </div>
      </div>
    </Link>
  );
}

function Metric({ icon: Icon, label, value, accent,
}: { icon: LucideIcon; label: string; value: string; accent?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
      <Icon className={cn("size-5", accent || "text-primary")} aria-hidden={true} />
      <p className="mt-3 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-sm font-medium", accent)}>{value}</p>
    </div>
  );
}

function FilterChip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link href={href} className={cn("rounded-full border px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30", active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-muted-foreground hover:text-foreground",
      )}>
      {label}
    </Link>
  );
}

function SupportCard({ icon: Icon, title, description,
}: { icon: LucideIcon; title: string; description: string;
}) {
  return (
    <article className="rounded-lg border border-border bg-surface p-5 shadow-sm">
      <Icon className="size-7 text-primary" aria-hidden={true} />
      <h2 className="mt-4 text-xl font-medium">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      <Link href="/login" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary">Start ticket <ArrowRight className="size-4" aria-hidden={true} /></Link>
    </article>
  );
}

function AboutMetric({ value, label, description,
}: { value: string; label: string; description: string;
}) {
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
