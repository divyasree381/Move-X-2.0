"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Bike, Building2, Headphones, Smartphone, Store, Truck } from "lucide-react";

import { adminLogin, requestOtpLogin, routeForRole, type OtpLoginRole, verifyOtpLogin } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const INTRO_SESSION_KEY = "movex-login-intro-seen";

const otpRoles: Array<{ value: OtpLoginRole; label: string; description: string }> = [
  { value: "CUSTOMER", label: "Customer", description: "Order food, groceries, medicines, rides and services." },
  { value: "RESTAURANT", label: "Store partner", description: "Manage restaurant, grocery or pharmacy orders." },
  { value: "DELIVERY", label: "Delivery partner", description: "Accept delivery and courier jobs." },
  { value: "DRIVER", label: "Driver", description: "Accept ride requests and mobility jobs." },
];

const roleIcons: Record<OtpLoginRole, typeof Smartphone> = {
  CUSTOMER: Smartphone,
  RESTAURANT: Store,
  DELIVERY: Truck,
  DRIVER: Bike,
};

const verticalChips = ["Food", "Grocery", "Pharmacy", "Rides", "Courier", "Home"];
const trustChips = ["OTP secure", "Ledger backed", "24/7 ops"];

type LoginMode = "otp" | "staff";

export function LoginPage() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const [showIntro, setShowIntro] = useState(true);
  const [introReady, setIntroReady] = useState(false);
  const [mode, setMode] = useState<LoginMode>("otp");
  const [role, setRole] = useState<OtpLoginRole>("CUSTOMER");
  const [phone, setPhone] = useState("+919876543210");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [otpRequested, setOtpRequested] = useState(false);
  const [email, setEmail] = useState("admin@movex.local");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedRole = useMemo(() => otpRoles.find((item) => item.value === role) ?? otpRoles[0]!, [role]);
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
    }, 1650);

    return () => window.clearTimeout(timer);
  }, [prefersReducedMotion]);

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

  function switchMode(nextMode: LoginMode) {
    setMode(nextMode);
    setError(null);
    setStatus(null);
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <AnimatePresence>
        {showIntro && introReady && canAnimate ? <LoginIntro key="login-intro" /> : null}
      </AnimatePresence>

      <div className="mx-auto grid min-h-screen w-full max-w-6xl gap-6 px-4 py-4 sm:px-6 sm:py-6 lg:grid-cols-[minmax(0,1fr)_28rem] lg:items-center lg:gap-10 lg:px-8">
        <motion.section
          layout={canAnimate}
          initial={canAnimate ? { opacity: 0.96, scale: 0.985 } : false}
          animate={{ opacity: 1, scale: 1 }}
          transition={revealTransition}
          className="relative flex min-w-0 justify-self-center min-h-[15rem] w-72 max-w-full sm:w-full overflow-hidden rounded-lg border border-primary/20 bg-primary p-5 text-primary-foreground shadow-[var(--shadow-shell)] sm:min-h-[22rem] sm:p-8 lg:min-h-[42rem]"
        >
          <div className="relative z-10 flex w-full flex-col justify-between gap-10">
            <div className="flex items-center justify-between gap-4">
              <LogoLockup compact={false} />
              <Link href="/customer" className="hidden rounded-md border border-primary-foreground/20 px-3 py-2 text-sm font-medium text-primary-foreground/80 transition hover:bg-primary-foreground/10 hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/35 sm:inline-flex">
                Browse
              </Link>
            </div>

            <div className="max-w-xl">
              <p className="text-sm font-medium uppercase tracking-[0.16em] text-primary-foreground/70">One account. Every vertical.</p>
              <h1 className="mt-3 max-w-[18.5rem] break-words text-2xl font-medium leading-[1.08] tracking-normal sm:mt-4 sm:max-w-lg sm:text-5xl">Move through the city with one calm sign-in.</h1>
              <p className="mt-4 max-w-[18.5rem] text-sm font-normal leading-6 text-primary-foreground/74 sm:mt-5 sm:text-base sm:leading-7">Customers, partners, and ops teams enter through the same secure MoveX identity layer.</p>
            </div>

            <div className="hidden flex-wrap gap-2 sm:flex">
              {trustChips.map((chip) => (
                <span key={chip} className="rounded-full border border-primary-foreground/18 bg-primary-foreground/10 px-3 py-1.5 text-xs font-medium text-primary-foreground/82">
                  {chip}
                </span>
              ))}
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={canAnimate ? { opacity: 0, y: 18 } : false}
          animate={{ opacity: showIntro && canAnimate ? 0 : 1, y: showIntro && canAnimate ? 18 : 0 }}
          transition={canAnimate ? { duration: 0.46, delay: showIntro ? 0 : 0.08, ease: "easeOut" } : { duration: 0 }}
          className="min-w-0 w-72 justify-self-center max-w-full rounded-lg sm:w-full border border-border bg-surface/96 p-5 shadow-[var(--shadow-shell)] backdrop-blur sm:p-6"
          aria-labelledby="login-title"
        >
          <motion.div
            initial={canAnimate ? "hidden" : false}
            animate={showIntro && canAnimate ? "hidden" : "show"}
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.065, delayChildren: 0.08 } } }}
          >
            <FormReveal canAnimate={canAnimate}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-primary">Welcome back</p>
                  <h2 id="login-title" className="mt-1 text-2xl font-medium text-foreground">Sign in</h2>
                </div>
                <span className="hidden rounded-full border border-border bg-surface-muted px-3 py-1.5 text-xs font-medium text-muted-foreground sm:inline-flex">Secure session</span>
              </div>
            </FormReveal>

            <FormReveal canAnimate={canAnimate}>
              <div className="mt-6 grid min-w-0 grid-cols-2 rounded-md border border-border bg-surface-muted p-1" role="tablist" aria-label="Login type">
                <motion.button
                  type="button"
                  role="tab"
                  aria-selected={mode === "otp"}
                  whileTap={canAnimate ? { scale: 0.98 } : undefined}
                  className={cn(
                    "rounded-sm px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                    mode === "otp" ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => switchMode("otp")}
                >
                  Phone OTP
                </motion.button>
                <motion.button
                  type="button"
                  role="tab"
                  aria-selected={mode === "staff"}
                  whileTap={canAnimate ? { scale: 0.98 } : undefined}
                  className={cn(
                    "rounded-sm px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                    mode === "staff" ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => switchMode("staff")}
                >
                  Staff login
                </motion.button>
              </div>
            </FormReveal>

            <AnimatePresence mode="wait" initial={false}>
              {mode === "otp" ? (
                <motion.div key="otp-login" initial={canAnimate ? { opacity: 0, y: 8 } : false} animate={{ opacity: 1, y: 0 }} exit={canAnimate ? { opacity: 0, y: -8 } : undefined} transition={{ duration: canAnimate ? 0.24 : 0 }} className="mt-6 space-y-5">
                  <FormReveal canAnimate={canAnimate}>
                    <div className="grid min-w-0 gap-2">
                      {otpRoles.map((item) => {
                        const Icon = roleIcons[item.value];
                        const selected = role === item.value;

                        return (
                          <motion.button
                            key={item.value}
                            type="button"
                            whileHover={canAnimate ? { y: -2 } : undefined}
                            whileTap={canAnimate ? { scale: 0.98 } : undefined}
                            className={cn(
                              "min-w-0 rounded-md border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                              selected ? "border-primary bg-primary/10 shadow-sm" : "border-border bg-surface hover:border-primary/35 hover:bg-surface-muted",
                            )}
                            onClick={() => setRole(item.value)}
                            aria-pressed={selected}
                          >
                            <span className="flex min-w-0 items-start gap-3">
                              <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-md", selected ? "bg-primary text-primary-foreground" : "bg-surface-muted text-muted-foreground")}>
                                <Icon size={18} aria-hidden={true} />
                              </span>
                              <span className="min-w-0">
                                <span className="block text-sm font-medium text-foreground">{item.label}</span>
                                <span className="mt-0.5 block break-words text-sm leading-5 text-muted-foreground">{item.description}</span>
                              </span>
                            </span>
                          </motion.button>
                        );
                      })}
                    </div>
                  </FormReveal>

                  <FormReveal canAnimate={canAnimate}>
                    <form className="space-y-4" onSubmit={submitOtpRequest}>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium" htmlFor="phone">Phone number</label>
                        <Input id="phone" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+919876543210" autoComplete="tel" className="min-h-12" />
                      </div>
                      <motion.div whileTap={canAnimate ? { scale: 0.98 } : undefined}>
                        <Button className="min-h-12 w-full" type="submit" disabled={isSubmitting || phone.trim().length < 5}>
                          {isSubmitting ? "Sending..." : `Send OTP as ${selectedRole.label}`}
                        </Button>
                      </motion.div>
                    </form>
                  </FormReveal>

                  <AnimatePresence initial={false}>
                    {otpRequested ? (
                      <motion.form
                        key="otp-code-form"
                        initial={canAnimate ? { opacity: 0, y: 10 } : false}
                        animate={{ opacity: 1, y: 0 }}
                        exit={canAnimate ? { opacity: 0, y: -8 } : undefined}
                        transition={{ duration: canAnimate ? 0.24 : 0 }}
                        className="space-y-4 rounded-md border border-border bg-surface-muted p-4"
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
                </motion.div>
              ) : (
                <motion.form key="staff-login" initial={canAnimate ? { opacity: 0, y: 8 } : false} animate={{ opacity: 1, y: 0 }} exit={canAnimate ? { opacity: 0, y: -8 } : undefined} transition={{ duration: canAnimate ? 0.24 : 0 }} className="mt-6 space-y-4" onSubmit={submitStaffLogin}>
                  <div className="rounded-md border border-border bg-surface-muted p-4">
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 items-center justify-center rounded-md bg-ride-soft text-ride"><Building2 size={18} aria-hidden={true} /></span>
                      <div>
                        <p className="text-sm font-medium">Staff console</p>
                        <p className="text-sm text-muted-foreground">Support, finance, admin and super admin roles.</p>
                      </div>
                    </div>
                  </div>
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
                </motion.form>
              )}
            </AnimatePresence>

            <FormReveal canAnimate={canAnimate}>
              <div className="mt-5 min-h-11" aria-live="polite">
                {status ? <p className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">{status}</p> : null}
                {error ? <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
              </div>
            </FormReveal>

            <FormReveal canAnimate={canAnimate}>
              <div className="mt-2 flex items-center gap-2 border-t border-border pt-5 text-sm text-muted-foreground">
                <Headphones size={16} aria-hidden={true} />
                <span>For local testing, keep the backend running on port 3001.</span>
              </div>
            </FormReveal>
          </motion.div>
        </motion.section>
      </div>
    </main>
  );
}

function LoginIntro() {
  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-primary text-primary-foreground"
      aria-hidden="true"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, y: -18 }}
      transition={{ duration: 0.34, ease: "easeOut" }}
    >
      <motion.div layout className="flex min-h-[18rem] flex-col items-center justify-center px-6 text-center">
        <motion.div initial={{ opacity: 0, scale: 0.72 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 360, damping: 24 }} className="flex size-20 items-center justify-center rounded-lg bg-primary-foreground text-3xl font-medium text-primary shadow-[var(--shadow-shell)]">
          M
        </motion.div>
        <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16, duration: 0.34, ease: "easeOut" }} className="mt-6 text-4xl font-medium tracking-normal">
          MoveX
        </motion.p>
        <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26, duration: 0.34, ease: "easeOut" }} className="mt-2 text-base font-normal text-primary-foreground/76">
          One account. Every vertical.
        </motion.p>
        <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.075, delayChildren: 0.42 } } }} className="mt-8 flex max-w-lg flex-wrap justify-center gap-2">
          {verticalChips.map((chip) => (
            <motion.span key={chip} variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} transition={{ duration: 0.24, ease: "easeOut" }} className="rounded-full border border-primary-foreground/18 bg-primary-foreground/10 px-3 py-1.5 text-xs font-medium text-primary-foreground/78">
              {chip}
            </motion.span>
          ))}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

function LogoLockup({ compact }: { compact: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-11 items-center justify-center rounded-md bg-primary-foreground text-lg font-medium text-primary shadow-sm">M</div>
      <div>
        <p className="text-xl font-medium tracking-normal">MoveX</p>
        {!compact ? <p className="hidden text-sm font-normal text-primary-foreground/70 sm:block">India local-services super-app</p> : null}
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