"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, Bike, Building2, ChevronRight, Hammer, Headphones, PlugZap, ShieldCheck, Store, Truck, UserRound, Wrench, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { partnerLoginConfigs, type PartnerLoginConfig } from "@/lib/auth-flow";
import { adminLogin, requestOtpLogin, routeForRole, type OtpLoginRole, verifyOtpLogin } from "@/lib/api";
import { cn } from "@/lib/utils";

const INTRO_SESSION_KEY = "movex-login-intro-seen";
const verticalChips = ["Food", "Grocery", "Pharmacy", "Rides", "Courier", "Home"];
const trustChips = ["OTP secure", "HttpOnly sessions", "Role locked"];

const partnerIcons: Record<PartnerLoginConfig["slug"], LucideIcon> = {
  "store-partner": Store,
  "delivery-partner": Truck,
  driver: Bike,
  electrician: PlugZap,
  "home-repair": Hammer,
  plumber: Wrench,
};

const gatewayOptions = [
  {
    href: "/login/customer",
    label: "Customer Login",
    description: "Order food, groceries, medicines, rides, courier pickups, and home services.",
    icon: UserRound,
    tone: "bg-primary/10 text-primary",
  },
  {
    href: "/login/partner",
    label: "Partner Login",
    description: "Stores, delivery partners, drivers, and home-service professionals.",
    icon: Building2,
    tone: "bg-grocery-soft text-grocery",
  },
  {
    href: "/login/staff",
    label: "Staff Login",
    description: "Support, finance, admin, and super-admin access for operations.",
    icon: ShieldCheck,
    tone: "bg-ride-soft text-ride",
  },
];

export function LoginPage() {
  return (
    <AuthFrame eyebrow="Welcome to MoveX" title="Choose how you want to sign in" description="A cleaner entry point for customers, partners, and operations teams.">
      <div className="grid gap-3">
        {gatewayOptions.map((option) => <AuthOptionCard key={option.href} {...option} />)}
      </div>
      <p className="mt-5 text-sm leading-6 text-muted-foreground">Pick one path. We keep the auth role fixed for the rest of the flow, so OTP verification stays clean and role-based.</p>
    </AuthFrame>
  );
}

export function CustomerOtpLoginPage() {
  return (
    <AuthFrame eyebrow="Customer login" title="Continue with phone OTP" description="Use one customer account for stores, rides, courier bookings, and home services." backHref="/login">
      <OtpLoginFlow role="CUSTOMER" label="Customer" description="We will send a 6-digit OTP to your phone number." />
    </AuthFrame>
  );
}

export function PartnerSelectionPage() {
  return (
    <AuthFrame eyebrow="Partner login" title="Select your partner type" description="Choose the workstream you belong to, then continue with phone OTP." backHref="/login">
      <div className="grid gap-3 sm:grid-cols-2">
        {partnerLoginConfigs.map((partner) => {
          const Icon = partnerIcons[partner.slug];

          return (
            <Link
              key={partner.slug}
              href={`/login/partner/${partner.slug}`}
              className="group rounded-lg border border-border bg-surface p-3.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              <span className="flex items-start justify-between gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="size-5" aria-hidden={true} />
                </span>
                <ChevronRight className="size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden={true} />
              </span>
              <span className="mt-3 block text-base font-medium text-foreground">{partner.label}</span>
              <span className="mt-1 block text-sm leading-5 text-muted-foreground">{partner.description}</span>
              <span className="mt-2 inline-flex rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">{partner.serviceLine}</span>
            </Link>
          );
        })}
      </div>
    </AuthFrame>
  );
}

export function PartnerOtpLoginPage({ partner }: { partner: PartnerLoginConfig }) {
  const Icon = partnerIcons[partner.slug];

  return (
    <AuthFrame eyebrow="Partner OTP" title={`Continue as ${partner.label}`} description="Your partner type is selected before OTP, so the backend receives the correct auth role." backHref="/login/partner">
      <div className="mb-5 rounded-lg border border-border bg-surface-muted p-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon className="size-5" aria-hidden={true} />
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">{partner.label}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{partner.description}</p>
          </div>
        </div>
      </div>
      <OtpLoginFlow role={partner.backendRole} label={partner.label} description="We will send a 6-digit OTP to the phone linked with this partner account." />
    </AuthFrame>
  );
}

