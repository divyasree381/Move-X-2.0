"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, Bike, Building2, ChevronRight,
  Home, ShieldCheck, Store, Truck, UserRound, type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PARTNER_LOGIN_TYPE_SESSION_KEY, partnerLoginConfigs, type PartnerLoginConfig,
} from "@/lib/auth-flow";
import { acceptStaffInvitation, adminLogin, changeStaffPassword, currentUser, requestOtpLogin, requestStaffPasswordReset, resetStaffPassword, routeForAuthenticatedUser, type OtpLoginRole, verifyOtpLogin,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const INTRO_SESSION_KEY = "movex-login-intro-seen";
const SHOW_DEVELOPMENT_OTP = process.env.NODE_ENV === "development";
const serviceChips = ["Food", "Grocery", "Pharmacy", "Rides", "Courier", "Home"];
const trustChips = ["OTP secure", "Private sessions", "Role-protected"];

const partnerIcons: Record<PartnerLoginConfig["slug"], LucideIcon> = {
  "store-partner": Store,
  "delivery-partner": Truck,
  driver: Bike,
  "home-services-partner": Home,
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
    description: "Stores, delivery partners, drivers, and home-service partners.",
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
      <div className="grid gap-2.5">
        {gatewayOptions.map((option) => (
          <AuthOptionCard key={option.href} {...option} />))}
      </div>
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
    <AuthFrame eyebrow="Partner login" title="Select your partner type" description="Choose the workstream you belong to, then continue with phone OTP and verification." backHref="/login">
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
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
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
    <AuthFrame eyebrow="Partner OTP" title={`Continue as ${partner.label}`} description="Continue securely with the partner account type you selected." backHref="/login/partner">
      <div className="mb-3 rounded-md border border-border bg-surface-muted p-3">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon className="size-5" aria-hidden={true} />
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">{partner.label}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{partner.description}</p>
          </div>
        </div>
      </div>
      <OtpLoginFlow role={partner.backendRole} label={partner.label} description="We will send a 6-digit OTP to the phone linked with this partner account." partnerType={partner.slug} />
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

function OtpLoginFlow({ role, label, description, partnerType,
}: { role: OtpLoginRole; label: string; description: string; partnerType?: PartnerLoginConfig["slug"];
}) {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const canAnimate = !prefersReducedMotion;
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [otpRequested, setOtpRequested] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    let timer: number;
    if (isTimerActive && timeLeft > 0) {
      timer = window.setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsTimerActive(false);
      setCode("");
    }
    return () => window.clearInterval(timer);
  }, [isTimerActive, timeLeft]);

  useEffect(() => {
    if (code.length === 6 && !isSubmitting && timeLeft > 0) {
      void performVerify(code);
    }
  }, [code]);

  async function submitOtpRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus(null);
    setIsSubmitting(true);

    try {
      if (partnerType) {
        window.sessionStorage.setItem(PARTNER_LOGIN_TYPE_SESSION_KEY, partnerType);
      }

      const result = await requestOtpLogin({ phone, role });
      setOtpRequested(true);
      const developmentCode = SHOW_DEVELOPMENT_OTP ? (result.devCode ?? null) : null;
      setDevCode(developmentCode);
      setStatus(developmentCode ? "Your one-time code is ready." : result.message);
      setCode(developmentCode ?? "");
      setTimeLeft(300);
      setIsTimerActive(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not request OTP.");
    } finally {
      setIsSubmitting(false);
      setIsResending(false);
    }
  }

  async function performVerify(currentCode: string) {
    if (currentCode.length !== 6 || isSubmitting || timeLeft === 0) return;
    
    setError(null);
    setStatus(null);
    setIsSubmitting(true);

    try {
      const result = await verifyOtpLogin({ phone, role, code: currentCode });
      router.replace(routeForAuthenticatedUser(result.user));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not verify OTP.");
      setIsSubmitting(false);
    }
  }

  function submitOtpVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void performVerify(code);
  }

  async function handleResendOtp() {
    setIsResending(true);
    setCode("");
    setError(null);
    setStatus(null);

    try {
      const result = await requestOtpLogin({ phone, role });
      const developmentCode = SHOW_DEVELOPMENT_OTP ? (result.devCode ?? null) : null;
      setDevCode(developmentCode);
      setStatus(developmentCode ? "Your new one-time code is ready." : "A new OTP has been sent.");
      setCode(developmentCode ?? "");
      setTimeLeft(300);
      setIsTimerActive(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not resend OTP.");
    } finally {
      setIsResending(false);
    }
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div className="space-y-3">
      {!partnerType ? (
        <div className="rounded-md border border-border bg-surface-muted p-3">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
      ) : null}

      <form className="space-y-3" onSubmit={submitOtpRequest}>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="phone">Phone number</label>
          <Input id="phone" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+91 98765 43210" autoComplete="tel" className="min-h-11" />
        </div>
        <motion.div whileTap={canAnimate ? { scale: 0.98 } : undefined}>
          <Button className="min-h-11 w-full" type="submit" disabled={isSubmitting || phone.trim().length < 5}>
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
            className="space-y-3 rounded-md border border-border bg-surface-muted p-3"
            onSubmit={submitOtpVerify}
          >
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="otp-code">OTP code</label>
              <Input id="otp-code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="6 digits" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="min-h-11" disabled={isSubmitting || timeLeft === 0} />
            </div>
            {SHOW_DEVELOPMENT_OTP && devCode ? (
              <p className="text-sm text-muted-foreground">
                One-time code: <span className="font-medium text-foreground">{devCode}</span></p>
            ) : null}
            
            {timeLeft > 0 ? (
              <p className={`text-sm transition-colors duration-300 ${timeLeft <= 30 ? "text-destructive animate-pulse" : "text-muted-foreground"}`}>
                OTP expires in {formatTime(timeLeft)}
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium text-destructive">OTP Expired</p>
                <p className="text-sm text-muted-foreground">
                  Didn't receive the OTP?{" "}
                  <button type="button" onClick={handleResendOtp} disabled={isResending} className="font-medium text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 rounded-sm">
                    {isResending ? "Sending..." : "Resend OTP"}
                  </button>
                </p>
              </div>
            )}

            <motion.div whileTap={canAnimate ? { scale: 0.98 } : undefined}>
              <Button className="min-h-11 w-full" type="submit" disabled={isSubmitting || code.length !== 6 || timeLeft === 0}>
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitStaffLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus(null);
    setIsSubmitting(true);

    try {
      const result = await adminLogin({ email, password });
      router.replace(routeForAuthenticatedUser(result.user));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not sign in.";

      setError(message);
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
            <p className="mt-1 text-sm leading-6 text-muted-foreground">Use your registered staff email and password. Access is limited by your assigned role.</p>
          </div>
        </div>
      </div>

      <form className="space-y-4" onSubmit={submitStaffLogin}>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="staff-email">Email</label>
          <Input id="staff-email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" autoComplete="email" className="min-h-11" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="staff-password">Password</label>
          <Input id="staff-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" autoComplete="current-password" className="min-h-11" />
        </div>
        <motion.div whileTap={canAnimate ? { scale: 0.98 } : undefined}>
          <Button className="min-h-11 w-full" type="submit" disabled={isSubmitting || !email || !password}>
            {isSubmitting ? "Signing in..." : "Sign in to ops"}
          </Button>
          <Link href="/login/staff/forgot" className="mt-3 block text-center text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">Forgot password?</Link>
        </motion.div>
      </form>

      <StatusMessages status={status} error={error} />
    </div>
  );
}

export function StaffForgotPasswordPage() {
  return (
    <AuthFrame eyebrow="Staff recovery" title="Reset your password" description="Enter your registered staff email. We will send a secure, time-limited reset link." backHref="/login/staff">
      <StaffForgotPasswordFlow />
    </AuthFrame>
  );
}

export function StaffResetPasswordPage() {
  return (
    <AuthFrame eyebrow="Staff recovery" title="Choose a new password" description="Create a strong password for your MoveX staff account." backHref="/login/staff">
      <StaffTokenPasswordFlow mode="reset" />
    </AuthFrame>
  );
}

export function StaffActivationPage() {
  const params = useSearchParams();
  const hasInvitation = Boolean(params.get("token"));

  return (
    <AuthFrame
      eyebrow="Staff activation"
      title={hasInvitation ? "Activate your staff account" : "Secure your account"}
      description={hasInvitation ? "Verify your email and replace the temporary password." : "Replace the temporary password before entering the operations console."}
      backHref="/login/staff"
    >
      <StaffTokenPasswordFlow mode={hasInvitation ? "invitation" : "change"} />
    </AuthFrame>
  );
}

function StaffForgotPasswordFlow() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await requestStaffPasswordReset({ email });
      setStatus(result.message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not request a password reset.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <label className="block space-y-1.5 text-sm font-medium" htmlFor="recovery-email">
        Staff email
        <Input id="recovery-email" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="name@company.com" className="min-h-11" />
      </label>
      <Button className="min-h-11 w-full" type="submit" disabled={isSubmitting || !email}>
        {isSubmitting ? "Sending..." : "Send reset link"}
      </Button>
      <StatusMessages status={status} error={error} />
    </form>
  );
}

