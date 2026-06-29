"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { Bike, Building2, Headphones, ShieldCheck, Smartphone, Store, Truck } from "lucide-react";

import { adminLogin, requestOtpLogin, routeForRole, type OtpLoginRole, verifyOtpLogin } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

type LoginMode = "otp" | "staff";

export function LoginPage() {
  const router = useRouter();
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
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto grid min-h-screen w-full max-w-6xl gap-8 px-5 py-6 lg:grid-cols-[1fr_440px] lg:items-center lg:px-8">
        <section className="flex min-h-[44rem] flex-col justify-between rounded-lg bg-primary p-6 text-primary-foreground shadow-[var(--shadow-shell)] lg:p-8">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-md bg-primary-foreground text-lg font-black text-primary">M</div>
              <div>
                <p className="text-xl font-black tracking-tight">MoveX</p>
                <p className="text-sm text-primary-foreground/70">India local-services super-app</p>
              </div>
            </div>
            <div className="mt-16 max-w-xl">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">One account. Every vertical.</p>
              <h1 className="mt-4 text-4xl font-black leading-tight tracking-normal sm:text-5xl">Sign in to manage delivery, rides, stores, and operations.</h1>
              <p className="mt-5 max-w-lg text-base leading-7 text-primary-foreground/75">Use phone OTP for customers and partners. Staff users sign in with email and password.</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <InfoTile icon={Store} label="Marketplace" value="Food, grocery, pharmacy" />
            <InfoTile icon={Bike} label="Mobility" value="Rides and courier" />
            <InfoTile icon={ShieldCheck} label="Ops" value="Support and finance" />
          </div>
        </section>

        <section className="rounded-lg border border-border bg-surface p-5 shadow-[var(--shadow-shell)] sm:p-6" aria-labelledby="login-title">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-primary">Welcome back</p>
              <h2 id="login-title" className="mt-1 text-2xl font-bold text-foreground">Sign in</h2>
            </div>
            <Link href="/customer" className="rounded-md border border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-surface-muted">
              Browse
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-2 rounded-md border border-border bg-surface-muted p-1" role="tablist" aria-label="Login type">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "otp"}
              className={mode === "otp" ? "rounded-sm bg-surface px-3 py-2 text-sm font-semibold shadow-sm" : "rounded-sm px-3 py-2 text-sm font-semibold text-muted-foreground"}
              onClick={() => switchMode("otp")}
            >
              Phone OTP
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "staff"}
              className={mode === "staff" ? "rounded-sm bg-surface px-3 py-2 text-sm font-semibold shadow-sm" : "rounded-sm px-3 py-2 text-sm font-semibold text-muted-foreground"}
              onClick={() => switchMode("staff")}
            >
              Staff login
            </button>
          </div>

          {mode === "otp" ? (
            <div className="mt-6 space-y-5">
              <div className="grid gap-3">
                {otpRoles.map((item) => {
                  const Icon = roleIcons[item.value];
                  const selected = role === item.value;

                  return (
                    <button
                      key={item.value}
                      type="button"
                      className={selected ? "rounded-md border border-primary bg-primary/10 p-3 text-left" : "rounded-md border border-border bg-surface p-3 text-left hover:bg-surface-muted"}
                      onClick={() => setRole(item.value)}
                      aria-pressed={selected}
                    >
                      <span className="flex items-start gap-3">
                        <span className={selected ? "flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground" : "flex size-9 items-center justify-center rounded-md bg-surface-muted text-muted-foreground"}>
                          <Icon size={18} aria-hidden={true} />
                        </span>
                        <span>
                          <span className="block text-sm font-semibold text-foreground">{item.label}</span>
                          <span className="mt-0.5 block text-sm text-muted-foreground">{item.description}</span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <form className="space-y-4" onSubmit={submitOtpRequest}>
                <div>
                  <label className="text-sm font-semibold" htmlFor="phone">Phone number</label>
                  <Input id="phone" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+919876543210" autoComplete="tel" />
                </div>
                <Button className="w-full" type="submit" disabled={isSubmitting || phone.trim().length < 5}>
                  {isSubmitting ? "Sending..." : `Send OTP as ${selectedRole.label}`}
                </Button>
              </form>

              {otpRequested ? (
                <form className="space-y-4 rounded-md border border-border bg-surface-muted p-4" onSubmit={submitOtpVerify}>
                  <div>
                    <label className="text-sm font-semibold" htmlFor="otp-code">OTP code</label>
                    <Input id="otp-code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="6 digits" inputMode="numeric" autoComplete="one-time-code" maxLength={6} />
                  </div>
                  {devCode ? <p className="text-sm text-muted-foreground">Local dev code: <span className="font-semibold text-foreground">{devCode}</span></p> : null}
                  <Button className="w-full" type="submit" disabled={isSubmitting || code.length !== 6}>
                    {isSubmitting ? "Verifying..." : "Verify and continue"}
                  </Button>
                </form>
              ) : null}
            </div>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={submitStaffLogin}>
              <div className="rounded-md border border-border bg-surface-muted p-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-md bg-ride-soft text-ride"><Building2 size={18} aria-hidden={true} /></span>
                  <div>
                    <p className="text-sm font-semibold">Staff console</p>
                    <p className="text-sm text-muted-foreground">Support, finance, admin and super admin roles.</p>
                  </div>
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold" htmlFor="staff-email">Email</label>
                <Input id="staff-email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@movex.local" autoComplete="email" />
              </div>
              <div>
                <label className="text-sm font-semibold" htmlFor="staff-password">Password</label>
                <Input id="staff-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" autoComplete="current-password" />
              </div>
              <div>
                <label className="text-sm font-semibold" htmlFor="staff-mfa">MFA code</label>
                <Input id="staff-mfa" value={mfaCode} onChange={(event) => setMfaCode(event.target.value)} placeholder="Optional for local setup" inputMode="numeric" maxLength={6} />
              </div>
              <Button className="w-full" type="submit" disabled={isSubmitting || !email || !password}>
                {isSubmitting ? "Signing in..." : "Sign in to ops"}
              </Button>
            </form>
          )}

          <div className="mt-5 min-h-6" aria-live="polite">
            {status ? <p className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">{status}</p> : null}
            {error ? <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
          </div>

          <div className="mt-6 flex items-center gap-2 border-t border-border pt-5 text-sm text-muted-foreground">
            <Headphones size={16} aria-hidden={true} />
            <span>For local testing, keep the backend running on port 3001.</span>
          </div>
        </section>
      </div>
    </main>
  );
}

function InfoTile({ icon: Icon, label, value }: { icon: typeof Smartphone; label: string; value: string }) {
  return (
    <div className="rounded-md border border-primary-foreground/20 bg-primary-foreground/10 p-3">
      <Icon size={18} aria-hidden={true} className="text-primary" />
      <p className="mt-3 text-sm font-semibold">{label}</p>
      <p className="mt-1 text-xs leading-5 text-primary-foreground/70">{value}</p>
    </div>
  );
}