"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ClipboardCheck, FileText, IdCard, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";

import { Button, ErrorState, Input, Skeleton, StatusPill } from "@/components/ui";
import { partnerLoginConfigs, PARTNER_LOGIN_TYPE_SESSION_KEY, type PartnerLoginConfig } from "@/lib/auth-flow";
import { currentUser, isPartnerAuthRole, routeForAuthenticatedUser, submitPartnerProfile, type AuthUser } from "@/lib/api";
import { cn } from "@/lib/utils";

const steps: Array<{ title: string; description: string; icon: LucideIcon }> = [
  { title: "Account", description: "Confirm the role attached to this login.", icon: ShieldCheck },
  { title: "Profile", description: "Add the public name customers and ops teams see.", icon: UserRound },
  { title: "Documents", description: "Prepare identity, bank, and work proof for review.", icon: IdCard },
  { title: "Review", description: "Submit the profile for admin approval.", icon: ClipboardCheck },
];

const roleLabels: Record<string, string> = {
  RESTAURANT: "Store partner",
  DELIVERY: "Delivery partner",
  DRIVER: "Driver",
};

export function PartnerOnboardingPage() {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState(0);
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [serviceArea, setServiceArea] = useState("Bengaluru");
  const [documentRef, setDocumentRef] = useState("");
  const [bankRef, setBankRef] = useState("");
  const [consent, setConsent] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<PartnerLoginConfig | null>(null);
  const [submittedUser, setSubmittedUser] = useState<AuthUser | null>(null);

  const me = useQuery({ queryKey: ["auth-me"], queryFn: currentUser, retry: false });
  const user = submittedUser ?? me.data?.user ?? null;
  const partnerApproval = user?.partnerApproval ?? "NONE";
  const isApproved = partnerApproval === "APPROVED";
  const isPartner = Boolean(user && isPartnerAuthRole(user.role));
  const partnerLabel = selectedPartner?.label ?? (user ? roleLabels[user.role] ?? "Partner" : "Partner");

  useEffect(() => {
    const storedType = window.sessionStorage.getItem(PARTNER_LOGIN_TYPE_SESSION_KEY);
    const config = partnerLoginConfigs.find((partner) => partner.slug === storedType);

    if (config) {
      setSelectedPartner(config);
    }
  }, []);

  useEffect(() => {
    if (user?.name && !name) {
      setName(user.name);
    }

    if (user?.avatarUrl && !avatarUrl) {
      setAvatarUrl(user.avatarUrl);
    }
  }, [avatarUrl, name, user]);

  const requiredItems = useMemo(() => getRequirements(partnerLabel), [partnerLabel]);
  const isReviewLocked = partnerApproval === "PENDING";
  const canSubmit = name.trim().length >= 2 && serviceArea.trim().length >= 2 && documentRef.trim().length >= 3 && bankRef.trim().length >= 3 && consent && !isReviewLocked;

  useEffect(() => {
    if (partnerApproval === "PENDING" || partnerApproval === "APPROVED") {
      setActiveStep(3);
    }
  }, [partnerApproval]);

  const mutation = useMutation({
    mutationFn: () => submitPartnerProfile({ name: name.trim(), avatarUrl: avatarUrl.trim() || undefined }),
    onSuccess: (nextUser) => {
      setSubmittedUser(nextUser);
      setActiveStep(3);
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (activeStep < steps.length - 1) {
      setActiveStep((step) => Math.min(step + 1, steps.length - 1));
      return;
    }

    if (canSubmit) {
      mutation.mutate();
    }
  }

  if (me.isLoading) {
    return <OnboardingShell><Skeleton className="min-h-[34rem]" /></OnboardingShell>;
  }

  if (me.isError || !user) {
    return (
      <OnboardingShell>
        <ErrorState title="Sign in required" description="Log in as a partner to continue verification." action={<Button asChild><Link href="/login/partner">Partner login</Link></Button>} />
      </OnboardingShell>
    );
  }

  if (!isPartner) {
    return (
      <OnboardingShell>
        <ErrorState title="Partner account required" description="This verification flow is only available for partner roles." action={<Button asChild><Link href={routeForAuthenticatedUser(user)}>Go to your dashboard</Link></Button>} />
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell>
      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <aside className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <Link href="/login/partner" className="inline-flex items-center gap-2 rounded-md text-sm font-medium text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
            <ArrowLeft className="size-4" aria-hidden={true} /> Partner login
          </Link>
          <div className="mt-6">
            <p className="text-sm font-medium text-primary">{partnerLabel}</p>
            <h1 className="mt-2 text-3xl font-medium tracking-normal">Partner verification</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">Complete these checks so admins can approve the account before live jobs are enabled.</p>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <StatusPill label={partnerApproval} tone={isApproved ? "success" : partnerApproval === "REJECTED" ? "danger" : "warning"} />
            {isApproved ? <StatusPill label="Dashboard ready" tone="success" /> : null}
          </div>
          <div className="mt-6 grid gap-2">
            {steps.map((step, index) => {
              const Icon = step.icon;

              return (
                <button key={step.title} type="button" onClick={() => setActiveStep(index)} className={cn("flex gap-3 rounded-md border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30", activeStep === index ? "border-primary bg-primary/10" : "border-border bg-surface hover:bg-surface-muted")}>
                  <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-md", activeStep === index ? "bg-primary text-primary-foreground" : "bg-surface-muted text-muted-foreground")}>
                    <Icon className="size-4" aria-hidden={true} />
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-foreground">{index + 1}. {step.title}</span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">{step.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <form className="rounded-lg border border-border bg-surface p-5 shadow-[var(--shadow-shell)] sm:p-6" onSubmit={submit}>
          {activeStep === 0 ? <AccountStep user={user} partnerLabel={partnerLabel} /> : null}
          {activeStep === 1 ? <ProfileStep name={name} avatarUrl={avatarUrl} serviceArea={serviceArea} setName={setName} setAvatarUrl={setAvatarUrl} setServiceArea={setServiceArea} /> : null}
          {activeStep === 2 ? <DocumentsStep requirements={requiredItems} documentRef={documentRef} bankRef={bankRef} setDocumentRef={setDocumentRef} setBankRef={setBankRef} /> : null}
          {activeStep === 3 ? <ReviewStep name={name} serviceArea={serviceArea} documentRef={documentRef} bankRef={bankRef} consent={consent} setConsent={setConsent} partnerApproval={partnerApproval} mutationError={mutation.error instanceof Error ? mutation.error.message : null} /> : null}

          <div className="mt-7 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-between">
            <Button type="button" variant="secondary" disabled={activeStep === 0 || mutation.isPending} onClick={() => setActiveStep((step) => Math.max(step - 1, 0))}>Back</Button>
            <div className="flex flex-col gap-2 sm:flex-row">
              {isApproved ? <Button type="button" variant="secondary" onClick={() => router.push("/partner/dashboard")}>Open dashboard</Button> : null}
              <Button type="submit" disabled={mutation.isPending || (activeStep === steps.length - 1 && !canSubmit)}>
                {activeStep === steps.length - 1 ? isReviewLocked ? "Waiting for review" : mutation.isPending ? "Submitting..." : "Submit for review" : "Continue"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </OnboardingShell>
  );
}

function OnboardingShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </div>
    </main>
  );
}

function AccountStep({ user, partnerLabel }: { user: AuthUser; partnerLabel: string }) {
  return (
    <section>
      <StepHeader eyebrow="Step 1" title="Confirm account" description="The selected partner path is locked to this session before verification continues." />
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <InfoTile label="Partner type" value={partnerLabel} />
        <InfoTile label="Backend role" value={user.role} />
        <InfoTile label="Phone" value={user.phoneE164 ?? "Not added"} />
        <InfoTile label="Approval" value={user.partnerApproval ?? "NONE"} />
      </div>
    </section>
  );
}

function ProfileStep({ name, avatarUrl, serviceArea, setName, setAvatarUrl, setServiceArea }: { name: string; avatarUrl: string; serviceArea: string; setName: (value: string) => void; setAvatarUrl: (value: string) => void; setServiceArea: (value: string) => void }) {
  return (
    <section>
      <StepHeader eyebrow="Step 2" title="Profile details" description="Use a clear name and service area so ops can identify the partner during approval." />
      <div className="mt-6 grid gap-4">
        <Field label="Display name" htmlFor="partner-name"><Input id="partner-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="MoveX partner name" className="min-h-12" /></Field>
        <Field label="Primary service area" htmlFor="service-area"><Input id="service-area" value={serviceArea} onChange={(event) => setServiceArea(event.target.value)} placeholder="Indiranagar, Bengaluru" className="min-h-12" /></Field>
        <Field label="Profile image URL" htmlFor="avatar-url"><Input id="avatar-url" value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} placeholder="https://..." className="min-h-12" /></Field>
      </div>
    </section>
  );
}

function DocumentsStep({ requirements, documentRef, bankRef, setDocumentRef, setBankRef }: { requirements: string[]; documentRef: string; bankRef: string; setDocumentRef: (value: string) => void; setBankRef: (value: string) => void }) {
  return (
    <section>
      <StepHeader eyebrow="Step 3" title="Verification documents" description="Keep the required proof ready before submitting the profile for review." />
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {requirements.map((item) => <RequirementCard key={item} label={item} />)}
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label="Document reference" htmlFor="document-ref"><Input id="document-ref" value={documentRef} onChange={(event) => setDocumentRef(event.target.value)} placeholder="ID, license, or proof reference" className="min-h-12" /></Field>
        <Field label="Bank reference" htmlFor="bank-ref"><Input id="bank-ref" value={bankRef} onChange={(event) => setBankRef(event.target.value)} placeholder="Account holder or last 4 digits" className="min-h-12" /></Field>
      </div>
    </section>
  );
}

function ReviewStep({ name, serviceArea, documentRef, bankRef, consent, setConsent, partnerApproval, mutationError }: { name: string; serviceArea: string; documentRef: string; bankRef: string; consent: boolean; setConsent: (value: boolean) => void; partnerApproval: string; mutationError: string | null }) {
  return (
    <section>
      <StepHeader eyebrow="Step 4" title="Review and submit" description="Submission moves the partner profile into pending admin review." />
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <InfoTile label="Display name" value={name || "Missing"} />
        <InfoTile label="Service area" value={serviceArea || "Missing"} />
        <InfoTile label="Document reference" value={documentRef || "Missing"} />
        <InfoTile label="Bank reference" value={bankRef || "Missing"} />
      </div>
      <label className="mt-5 flex gap-3 rounded-md border border-border bg-surface-muted p-4 text-sm leading-6 text-foreground">
        <input type="checkbox" className="mt-1 size-4 accent-primary" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
        I confirm these details are accurate and ready for admin verification.
      </label>
      {partnerApproval === "PENDING" ? <p className="mt-4 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">Profile submitted. Admin review is pending.</p> : null}
      {mutationError ? <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{mutationError}</p> : null}
    </section>
  );
}

function StepHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div>
      <p className="text-sm font-medium text-primary">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-medium tracking-normal text-foreground sm:text-3xl">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground" htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface-muted p-4">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-2 break-words text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function RequirementCard({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-border bg-surface p-4 shadow-sm">
      <FileText className="size-5 text-primary" aria-hidden={true} />
      <p className="mt-3 text-sm font-medium text-foreground">{label}</p>
    </div>
  );
}

function getRequirements(partnerLabel: string) {
  if (partnerLabel.toLowerCase().includes("store")) {
    return ["Store license", "GST or FSSAI proof", "Bank account"];
  }

  if (partnerLabel.toLowerCase().includes("driver")) {
    return ["Driving license", "Vehicle document", "Bank account"];
  }

  if (["electrician", "plumber", "repair"].some((keyword) => partnerLabel.toLowerCase().includes(keyword))) {
    return ["Identity proof", "Skill certificate", "Bank account"];
  }

  return ["Identity proof", "Work eligibility", "Bank account"];
}