export function StaffLoginPage() {
  return (
    <AuthFrame eyebrow="Staff login" title="Sign in to operations" description="For support, finance, admin, and super-admin users." backHref="/login">
      <StaffLoginFlow />
    </AuthFrame>
  );
}

function OtpLoginFlow({ role, label, description }: { role: OtpLoginRole; label: string; description: string }) {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const canAnimate = !prefersReducedMotion;
  const [phone, setPhone] = useState("+919876543210");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [otpRequested, setOtpRequested] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitOtpRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus(null);
    setIsSubmitting(true);

    try {
      const result = await requestOtpLogin({ phone, role });
      setOtpRequested(true);
      setDevCode(result.devCode ?? null);
      setStatus(result.devCode ? `Development OTP: ${result.devCode}` : result.message);
      setCode(result.devCode ?? "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not request OTP.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitOtpVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus(null);
    setIsSubmitting(true);

    try {
      const result = await verifyOtpLogin({ phone, role, code });
      router.replace(routeForRole(result.user.role));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not verify OTP.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-surface-muted p-4">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>

      <form className="space-y-4" onSubmit={submitOtpRequest}>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="phone">Phone number</label>
          <Input id="phone" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+919876543210" autoComplete="tel" className="min-h-12" />
        </div>
        <motion.div whileTap={canAnimate ? { scale: 0.98 } : undefined}>
          <Button className="min-h-12 w-full" type="submit" disabled={isSubmitting || phone.trim().length < 5}>
            {isSubmitting ? "Sending..." : "Send OTP"}
          </Button>
        </motion.div>
      </form>

      <AnimatePresence initial={false}>
        {otpRequested ? (
          <motion.form
            key="otp-code-form"
            initial={canAnimate ? { opacity: 0, y: 10 } : false}
            animate={{ opacity: 1, y: 0 }}
            exit={canAnimate ? { opacity: 0, y: -8 } : undefined}
            transition={{ duration: canAnimate ? 0.24 : 0 }}
            className="space-y-4 rounded-lg border border-border bg-surface-muted p-4"
            onSubmit={submitOtpVerify}
          >
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="otp-code">OTP code</label>
              <Input id="otp-code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="6 digits" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="min-h-12" />
            </div>
            {devCode ? <p className="text-sm text-muted-foreground">Local dev code: <span className="font-medium text-foreground">{devCode}</span></p> : null}
            <motion.div whileTap={canAnimate ? { scale: 0.98 } : undefined}>
              <Button className="min-h-12 w-full" type="submit" disabled={isSubmitting || code.length !== 6}>
                {isSubmitting ? "Verifying..." : "Verify and continue"}
              </Button>
            </motion.div>
          </motion.form>
        ) : null}
      </AnimatePresence>

      <StatusMessages status={status} error={error} />
    </div>
  );
}

function StaffLoginFlow() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const canAnimate = !prefersReducedMotion;
  const [email, setEmail] = useState("admin@movex.local");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitStaffLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus(null);
    setIsSubmitting(true);

    try {
      const result = await adminLogin({ email, password, mfaCode: mfaCode || undefined });
      router.replace(routeForRole(result.user.role));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sign in.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-surface-muted p-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-ride-soft text-ride"><Building2 size={18} aria-hidden={true} /></span>
          <div>
            <p className="text-sm font-medium text-foreground">Staff console</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">Email, password, and MFA for operations users.</p>
          </div>
        </div>
      </div>

      <form className="space-y-4" onSubmit={submitStaffLogin}>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="staff-email">Email</label>
          <Input id="staff-email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@movex.local" autoComplete="email" className="min-h-12" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="staff-password">Password</label>
          <Input id="staff-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" autoComplete="current-password" className="min-h-12" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="staff-mfa">MFA code</label>
          <Input id="staff-mfa" value={mfaCode} onChange={(event) => setMfaCode(event.target.value)} placeholder="Optional for local setup" inputMode="numeric" maxLength={6} className="min-h-12" />
        </div>
        <motion.div whileTap={canAnimate ? { scale: 0.98 } : undefined}>
          <Button className="min-h-12 w-full" type="submit" disabled={isSubmitting || !email || !password}>
            {isSubmitting ? "Signing in..." : "Sign in to ops"}
          </Button>
        </motion.div>
      </form>

      <StatusMessages status={status} error={error} />
    </div>
  );
}

function AuthFrame({ eyebrow, title, description, backHref, children }: { eyebrow: string; title: string; description: string; backHref?: string; children: ReactNode }) {
  const prefersReducedMotion = useReducedMotion();
  const [showIntro, setShowIntro] = useState(true);
  const [introReady, setIntroReady] = useState(false);
  const canAnimate = !prefersReducedMotion;
  const revealTransition = canAnimate ? { duration: 0.48, ease: "easeOut" as const } : { duration: 0 };

  useEffect(() => {
    if (prefersReducedMotion) {
      setShowIntro(false);
      setIntroReady(true);
      return;
    }

    const hasSeenIntro = window.sessionStorage.getItem(INTRO_SESSION_KEY) === "true";

    if (hasSeenIntro) {
      setShowIntro(false);
      setIntroReady(true);
      return;
    }

    setIntroReady(true);
    const timer = window.setTimeout(() => {
      window.sessionStorage.setItem(INTRO_SESSION_KEY, "true");
      setShowIntro(false);
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [prefersReducedMotion]);

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <AnimatePresence>{showIntro && introReady && canAnimate ? <LoginIntro key="login-intro" /> : null}</AnimatePresence>

      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-start px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <motion.div
          layout={canAnimate}
          initial={canAnimate ? { opacity: 0.96, scale: 0.985 } : false}
          animate={{ opacity: 1, scale: 1 }}
          transition={revealTransition}
          className="grid w-full overflow-hidden rounded-lg border border-border bg-surface shadow-[var(--shadow-shell)] lg:min-h-[min(44rem,calc(100vh-3rem))] lg:grid-cols-[minmax(0,0.95fr)_minmax(25rem,0.8fr)]"
        >
          <section className="relative flex min-h-[17rem] overflow-hidden bg-primary p-5 text-primary-foreground sm:min-h-[22rem] sm:p-8 lg:min-h-0">
            <div className="relative z-10 flex w-full flex-col justify-between gap-10">
              <div className="flex items-center justify-between gap-4">
                <LogoLockup />
                <Link href="/" className="hidden rounded-md border border-primary-foreground/20 px-3 py-2 text-sm font-medium text-primary-foreground/80 transition hover:bg-primary-foreground/10 hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/35 sm:inline-flex">
                  Home
                </Link>
              </div>

              <div className="max-w-xl">
                <p className="text-sm font-medium uppercase tracking-[0.16em] text-primary-foreground/70">One account. Every vertical.</p>
                <h1 className="mt-3 max-w-[18.5rem] break-words text-2xl font-medium leading-[1.08] tracking-normal sm:mt-4 sm:max-w-lg sm:text-5xl">Sign in through the right door.</h1>
                <p className="mt-4 max-w-[18.5rem] text-sm font-normal leading-6 text-primary-foreground/74 sm:mt-5 sm:text-base sm:leading-7">Customers, partners, and staff each get a focused route while the backend still authenticates with a locked role.</p>
              </div>

              <div className="hidden flex-wrap gap-2 sm:flex">
                {trustChips.map((chip) => (
                  <span key={chip} className="rounded-full border border-primary-foreground/18 bg-primary-foreground/10 px-3 py-1.5 text-xs font-medium text-primary-foreground/82">
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <motion.section
            initial={canAnimate ? { opacity: 0, y: 18 } : false}
            animate={{ opacity: showIntro && canAnimate ? 0 : 1, y: showIntro && canAnimate ? 18 : 0 }}
            transition={canAnimate ? { duration: 0.46, delay: showIntro ? 0 : 0.08, ease: "easeOut" } : { duration: 0 }}
            className="flex min-h-0 flex-col bg-surface/98 p-5 backdrop-blur sm:p-6 lg:p-8"
            aria-labelledby="login-title"
          >
            <motion.div className="flex min-h-0 flex-1 flex-col" initial={canAnimate ? "hidden" : false} animate={showIntro && canAnimate ? "hidden" : "show"} variants={{ hidden: {}, show: { transition: { staggerChildren: 0.065, delayChildren: 0.08 } } }}>
              <FormReveal canAnimate={canAnimate}>
                {backHref ? (
                  <Link href={backHref} className="mb-5 inline-flex items-center gap-2 rounded-md text-sm font-medium text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
                    <ArrowLeft className="size-4" aria-hidden={true} /> Back
                  </Link>
                ) : null}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-primary">{eyebrow}</p>
                    <h2 id="login-title" className="mt-1 text-2xl font-medium text-foreground">{title}</h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
                  </div>
                  <span className="hidden rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary sm:inline-flex">Secure</span>
                </div>
              </FormReveal>

              <FormReveal canAnimate={canAnimate}>
                <div className="mt-6 min-h-0">{children}</div>
              </FormReveal>

              <FormReveal canAnimate={canAnimate}>
                <div className="mt-6 flex items-center gap-2 border-t border-border pt-5 text-sm text-muted-foreground lg:mt-auto">
                  <Headphones size={16} aria-hidden={true} />
                  <span>For local testing, keep the backend running on port 3001.</span>
                </div>
              </FormReveal>
            </motion.div>
          </motion.section>
        </motion.div>
      </div>
    </main>
  );
}

function AuthOptionCard({ href, label, description, icon: Icon, tone }: { href: string; label: string; description: string; icon: LucideIcon; tone: string }) {
  return (
    <Link href={href} className="group rounded-lg border border-border bg-surface p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
      <span className="flex items-start justify-between gap-4">
        <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-md", tone)}>
          <Icon className="size-5" aria-hidden={true} />
        </span>
        <ChevronRight className="mt-1 size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden={true} />
      </span>
      <span className="mt-5 block text-lg font-medium text-foreground">{label}</span>
      <span className="mt-2 block text-sm leading-6 text-muted-foreground">{description}</span>
    </Link>
  );
}

function StatusMessages({ status, error }: { status: string | null; error: string | null }) {
  return (
    <div className="min-h-11" aria-live="polite">
      {status ? <p className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">{status}</p> : null}
      {error ? <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

function LoginIntro() {
  return (
    <motion.div className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-primary text-primary-foreground" aria-hidden="true" initial={{ opacity: 1 }} exit={{ opacity: 0, y: -18 }} transition={{ duration: 0.28, ease: "easeOut" }}>
      <motion.div layout className="flex min-h-[18rem] flex-col items-center justify-center px-6 text-center">
        <motion.div initial={{ opacity: 0, scale: 0.72 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 360, damping: 24 }} className="flex size-20 items-center justify-center rounded-lg bg-primary-foreground text-3xl font-medium text-primary shadow-[var(--shadow-shell)]">
          M
        </motion.div>
        <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, duration: 0.28, ease: "easeOut" }} className="mt-6 text-4xl font-medium tracking-normal">
          MoveX
        </motion.p>
        <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.28, ease: "easeOut" }} className="mt-2 text-base font-normal text-primary-foreground/76">
          One account. Every vertical.
        </motion.p>
        <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.065, delayChildren: 0.34 } } }} className="mt-8 flex max-w-lg flex-wrap justify-center gap-2">
          {verticalChips.map((chip) => (
            <motion.span key={chip} variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} transition={{ duration: 0.22, ease: "easeOut" }} className="rounded-full border border-primary-foreground/18 bg-primary-foreground/10 px-3 py-1.5 text-xs font-medium text-primary-foreground/78">
              {chip}
            </motion.span>
          ))}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

function LogoLockup() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-11 items-center justify-center rounded-md bg-primary-foreground text-lg font-medium text-primary shadow-sm">M</div>
      <div>
        <p className="text-xl font-medium tracking-normal">MoveX</p>
        <p className="hidden text-sm font-normal text-primary-foreground/70 sm:block">India local-services super-app</p>
      </div>
    </div>
  );
}

function FormReveal({ canAnimate, children }: { canAnimate: boolean; children: ReactNode }) {
  return (
    <motion.div variants={{ hidden: canAnimate ? { opacity: 0, y: 10 } : {}, show: { opacity: 1, y: 0 } }} transition={{ duration: canAnimate ? 0.28 : 0, ease: "easeOut" }}>
      {children}
    </motion.div>
  );
}