function StaffTokenPasswordFlow({ mode }: { mode: "invitation" | "reset" | "change" }) {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(mode === "change");

  useEffect(() => {
    if (mode !== "change") {
      return;
    }

    void currentUser().then(({ user }) => {
      setRequiresPasswordChange(Boolean(user.mustChangePassword));

      if (user.emailVerifiedAt && !user.mustChangePassword) {
        router.replace("/ops");
      }
    }).catch(() => router.replace("/login/staff"));
  }, [mode, router]);

  const tokenRequired = mode !== "change";
  const canSubmit = (!tokenRequired || token.length > 0) && (mode !== "change" || currentPassword.length > 0) && newPassword.length >= 12 && newPassword === confirmation;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (newPassword !== confirmation) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === "invitation") {
        await acceptStaffInvitation({ token, newPassword });
        setStatus("Account activated. You can now sign in.");
      } else if (mode === "reset") {
        await resetStaffPassword({ token, newPassword });
        setStatus("Password reset complete. You can now sign in.");
      } else {
        await changeStaffPassword({ currentPassword, newPassword });
        setStatus("Password changed. Sign in again to continue.");
      }

      window.setTimeout(() => router.replace("/login/staff"), 700);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update the password.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (tokenRequired && !token) {
    return <StatusMessages status={null} error="This link is incomplete. Request a new invitation or password reset email." />;
  }

  if (mode === "change" && !requiresPasswordChange) {
    return (
      <div className="space-y-4">
        <StatusMessages status="Your password is updated. Use the activation link sent to your registered email to verify the account." error={null} />
        <Link href="/login/staff" className="block text-center text-sm font-medium text-primary hover:underline">Return to staff login</Link>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      {mode === "change" ? (
        <label className="block space-y-1.5 text-sm font-medium" htmlFor="current-staff-password">
          Temporary password
          <Input id="current-staff-password" required type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" className="min-h-11" />
        </label>
      ) : null}
      <label className="block space-y-1.5 text-sm font-medium" htmlFor="new-staff-password">
        New password
        <Input id="new-staff-password" required minLength={12} type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" className="min-h-11" />
        <span className="block text-xs font-normal text-muted-foreground">Use at least 12 characters.</span>
      </label>
      <label className="block space-y-1.5 text-sm font-medium" htmlFor="confirm-staff-password">
        Confirm new password
        <Input id="confirm-staff-password" required minLength={12} type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" className="min-h-11" />
      </label>
      <Button className="min-h-11 w-full" type="submit" disabled={isSubmitting || !canSubmit}>
        {isSubmitting ? "Saving..." : mode === "invitation" ? "Activate account" : "Update password"}
      </Button>
      {mode === "change" ? <p className="text-xs leading-5 text-muted-foreground">Email verification is completed through the invitation link sent to your registered address.</p> : null}
      <StatusMessages status={status} error={error} />
    </form>
  );
}
function AuthFrame({ eyebrow, title, description, backHref, children,
}: { eyebrow: string; title: string; description: string; backHref?: string; children: ReactNode;
}) {
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
    <main className="relative min-h-screen overflow-x-hidden bg-background text-foreground lg:h-dvh lg:min-h-0 lg:overflow-hidden">
      <AnimatePresence>{showIntro && introReady && canAnimate ? <LoginIntro key="login-intro" /> : null}</AnimatePresence>

      <div className="mx-auto flex min-h-dvh w-full max-w-[72rem] items-center px-4 py-3 sm:px-5 sm:py-4 lg:h-dvh lg:min-h-0 lg:px-6 lg:py-6">
        <motion.div
          layout={canAnimate}
          initial={canAnimate ? { opacity: 0.96, scale: 0.985 } : false}
          animate={{ opacity: 1, scale: 1 }}
          transition={revealTransition}
          className="grid w-full overflow-hidden rounded-lg border border-border bg-surface shadow-[var(--shadow-shell)] lg:h-[min(42rem,calc(100dvh-3rem))] lg:grid-cols-[minmax(0,0.78fr)_minmax(26rem,1fr)]"
        >
          <section className="relative flex min-h-[12rem] overflow-hidden bg-primary p-5 text-primary-foreground sm:min-h-[15rem] sm:p-6 lg:min-h-0 lg:p-8">
            <div className="relative z-10 flex w-full flex-col justify-between gap-6">
              <div className="flex items-center justify-between gap-4">
                <LogoLockup />
                <Link href="/" className="hidden rounded-md border border-primary-foreground/20 px-3 py-2 text-sm font-medium text-primary-foreground/80 transition hover:bg-primary-foreground/10 hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/35 sm:inline-flex">
                  Home
                </Link>
              </div>

              <div className="max-w-md">
                <p className="text-sm font-medium uppercase tracking-[0.16em] text-primary-foreground/70">One account. Every service.</p>
                <h1 className="mt-3 max-w-[18.5rem] break-words text-2xl font-medium leading-[1.1] tracking-normal sm:max-w-md sm:text-3xl lg:text-4xl">Sign in through the right door.</h1>
                <p className="mt-3 max-w-sm text-sm font-normal leading-6 text-primary-foreground/74 sm:text-base">Customers, partners, and staff each get a secure sign-in path designed around what
                  they need to do.</p>
              </div>

              <div className="hidden flex-wrap gap-2 lg:flex">
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
            animate={{ opacity: showIntro && canAnimate ? 0 : 1, y: showIntro && canAnimate ? 18 : 0,
            }}
            transition={canAnimate ? { duration: 0.46, delay: showIntro ? 0 : 0.08, ease: "easeOut" } : { duration: 0 }}
            className="flex min-h-0 flex-col overflow-y-auto bg-surface/98 p-4 backdrop-blur sm:p-5 lg:p-6"
            aria-labelledby="login-title"
          >
            <motion.div className="flex min-h-0 flex-1 flex-col" initial={canAnimate ? "hidden" : false} animate={showIntro && canAnimate ? "hidden" : "show"} variants={{ hidden: {}, show: { transition: { staggerChildren: 0.065, delayChildren: 0.08 } },
              }}>
              <FormReveal canAnimate={canAnimate}>
                {backHref ? (
                  <Link href={backHref} className="mb-3 inline-flex items-center gap-2 rounded-md text-sm font-medium text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
                    <ArrowLeft className="size-4" aria-hidden={true} /> Back
                  </Link>
                ) : null}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-primary">{eyebrow}</p>
                    <h2 id="login-title" className="mt-1 text-2xl font-medium text-foreground">{title}</h2>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
                  </div>
                  <span className="hidden rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary sm:inline-flex">Secure</span>
                </div>
              </FormReveal>

              <FormReveal canAnimate={canAnimate}>
                <div className="mt-3 min-h-0">{children}</div>
              </FormReveal>

              </motion.div>
          </motion.section>
        </motion.div>
      </div>
    </main>
  );
}

function AuthOptionCard({ href, label, description, icon: Icon, tone,
}: { href: string; label: string; description: string; icon: LucideIcon; tone: string;
}) {
  return (
    <Link href={href} className="group flex min-h-[6.5rem] items-center gap-4 rounded-lg border border-border bg-surface p-3.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
      <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-md", tone)}>
        <Icon className="size-5" aria-hidden={true} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-medium text-foreground">{label}</span>
        <span className="mt-1 block text-sm leading-5 text-muted-foreground">{description}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden={true} />
    </Link>
  );
}

function StatusMessages({ status, error }: { status: string | null; error: string | null }) {
  return (
    <div className="min-h-11" aria-live="polite">
      {status ? (
        <p className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">{status}</p>
      ) : null}
      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      ) : null}
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
          One account. Every service.
        </motion.p>
        <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.065, delayChildren: 0.34 } },
          }} className="mt-8 flex max-w-lg flex-wrap justify-center gap-2">
          {serviceChips.map((chip) => (
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
