"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { SelectedLocation } from "@movex/shared";
import {
  ArrowLeft,
  Banknote,
  Building2,
  Camera,
  Car,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  Home,
  IdCard,
  MapPin,
  Save,
  ShieldCheck,
  Store,
  Trash2,
  UploadCloud,
  UserRound,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { MapPicker } from "@/components/location/map-picker";
import { Button, ErrorState, Input, Skeleton, StatusPill } from "@/components/ui";
import {
  partnerLoginConfigs,
  PARTNER_LOGIN_TYPE_SESSION_KEY,
  type PartnerLoginConfig,
} from "@/lib/auth-flow";
import {
  currentUser,
  isPartnerAuthRole,
  routeForAuthenticatedUser,
  submitPartnerVerification,
  type AuthUser,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const DRAFT_KEY = "movex-partner-verification-draft-v2";
const HOME_SERVICE_CATEGORIES = [
  "Plumbing",
  "Electrical",
  "Appliance repair",
  "Cleaning",
  "Painting",
  "Carpentry",
  "AC service",
  "Pest control",
] as const;
const STORE_TYPES = ["Restaurant (Food)", "Grocery", "Pharmacy"] as const;
const VEHICLE_TYPES = ["Bike", "Auto", "Cab"] as const;

const DEFAULT_LOCATION: SelectedLocation = {
  address: "Indiranagar, Bengaluru",
  lat: 12.9719,
  lng: 77.6412,
  source: "map-click",
};

type PartnerKind = "store" | "delivery" | "driver" | "home-services";
type DocumentKey =
  | "profileImage"
  | "storeLicense"
  | "aadhaar"
  | "pan"
  | "drivingLicense"
  | "vehicleRc"
  | "vehicleInsurance"
  | "skillCertificate"
  | "policeVerification"
  | "bankProof";
type FileSnapshot = { name: string; size: number; type: string };
type CapturedPhoto = { dataUrl: string; capturedAt: string };

type VerificationForm = {
  ownerName: string;
  businessName: string;
  description: string;
  storeType: string;
  avgPrepTimeMinutes: string;
  minOrderValue: string;
  deliveryRadiusKm: string;
  openingHours: string;
  vehicleType: string;
  vehicleNumber: string;
  experienceYears: string;
  emergencyContact: string;
  serviceCategories: string[];
  serviceRadiusKm: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  landmark: string;
  location: SelectedLocation | null;
  aadhaarNumber: string;
  panNumber: string;
  licenseNumber: string;
  gstNumber: string;
  fssaiNumber: string;
  documentExpiry: string;
  vehicleRcNumber: string;
  insuranceExpiry: string;
  policeVerificationRef: string;
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  confirmAccountNumber: string;
  ifscCode: string;
  upiId: string;
  accuracyConsent: boolean;
  verificationConsent: boolean;
};

type DraftPayload = {
  form: VerificationForm;
  files: Partial<Record<DocumentKey, FileSnapshot>>;
  liveCapture?: Pick<CapturedPhoto, "capturedAt"> | null;
  savedAt: string;
};

type StepConfig = { title: string; description: string; icon: LucideIcon };
type DocumentRequirement = {
  key: DocumentKey;
  title: string;
  description: string;
  accept?: string;
  optional?: boolean;
};
type PartnerOnboardingPreview = { user: AuthUser; partnerType?: PartnerLoginConfig["slug"] };
type UpdateForm = <K extends keyof VerificationForm>(key: K, value: VerificationForm[K]) => void;
type FileChangeHandler = (key: DocumentKey, event: ChangeEvent<HTMLInputElement>) => void;
type CompletionState = {
  ready: boolean;
  percent: number;
  completedItems: number;
  totalItems: number;
  missingItems: string[];
};

const roleLabels: Record<string, string> = {
  RESTAURANT: "Store partner",
  DELIVERY: "Delivery partner",
  DRIVER: "Driver",
};

const steps: StepConfig[] = [
  {
    title: "Partner info",
    description: "Business, profile, and live identity capture.",
    icon: Store,
  },
  {
    title: "Location",
    description: "Address and service pin for dispatch accuracy.",
    icon: MapPin,
  },
  { title: "Documents", description: "Identity, license, and compliance proof.", icon: IdCard },
  {
    title: "Settlements",
    description: "Bank details, final review, and submission.",
    icon: Banknote,
  },
];

const emptyForm: VerificationForm = {
  ownerName: "",
  businessName: "",
  description: "",
  storeType: STORE_TYPES[0],
  avgPrepTimeMinutes: "30",
  minOrderValue: "150",
  deliveryRadiusKm: "5",
  openingHours: "09:00-22:00",
  vehicleType: VEHICLE_TYPES[0],
  vehicleNumber: "",
  experienceYears: "",
  emergencyContact: "",
  serviceCategories: [],
  serviceRadiusKm: "8",
  addressLine: "",
  city: "Bengaluru",
  state: "Karnataka",
  pincode: "",
  landmark: "",
  location: null,
  aadhaarNumber: "",
  panNumber: "",
  licenseNumber: "",
  gstNumber: "",
  fssaiNumber: "",
  documentExpiry: "",
  vehicleRcNumber: "",
  insuranceExpiry: "",
  policeVerificationRef: "",
  accountHolderName: "",
  bankName: "",
  accountNumber: "",
  confirmAccountNumber: "",
  ifscCode: "",
  upiId: "",
  accuracyConsent: false,
  verificationConsent: false,
};

const inputLikeClass =
  "min-h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground shadow-sm transition placeholder:text-muted-foreground/75 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-60";

export function PartnerOnboardingPage({ preview }: { preview?: PartnerOnboardingPreview } = {}) {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState(0);
  const [selectedPartner, setSelectedPartner] = useState<PartnerLoginConfig | null>(null);
  const [submittedUser, setSubmittedUser] = useState<AuthUser | null>(null);
  const [form, setForm] = useState<VerificationForm>(emptyForm);
  const [files, setFiles] = useState<Partial<Record<DocumentKey, FileSnapshot>>>({});
  const [liveCapture, setLiveCapture] = useState<CapturedPhoto | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);

  const isPreview = Boolean(preview);
  const me = useQuery({
    queryKey: ["auth-me"],
    queryFn: currentUser,
    retry: false,
    enabled: !isPreview,
  });
  const user = submittedUser ?? preview?.user ?? me.data?.user ?? null;
  const partnerApproval = user?.partnerApproval ?? "NONE";
  const isApproved = partnerApproval === "APPROVED";
  const isRejected = partnerApproval === "REJECTED";
  const isReviewLocked = partnerApproval === "PENDING";
  const isPartner = Boolean(user && isPartnerAuthRole(user.role));
  const partnerKind = getPartnerKind(selectedPartner, user);
  const partnerLabel =
    selectedPartner?.label ?? (user ? (roleLabels[user.role] ?? "Partner") : "Partner");
  const documentRequirements = useMemo(() => getDocumentRequirements(partnerKind), [partnerKind]);
  const completion = useMemo(
    () => getCompletion(form, files, liveCapture, documentRequirements, partnerKind),
    [documentRequirements, files, form, liveCapture, partnerKind],
  );
  const canSubmit = completion.ready && !isReviewLocked;

  useEffect(() => {
    const storedType =
      preview?.partnerType ?? window.sessionStorage.getItem(PARTNER_LOGIN_TYPE_SESSION_KEY);
    const config = partnerLoginConfigs.find((partner) => partner.slug === storedType);

    if (config) {
      setSelectedPartner(config);
    }
  }, [preview?.partnerType]);

  useEffect(() => {
    if (!user?.name) {
      return;
    }

    setForm((current) =>
      current.ownerName ? current : { ...current, ownerName: user.name ?? "" },
    );
  }, [user?.name]);

  useEffect(() => {
    const stored = window.localStorage.getItem(DRAFT_KEY);

    if (!stored) {
      return;
    }

    try {
      const draft = JSON.parse(stored) as DraftPayload;
      setForm({ ...emptyForm, ...draft.form, location: draft.form.location ?? null });
      setFiles(draft.files ?? {});
      setDraftSavedAt(draft.savedAt);
    } catch {
      window.localStorage.removeItem(DRAFT_KEY);
    }
  }, []);

  useEffect(() => {
    if (
      partnerApproval === "PENDING" ||
      partnerApproval === "APPROVED" ||
      partnerApproval === "REJECTED"
    ) {
      setActiveStep(3);
    }
  }, [partnerApproval]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (isPreview) {
        if (!user) {
          throw new Error("Preview user is missing.");
        }

        return {
          user: {
            ...user,
            name: form.ownerName.trim(),
            avatarUrl: user.avatarUrl ?? null,
            partnerApproval: "PENDING",
          },
          verification: null,
        };
      }

      return submitPartnerVerification(
        buildVerificationPayload(form, files, liveCapture, partnerKind),
      );
    },
    onSuccess: (result) => {
      setSubmittedUser(result.user);
      setActiveStep(3);
      setDraftSavedAt(null);
      window.localStorage.removeItem(DRAFT_KEY);
    },
  });

  function updateForm<K extends keyof VerificationForm>(key: K, value: VerificationForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleFileChange(key: DocumentKey, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setFiles((current) => ({
      ...current,
      [key]: { name: file.name, size: file.size, type: file.type || "Uploaded file" },
    }));
  }

  function removeFile(key: DocumentKey) {
    setFiles((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function saveDraft() {
    const savedAt = new Date().toISOString();
    const payload: DraftPayload = {
      form,
      files,
      liveCapture: liveCapture ? { capturedAt: liveCapture.capturedAt } : null,
      savedAt,
    };

    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    setDraftSavedAt(savedAt);
  }

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

  if (!isPreview && me.isLoading) {
    return (
      <OnboardingShell>
        <Skeleton className="min-h-[34rem]" />
      </OnboardingShell>
    );
  }

  if ((!isPreview && me.isError) || !user) {
    return (
      <OnboardingShell>
        <ErrorState
          title="Sign in required"
          description="Log in as a partner to continue verification."
          action={
            <Button asChild>
              <Link href="/login/partner">Partner login</Link>
            </Button>
          }
        />
      </OnboardingShell>
    );
  }

  if (!isPartner) {
    return (
      <OnboardingShell>
        <ErrorState
          title="Partner account required"
          description="This verification flow is only available for partner roles."
          action={
            <Button asChild>
              <Link href={routeForAuthenticatedUser(user)}>Go to your dashboard</Link>
            </Button>
          }
        />
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell>
      <div className="grid gap-6 lg:grid-cols-[19rem_1fr]">
        <VerificationSidebar
          activeStep={activeStep}
          partnerApproval={partnerApproval}
          partnerLabel={partnerLabel}
          completion={completion}
          setActiveStep={setActiveStep}
        />
        <form
          className="rounded-lg border border-border bg-surface p-5 shadow-[var(--shadow-shell)] sm:p-6"
          onSubmit={submit}
        >
          <div className="mb-5 flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-primary">{partnerLabel}</p>
              <h1 className="mt-1 text-2xl font-medium tracking-normal text-foreground sm:text-3xl">
                Partner verification
              </h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={saveDraft}>
                <Save className="size-4" aria-hidden={true} /> Save draft
              </Button>
              {draftSavedAt ? (
                <StatusPill label={`Draft ${formatTime(draftSavedAt)}`} tone="success" />
              ) : null}
            </div>
          </div>
          {activeStep === 0 ? (
            <PartnerInfoStep
              form={form}
              files={files}
              liveCapture={liveCapture}
              partnerKind={partnerKind}
              setLiveCapture={setLiveCapture}
              updateForm={updateForm}
              handleFileChange={handleFileChange}
              removeFile={removeFile}
            />
          ) : null}
          {activeStep === 1 ? <LocationStep form={form} updateForm={updateForm} /> : null}
          {activeStep === 2 ? (
            <DocumentsStep
              form={form}
              files={files}
              partnerKind={partnerKind}
              requirements={documentRequirements}
              updateForm={updateForm}
              handleFileChange={handleFileChange}
              removeFile={removeFile}
            />
          ) : null}
          {activeStep === 3 ? (
            <SettlementReviewStep
              user={user}
              form={form}
              files={files}
              liveCapture={liveCapture}
              partnerApproval={partnerApproval}
              partnerKind={partnerKind}
              partnerLabel={partnerLabel}
              completion={completion}
              mutationError={mutation.error instanceof Error ? mutation.error.message : null}
              updateForm={updateForm}
              handleFileChange={handleFileChange}
              removeFile={removeFile}
            />
          ) : null}
          <div className="mt-7 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="secondary"
              disabled={activeStep === 0 || mutation.isPending}
              onClick={() => setActiveStep((step) => Math.max(step - 1, 0))}
            >
              Back
            </Button>
            <div className="flex flex-col gap-2 sm:flex-row">
              {isApproved ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => router.push("/partner/dashboard")}
                >
                  Open dashboard
                </Button>
              ) : null}
              {isRejected ? (
                <Button type="button" variant="secondary" onClick={() => setActiveStep(0)}>
                  Update application
                </Button>
              ) : null}
              <Button
                type="submit"
                disabled={mutation.isPending || (activeStep === steps.length - 1 && !canSubmit)}
              >
                {activeStep === steps.length - 1
                  ? getSubmitLabel(isReviewLocked, mutation.isPending)
                  : "Continue"}
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
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
    </main>
  );
}

function VerificationSidebar({
  activeStep,
  partnerApproval,
  partnerLabel,
  completion,
  setActiveStep,
}: {
  activeStep: number;
  partnerApproval: string;
  partnerLabel: string;
  completion: CompletionState;
  setActiveStep: (step: number) => void;
}) {
  const statusTone =
    partnerApproval === "APPROVED"
      ? "success"
      : partnerApproval === "REJECTED"
        ? "danger"
        : partnerApproval === "PENDING"
          ? "warning"
          : "info";

  return (
    <aside className="rounded-lg border border-border bg-surface p-4 shadow-sm lg:sticky lg:top-6 lg:self-start">
      <Link
        href="/login/partner"
        className="inline-flex items-center gap-2 rounded-md text-sm font-medium text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
      >
        <ArrowLeft className="size-4" aria-hidden={true} /> Partner login
      </Link>
      <div className="mt-6">
        <p className="text-sm font-medium text-primary">{partnerLabel}</p>
        <h2 className="mt-2 text-3xl font-medium tracking-normal">Verification desk</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          A complete review pack for identity, compliance, location accuracy, and settlement
          readiness.
        </p>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <StatusPill label={partnerApproval} tone={statusTone} />
        <StatusPill
          label={`${completion.percent}% complete`}
          tone={completion.ready ? "success" : "info"}
        />
      </div>
      <div className="mt-6 grid gap-2">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const done = index < activeStep;

          return (
            <button
              key={step.title}
              type="button"
              onClick={() => setActiveStep(index)}
              className={cn(
                "flex gap-3 rounded-md border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                activeStep === index
                  ? "border-primary bg-primary/10"
                  : "border-border bg-surface hover:bg-surface-muted",
              )}
            >
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-md",
                  activeStep === index
                    ? "bg-primary text-primary-foreground"
                    : done
                      ? "bg-success/10 text-success"
                      : "bg-surface-muted text-muted-foreground",
                )}
              >
                {done ? (
                  <CheckCircle2 className="size-4" aria-hidden={true} />
                ) : (
                  <Icon className="size-4" aria-hidden={true} />
                )}
              </span>
              <span>
                <span className="block text-sm font-medium text-foreground">
                  {index + 1}. {step.title}
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {step.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function PartnerInfoStep({
  form,
  files,
  liveCapture,
  partnerKind,
  setLiveCapture,
  updateForm,
  handleFileChange,
  removeFile,
}: {
  form: VerificationForm;
  files: Partial<Record<DocumentKey, FileSnapshot>>;
  liveCapture: CapturedPhoto | null;
  partnerKind: PartnerKind;
  setLiveCapture: (capture: CapturedPhoto | null) => void;
  updateForm: UpdateForm;
  handleFileChange: FileChangeHandler;
  removeFile: (key: DocumentKey) => void;
}) {
  const copy = getPartnerInfoCopy(partnerKind);

  return (
    <section>
      <StepHeader eyebrow="Step 1" title={copy.title} description={copy.description} />
      <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_19rem]">
        <div className="grid gap-4">
          <Field label="Owner / partner full name" htmlFor="owner-name">
            <Input
              id="owner-name"
              value={form.ownerName}
              onChange={(event) => updateForm("ownerName", event.target.value)}
              placeholder="Full legal name"
              className="min-h-12"
            />
          </Field>
          <Field label={copy.businessLabel} htmlFor="business-name">
            <Input
              id="business-name"
              value={form.businessName}
              onChange={(event) => updateForm("businessName", event.target.value)}
              placeholder={copy.businessPlaceholder}
              className="min-h-12"
            />
          </Field>
          <Field label="Description" htmlFor="partner-description">
            <textarea
              id="partner-description"
              value={form.description}
              onChange={(event) => updateForm("description", event.target.value)}
              placeholder={copy.descriptionPlaceholder}
              className={cn(inputLikeClass, "min-h-28 resize-y py-3 leading-6")}
            />
          </Field>
          {partnerKind === "store" ? <StoreFields form={form} updateForm={updateForm} /> : null}
          {partnerKind === "delivery" || partnerKind === "driver" ? (
            <VehicleFields
              form={form}
              updateForm={updateForm}
              includeExperience={partnerKind === "driver"}
            />
          ) : null}
          {partnerKind === "home-services" ? (
            <HomeServiceFields form={form} updateForm={updateForm} />
          ) : null}
        </div>
        <div className="grid gap-4">
          <UploadBox
            id="profile-image"
            title={copy.imageTitle}
            description="Upload a clear public profile or storefront image."
            file={files.profileImage}
            accept="image/*"
            onChange={(event) => handleFileChange("profileImage", event)}
            onRemove={() => removeFile("profileImage")}
          />
          <LiveCapturePanel capture={liveCapture} setCapture={setLiveCapture} />
        </div>
      </div>
    </section>
  );
}

function StoreFields({ form, updateForm }: { form: VerificationForm; updateForm: UpdateForm }) {
  return (
    <div className="grid gap-4 rounded-md border border-border bg-surface-muted p-4 sm:grid-cols-2">
      <Field label="Store type" htmlFor="store-type">
        <select
          id="store-type"
          value={form.storeType}
          onChange={(event) => updateForm("storeType", event.target.value)}
          className={inputLikeClass}
        >
          {STORE_TYPES.map((type) => (
            <option key={type}>{type}</option>
          ))}
        </select>
      </Field>
      <Field label="Average prep time (minutes)" htmlFor="prep-time">
        <Input
          id="prep-time"
          value={form.avgPrepTimeMinutes}
          onChange={(event) => updateForm("avgPrepTimeMinutes", event.target.value)}
          inputMode="numeric"
        />
      </Field>
      <Field label="Minimum order value" htmlFor="min-order">
        <Input
          id="min-order"
          value={form.minOrderValue}
          onChange={(event) => updateForm("minOrderValue", event.target.value)}
          inputMode="numeric"
        />
      </Field>
      <Field label="Delivery radius (km)" htmlFor="delivery-radius">
        <Input
          id="delivery-radius"
          value={form.deliveryRadiusKm}
          onChange={(event) => updateForm("deliveryRadiusKm", event.target.value)}
          inputMode="decimal"
        />
      </Field>
      <Field label="Opening hours" htmlFor="opening-hours">
        <Input
          id="opening-hours"
          value={form.openingHours}
          onChange={(event) => updateForm("openingHours", event.target.value)}
          placeholder="09:00-22:00"
        />
      </Field>
    </div>
  );
}

function VehicleFields({
  form,
  updateForm,
  includeExperience,
}: {
  form: VerificationForm;
  updateForm: UpdateForm;
  includeExperience: boolean;
}) {
  return (
    <div className="grid gap-4 rounded-md border border-border bg-surface-muted p-4 sm:grid-cols-2">
      <Field label="Vehicle type" htmlFor="vehicle-type">
        <select
          id="vehicle-type"
          value={form.vehicleType}
          onChange={(event) => updateForm("vehicleType", event.target.value)}
          className={inputLikeClass}
        >
          {VEHICLE_TYPES.map((type) => (
            <option key={type}>{type}</option>
          ))}
        </select>
      </Field>
      <Field label="Vehicle number" htmlFor="vehicle-number">
        <Input
          id="vehicle-number"
          value={form.vehicleNumber}
          onChange={(event) => updateForm("vehicleNumber", event.target.value.toUpperCase())}
          placeholder="KA01AB1234"
        />
      </Field>
      {includeExperience ? (
        <Field label="Driving experience" htmlFor="experience">
          <Input
            id="experience"
            value={form.experienceYears}
            onChange={(event) => updateForm("experienceYears", event.target.value)}
            placeholder="5 years"
          />
        </Field>
      ) : null}
      <Field label="Emergency contact" htmlFor="emergency-contact">
        <Input
          id="emergency-contact"
          value={form.emergencyContact}
          onChange={(event) => updateForm("emergencyContact", event.target.value)}
          placeholder="Family contact number"
        />
      </Field>
    </div>
  );
}

function HomeServiceFields({
  form,
  updateForm,
}: {
  form: VerificationForm;
  updateForm: UpdateForm;
}) {
  function toggleService(category: string) {
    updateForm(
      "serviceCategories",
      form.serviceCategories.includes(category)
        ? form.serviceCategories.filter((item) => item !== category)
        : [...form.serviceCategories, category],
    );
  }

  return (
    <div className="rounded-md border border-border bg-surface-muted p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Experience" htmlFor="home-experience">
          <Input
            id="home-experience"
            value={form.experienceYears}
            onChange={(event) => updateForm("experienceYears", event.target.value)}
            placeholder="4 years electrical repair"
          />
        </Field>
        <Field label="Service radius (km)" htmlFor="service-radius">
          <Input
            id="service-radius"
            value={form.serviceRadiusKm}
            onChange={(event) => updateForm("serviceRadiusKm", event.target.value)}
            inputMode="decimal"
          />
        </Field>
      </div>
      <fieldset className="mt-4">
        <legend className="text-sm font-medium text-foreground">Service categories</legend>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Pick every service this professional can accept after approval.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {HOME_SERVICE_CATEGORIES.map((category) => {
            const active = form.serviceCategories.includes(category);
            return (
              <button
                key={category}
                type="button"
                aria-pressed={active}
                className={cn(
                  "rounded-md border p-3 text-left text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-surface text-foreground hover:border-primary/40",
                )}
                onClick={() => toggleService(category)}
              >
                {category}
              </button>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}

function LocationStep({ form, updateForm }: { form: VerificationForm; updateForm: UpdateForm }) {
  const selectedLocation = form.location ?? DEFAULT_LOCATION;

  return (
    <section>
      <StepHeader
        eyebrow="Step 2"
        title="Address and live location"
        description="Collect the partner address and pin the exact dispatch point without exposing raw coordinates in the normal flow."
      />
      <div className="mt-6 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="grid gap-4 rounded-md border border-border bg-surface-muted p-4">
          <Field label="Address line" htmlFor="address-line">
            <Input
              id="address-line"
              value={form.addressLine}
              onChange={(event) => updateForm("addressLine", event.target.value)}
              placeholder="Building, street, area"
              className="min-h-12"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="City" htmlFor="city">
              <Input
                id="city"
                value={form.city}
                onChange={(event) => updateForm("city", event.target.value)}
              />
            </Field>
            <Field label="State" htmlFor="state">
              <Input
                id="state"
                value={form.state}
                onChange={(event) => updateForm("state", event.target.value)}
              />
            </Field>
            <Field label="Pincode" htmlFor="pincode">
              <Input
                id="pincode"
                value={form.pincode}
                onChange={(event) => updateForm("pincode", event.target.value)}
                inputMode="numeric"
              />
            </Field>
            <Field label="Landmark" htmlFor="landmark">
              <Input
                id="landmark"
                value={form.landmark}
                onChange={(event) => updateForm("landmark", event.target.value)}
                placeholder="Near metro, mall, etc."
              />
            </Field>
          </div>
          <div className="rounded-md border border-border bg-surface p-4">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive">
                <MapPin className="size-5" aria-hidden={true} />
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {form.location ? "Location pin selected" : "Location pin preview"}
                </p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {selectedLocation.address}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
          <MapPicker
            value={selectedLocation}
            onChange={(location) => updateForm("location", location)}
          />
        </div>
      </div>
    </section>
  );
}

function DocumentsStep({
  form,
  files,
  partnerKind,
  requirements,
  updateForm,
  handleFileChange,
  removeFile,
}: {
  form: VerificationForm;
  files: Partial<Record<DocumentKey, FileSnapshot>>;
  partnerKind: PartnerKind;
  requirements: DocumentRequirement[];
  updateForm: UpdateForm;
  handleFileChange: FileChangeHandler;
  removeFile: (key: DocumentKey) => void;
}) {
  return (
    <section>
      <StepHeader
        eyebrow="Step 3"
        title="Documents and identity checks"
        description="Upload document proof and enter the reference numbers admins need for approval, rejection, or resubmission."
      />
      <div className="mt-6 grid gap-4">
        {requirements.map((requirement) => (
          <DocumentRequirementRow
            key={requirement.key}
            requirement={requirement}
            file={files[requirement.key]}
            form={form}
            partnerKind={partnerKind}
            updateForm={updateForm}
            handleFileChange={handleFileChange}
            removeFile={removeFile}
          />
        ))}
      </div>
    </section>
  );
}

function DocumentRequirementRow({
  requirement,
  file,
  form,
  partnerKind,
  updateForm,
  handleFileChange,
  removeFile,
}: {
  requirement: DocumentRequirement;
  file?: FileSnapshot;
  form: VerificationForm;
  partnerKind: PartnerKind;
  updateForm: UpdateForm;
  handleFileChange: FileChangeHandler;
  removeFile: (key: DocumentKey) => void;
}) {
  return (
    <div className="grid gap-4 rounded-lg border border-border bg-surface p-3 shadow-sm lg:grid-cols-[minmax(0,1fr)_minmax(17rem,0.9fr)] lg:p-4">
      <UploadBox
        id={`document-${requirement.key}`}
        title={requirement.title}
        description={requirement.description}
        file={file}
        accept={requirement.accept ?? "image/*,.pdf"}
        optional={requirement.optional}
        onChange={(event) => handleFileChange(requirement.key, event)}
        onRemove={() => removeFile(requirement.key)}
      />
      <div className="grid content-start gap-3 rounded-md border border-border bg-surface-muted p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Reference details
        </p>
        <DocumentReferenceFields
          requirementKey={requirement.key}
          form={form}
          partnerKind={partnerKind}
          updateForm={updateForm}
        />
      </div>
    </div>
  );
}

function DocumentReferenceFields({
  requirementKey,
  form,
  partnerKind,
  updateForm,
}: {
  requirementKey: DocumentKey;
  form: VerificationForm;
  partnerKind: PartnerKind;
  updateForm: UpdateForm;
}) {
  if (requirementKey === "aadhaar") {
    return (
      <Field label="Aadhaar number" htmlFor="aadhaar-number">
        <Input
          id="aadhaar-number"
          value={form.aadhaarNumber}
          onChange={(event) => updateForm("aadhaarNumber", event.target.value)}
          inputMode="numeric"
          placeholder="Last-mile identity verification"
        />
      </Field>
    );
  }

  if (requirementKey === "pan") {
    return (
      <Field label="PAN number" htmlFor="pan-number">
        <Input
          id="pan-number"
          value={form.panNumber}
          onChange={(event) => updateForm("panNumber", event.target.value.toUpperCase())}
          placeholder="ABCDE1234F"
        />
      </Field>
    );
  }

  if (requirementKey === "storeLicense") {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
        <Field label="FSSAI / license number" htmlFor="fssai-number">
          <Input
            id="fssai-number"
            value={form.fssaiNumber}
            onChange={(event) => updateForm("fssaiNumber", event.target.value)}
          />
        </Field>
        <Field label="GST number" htmlFor="gst-number">
          <Input
            id="gst-number"
            value={form.gstNumber}
            onChange={(event) => updateForm("gstNumber", event.target.value.toUpperCase())}
          />
        </Field>
      </div>
    );
  }

  if (requirementKey === "drivingLicense") {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
        <Field label="Driving license number" htmlFor="license-number">
          <Input
            id="license-number"
            value={form.licenseNumber}
            onChange={(event) => updateForm("licenseNumber", event.target.value.toUpperCase())}
          />
        </Field>
        <Field label="License expiry" htmlFor="document-expiry">
          <Input
            id="document-expiry"
            type="date"
            value={form.documentExpiry}
            onChange={(event) => updateForm("documentExpiry", event.target.value)}
          />
        </Field>
      </div>
    );
  }

  if (requirementKey === "vehicleRc") {
    return (
      <Field label="Vehicle RC number" htmlFor="rc-number">
        <Input
          id="rc-number"
          value={form.vehicleRcNumber}
          onChange={(event) => updateForm("vehicleRcNumber", event.target.value.toUpperCase())}
        />
      </Field>
    );
  }

  if (requirementKey === "vehicleInsurance") {
    return (
      <Field label="Insurance expiry" htmlFor="insurance-expiry">
        <Input
          id="insurance-expiry"
          type="date"
          value={form.insuranceExpiry}
          onChange={(event) => updateForm("insuranceExpiry", event.target.value)}
        />
      </Field>
    );
  }

  if (requirementKey === "policeVerification" || requirementKey === "skillCertificate") {
    return (
      <Field
        label={partnerKind === "home-services" ? "Verification / skill reference" : "Reference number"}
        htmlFor={`reference-${requirementKey}`}
      >
        <Input
          id={`reference-${requirementKey}`}
          value={form.policeVerificationRef}
          onChange={(event) => updateForm("policeVerificationRef", event.target.value)}
          placeholder="Reference number or certificate id"
        />
      </Field>
    );
  }

  return <p className="text-sm leading-6 text-muted-foreground">Upload this document so admins can review it with the rest of the profile.</p>;
}

function SettlementReviewStep({
  user,
  form,
  files,
  liveCapture,
  partnerApproval,
  partnerKind,
  partnerLabel,
  completion,
  mutationError,
  updateForm,
  handleFileChange,
  removeFile,
}: {
  user: AuthUser;
  form: VerificationForm;
  files: Partial<Record<DocumentKey, FileSnapshot>>;
  liveCapture: CapturedPhoto | null;
  partnerApproval: string;
  partnerKind: PartnerKind;
  partnerLabel: string;
  completion: CompletionState;
  mutationError: string | null;
  updateForm: UpdateForm;
  handleFileChange: FileChangeHandler;
  removeFile: (key: DocumentKey) => void;
}) {
  return (
    <section>
      <StepHeader
        eyebrow="Step 4"
        title="Settlements and final review"
        description="Add payout details, review the application, and submit it for admin verification."
      />
      <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <div className="grid gap-4 rounded-md border border-border bg-surface-muted p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Account holder name" htmlFor="account-holder">
              <Input
                id="account-holder"
                value={form.accountHolderName}
                onChange={(event) => updateForm("accountHolderName", event.target.value)}
              />
            </Field>
            <Field label="Bank / account name" htmlFor="bank-name">
              <Input
                id="bank-name"
                value={form.bankName}
                onChange={(event) => updateForm("bankName", event.target.value)}
              />
            </Field>
            <Field label="Account number" htmlFor="account-number">
              <Input
                id="account-number"
                value={form.accountNumber}
                onChange={(event) => updateForm("accountNumber", event.target.value)}
                inputMode="numeric"
              />
            </Field>
            <Field label="Confirm account number" htmlFor="confirm-account">
              <Input
                id="confirm-account"
                value={form.confirmAccountNumber}
                onChange={(event) => updateForm("confirmAccountNumber", event.target.value)}
                inputMode="numeric"
              />
            </Field>
            <Field label="IFSC code" htmlFor="ifsc">
              <Input
                id="ifsc"
                value={form.ifscCode}
                onChange={(event) => updateForm("ifscCode", event.target.value.toUpperCase())}
                placeholder="HDFC0000001"
              />
            </Field>
            <Field label="UPI ID (optional)" htmlFor="upi">
              <Input
                id="upi"
                value={form.upiId}
                onChange={(event) => updateForm("upiId", event.target.value)}
                placeholder="name@bank"
              />
            </Field>
          </div>
          <UploadBox
            id="bank-proof"
            title="Cancelled cheque / passbook proof"
            description="Used by finance before payout activation."
            file={files.bankProof}
            accept="image/*,.pdf"
            onChange={(event) => handleFileChange("bankProof", event)}
            onRemove={() => removeFile("bankProof")}
          />
          {form.accountNumber &&
          form.confirmAccountNumber &&
          form.accountNumber !== form.confirmAccountNumber ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Account numbers do not match.
            </p>
          ) : null}
        </div>
        <div className="grid gap-4">
          <VerificationStatusCard
            partnerApproval={partnerApproval}
            rejectionReason={user.rejectionReason ?? null}
          />
          <ReviewCard
            form={form}
            files={files}
            liveCapture={liveCapture}
            partnerKind={partnerKind}
            partnerLabel={partnerLabel}
            completion={completion}
          />
          <label className="flex gap-3 rounded-md border border-border bg-surface-muted p-4 text-sm leading-6 text-foreground">
            <input
              type="checkbox"
              className="mt-1 size-4 accent-primary"
              checked={form.accuracyConsent}
              onChange={(event) => updateForm("accuracyConsent", event.target.checked)}
            />
            I confirm the uploaded documents and partner details are accurate, current, and belong
            to this applicant.
          </label>
          <label className="flex gap-3 rounded-md border border-border bg-surface-muted p-4 text-sm leading-6 text-foreground">
            <input
              type="checkbox"
              className="mt-1 size-4 accent-primary"
              checked={form.verificationConsent}
              onChange={(event) => updateForm("verificationConsent", event.target.checked)}
            />
            I authorize MoveX to verify identity, bank, location, and compliance details before
            enabling jobs or payouts.
          </label>
          {!completion.ready ? <MissingItemsPanel items={completion.missingItems} /> : null}
          {partnerApproval === "PENDING" ? (
            <p className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
              Profile submitted. Admin review is pending.
            </p>
          ) : null}
          {mutationError ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {mutationError}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function LiveCapturePanel({
  capture,
  setCapture,
}: {
  capture: CapturedPhoto | null;
  setCapture: (capture: CapturedPhoto | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera capture is not available in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      setCameraError(null);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setCameraError(
        "Camera permission was blocked. Upload a profile image and try again from a secure browser context.",
      );
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraActive(false);
  }

  function captureFrame() {
    const video = videoRef.current;

    if (!video || video.readyState < 2) {
      setCameraError("Camera is still starting. Try again in a moment.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 720;
    const context = canvas.getContext("2d");

    if (!context) {
      setCameraError("Could not capture from camera.");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    setCapture({
      dataUrl: canvas.toDataURL("image/jpeg", 0.85),
      capturedAt: new Date().toISOString(),
    });
    stopCamera();
  }

  return (
    <div className="rounded-md border border-border bg-surface-muted p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Camera className="size-5" aria-hidden={true} />
        </span>
        <div>
          <p className="text-sm font-medium text-foreground">Live partner photo</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Capture a live selfie for liveness review. It stays local until the verification API is
            connected.
          </p>
        </div>
      </div>
      {capture ? (
        <div className="mt-4 overflow-hidden rounded-md border border-border bg-surface">
          <div
            className="h-40 bg-cover bg-center"
            style={{ backgroundImage: `url(${capture.dataUrl})` }}
            aria-label="Captured partner photo preview"
          />
          <div className="flex items-center justify-between gap-3 p-3 text-xs text-muted-foreground">
            <span>Captured {formatTime(capture.capturedAt)}</span>
            <button
              type="button"
              className="font-medium text-destructive"
              onClick={() => setCapture(null)}
            >
              Remove
            </button>
          </div>
        </div>
      ) : null}
      {cameraActive ? (
        <video
          ref={videoRef}
          className="mt-4 aspect-video w-full rounded-md border border-border bg-black object-cover"
          autoPlay
          playsInline
          muted
        />
      ) : null}
      {cameraError ? (
        <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {cameraError}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {!cameraActive ? (
          <Button type="button" variant="secondary" size="sm" onClick={startCamera}>
            Open camera
          </Button>
        ) : null}
        {cameraActive ? (
          <Button type="button" size="sm" onClick={captureFrame}>
            Capture photo
          </Button>
        ) : null}
        {cameraActive ? (
          <Button type="button" variant="ghost" size="sm" onClick={stopCamera}>
            Cancel
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function UploadBox({
  id,
  title,
  description,
  file,
  accept,
  optional,
  onChange,
  onRemove,
}: {
  id: string;
  title: string;
  description: string;
  file?: FileSnapshot | null;
  accept?: string;
  optional?: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-md border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <UploadCloud className="size-5" aria-hidden={true} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-foreground">{title}</p>
            {optional ? <StatusPill label="Optional" tone="info" /> : null}
          </div>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>
      {file ? (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm">
          <span className="min-w-0 truncate text-success">
            {file.name} ({formatBytes(file.size)})
          </span>
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1 text-destructive"
          >
            <Trash2 className="size-4" aria-hidden={true} /> Remove
          </button>
        </div>
      ) : null}
      <label
        htmlFor={id}
        className="mt-4 inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition hover:bg-surface-muted focus-within:ring-2 focus-within:ring-ring/25"
      >
        <UploadCloud className="size-4" aria-hidden={true} />{" "}
        {file ? "Replace file" : "Upload file"}
      </label>
      <input id={id} type="file" accept={accept} className="sr-only" onChange={onChange} />
    </div>
  );
}

function VerificationStatusCard({
  partnerApproval,
  rejectionReason,
}: {
  partnerApproval: string;
  rejectionReason: string | null;
}) {
  const content = getStatusContent(partnerApproval, rejectionReason);
  const Icon = content.icon;

  return (
    <div className={cn("rounded-md border p-4", content.className)}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 size-5 shrink-0" aria-hidden={true} />
        <div>
          <p className="text-sm font-medium">{content.title}</p>
          <p className="mt-1 text-sm leading-6">{content.description}</p>
        </div>
      </div>
    </div>
  );
}

function ReviewCard({
  form,
  files,
  liveCapture,
  partnerKind,
  partnerLabel,
  completion,
}: {
  form: VerificationForm;
  files: Partial<Record<DocumentKey, FileSnapshot>>;
  liveCapture: CapturedPhoto | null;
  partnerKind: PartnerKind;
  partnerLabel: string;
  completion: CompletionState;
}) {
  const roleSummary = getRoleSummary(form, partnerKind);

  return (
    <div className="rounded-md border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">Final review</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {completion.completedItems} of {completion.totalItems} checks ready.
          </p>
        </div>
        <StatusPill
          label={completion.ready ? "Ready" : "Incomplete"}
          tone={completion.ready ? "success" : "warning"}
        />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <InfoTile
          label="Partner type"
          value={partnerLabel}
          icon={
            partnerKind === "store"
              ? Building2
              : partnerKind === "driver"
                ? Car
                : partnerKind === "home-services"
                  ? Wrench
                  : UserRound
          }
        />
        <InfoTile label="Applicant" value={form.ownerName || "Missing"} icon={UserRound} />
        <InfoTile label="Business / service" value={form.businessName || roleSummary} icon={Home} />
        <InfoTile label="Address" value={formatAddress(form)} icon={MapPin} />
        <InfoTile
          label="Uploaded files"
          value={`${Object.keys(files).length} files selected`}
          icon={FileCheck2}
        />
        <InfoTile
          label="Live capture"
          value={liveCapture ? `Captured ${formatTime(liveCapture.capturedAt)}` : "Missing"}
          icon={Camera}
        />
      </div>
    </div>
  );
}

function MissingItemsPanel({ items }: { items: string[] }) {
  return (
    <div className="rounded-md border border-warning/30 bg-warning/10 p-4 text-warning">
      <p className="text-sm font-medium">Before submitting</p>
      <ul className="mt-2 space-y-1 text-sm leading-6">
        {items.slice(0, 6).map((item) => (
          <li key={item}>- {item}</li>
        ))}
      </ul>
    </div>
  );
}

function StepHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-primary">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-medium tracking-normal text-foreground sm:text-3xl">
        {title}
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}

function InfoTile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-md border border-border bg-surface-muted p-3">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
        <Icon className="size-3.5" aria-hidden={true} /> {label}
      </div>
      <p className="mt-2 break-words text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function getPartnerKind(
  selectedPartner: PartnerLoginConfig | null,
  user: AuthUser | null,
): PartnerKind {
  if (selectedPartner?.slug === "home-services-partner") {
    return "home-services";
  }

  if (selectedPartner?.slug === "store-partner" || user?.role === "RESTAURANT") {
    return "store";
  }

  if (selectedPartner?.slug === "driver" || user?.role === "DRIVER") {
    return "driver";
  }

  return "delivery";
}

function getPartnerInfoCopy(partnerKind: PartnerKind) {
  if (partnerKind === "store") {
    return {
      title: "Store info",
      description:
        "Capture store ownership, operating details, storefront image, and live owner identity before review.",
      businessLabel: "Store name",
      businessPlaceholder: "Cafe, pharmacy, grocery store",
      descriptionPlaceholder: "Describe the store, catalog, cuisine, or pharmacy service coverage.",
      imageTitle: "Store profile image",
    };
  }

  if (partnerKind === "driver") {
    return {
      title: "Driver info",
      description:
        "Capture driver identity, vehicle readiness, profile image, and live photo before ride access is enabled.",
      businessLabel: "Display / fleet name",
      businessPlaceholder: "Driver name or fleet display name",
      descriptionPlaceholder:
        "Describe preferred city zones, vehicle condition, and ride availability.",
      imageTitle: "Driver profile image",
    };
  }

  if (partnerKind === "home-services") {
    return {
      title: "Home services info",
      description:
        "Capture professional identity, service categories, work radius, image, and live photo before job access is enabled.",
      businessLabel: "Service / business name",
      businessPlaceholder: "Electrical repair, plumbing, appliance care",
      descriptionPlaceholder:
        "Describe skills, certifications, tools, work hours, and service style.",
      imageTitle: "Professional profile image",
    };
  }

  return {
    title: "Delivery partner info",
    description:
      "Capture delivery identity, vehicle readiness, profile image, and live photo before queue access is enabled.",
    businessLabel: "Display name",
    businessPlaceholder: "Delivery partner display name",
    descriptionPlaceholder:
      "Describe preferred zones, delivery bag readiness, shifts, and availability.",
    imageTitle: "Delivery profile image",
  };
}

function getDocumentRequirements(partnerKind: PartnerKind): DocumentRequirement[] {
  const base: DocumentRequirement[] = [
    {
      key: "aadhaar",
      title: "Aadhaar proof",
      description: "Front/back Aadhaar image or PDF for identity verification.",
    },
    {
      key: "pan",
      title: "PAN proof",
      description: "PAN card image or PDF for tax and payout verification.",
    },
  ];

  if (partnerKind === "store") {
    return [
      {
        key: "storeLicense",
        title: "Store license / FSSAI / GST",
        description:
          "Upload the operating license required for restaurant, grocery, or pharmacy approval.",
      },
      ...base,
    ];
  }

  if (partnerKind === "driver") {
    return [
      {
        key: "drivingLicense",
        title: "Driving license",
        description: "Upload a clear driving license with visible expiry.",
      },
      {
        key: "vehicleRc",
        title: "Vehicle RC",
        description: "Registration certificate for the ride vehicle.",
      },
      {
        key: "vehicleInsurance",
        title: "Vehicle insurance",
        description: "Active insurance proof for cab, auto, or bike.",
      },
      ...base,
    ];
  }

  if (partnerKind === "home-services") {
    return [
      {
        key: "skillCertificate",
        title: "Skill / experience proof",
        description: "Certificate, employer letter, or portfolio proof for selected home services.",
      },
      {
        key: "policeVerification",
        title: "Police verification",
        description: "Background verification reference or document.",
        optional: true,
      },
      ...base,
    ];
  }

  return [
    {
      key: "vehicleRc",
      title: "Vehicle RC",
      description: "Registration certificate for the delivery vehicle.",
    },
    {
      key: "vehicleInsurance",
      title: "Vehicle insurance",
      description: "Active insurance proof for the delivery vehicle.",
    },
    ...base,
  ];
}

function getCompletion(
  form: VerificationForm,
  files: Partial<Record<DocumentKey, FileSnapshot>>,
  liveCapture: CapturedPhoto | null,
  requirements: DocumentRequirement[],
  partnerKind: PartnerKind,
): CompletionState {
  const checks: Array<{ done: boolean; label: string }> = [
    { done: form.ownerName.trim().length >= 2, label: "Enter owner / partner name" },
    { done: form.businessName.trim().length >= 2, label: "Enter business or display name" },
    { done: Boolean(files.profileImage), label: "Upload profile or store image" },
    { done: Boolean(liveCapture), label: "Capture live partner photo" },
    {
      done:
        form.addressLine.trim().length >= 4 &&
        form.city.trim().length >= 2 &&
        form.pincode.trim().length >= 5,
      label: "Complete address details",
    },
    { done: Boolean(form.location), label: "Select location pin" },
    { done: form.aadhaarNumber.trim().length >= 4, label: "Enter Aadhaar number" },
    { done: form.panNumber.trim().length >= 4, label: "Enter PAN number" },
    {
      done: form.accountHolderName.trim().length >= 2 && form.bankName.trim().length >= 2,
      label: "Enter bank account holder and bank name",
    },
    {
      done:
        form.accountNumber.trim().length >= 6 && form.accountNumber === form.confirmAccountNumber,
      label: "Confirm matching account number",
    },
    { done: form.ifscCode.trim().length >= 6, label: "Enter IFSC code" },
    { done: Boolean(files.bankProof), label: "Upload bank proof" },
    {
      done: form.accuracyConsent && form.verificationConsent,
      label: "Accept verification consent",
    },
  ];

  if (partnerKind === "home-services") {
    checks.push({
      done: form.serviceCategories.length > 0,
      label: "Select home-service categories",
    });
  }

  requirements.forEach((requirement) => {
    if (!requirement.optional) {
      checks.push({
        done: Boolean(files[requirement.key]),
        label: `Upload ${requirement.title.toLowerCase()}`,
      });
    }
  });

  const completedItems = checks.filter((check) => check.done).length;
  const missingItems = checks.filter((check) => !check.done).map((check) => check.label);
  const totalItems = checks.length;

  return {
    ready: missingItems.length === 0,
    percent: Math.round((completedItems / totalItems) * 100),
    completedItems,
    totalItems,
    missingItems,
  };
}

function getStatusContent(partnerApproval: string, rejectionReason: string | null) {
  if (partnerApproval === "APPROVED") {
    return {
      icon: CheckCircle2,
      title: "Approved",
      description: "This partner can access live jobs and payouts based on enabled permissions.",
      className: "border-success/30 bg-success/10 text-success",
    };
  }

  if (partnerApproval === "PENDING") {
    return {
      icon: Clock3,
      title: "Under admin review",
      description:
        "The application is locked while admins verify identity, documents, location, and settlement details.",
      className: "border-warning/30 bg-warning/10 text-warning",
    };
  }

  if (partnerApproval === "REJECTED") {
    return {
      icon: ClipboardCheck,
      title: "Resubmission needed",
      description:
        rejectionReason ??
        "Admin rejected this application. Update the requested details and submit again.",
      className: "border-destructive/30 bg-destructive/10 text-destructive",
    };
  }

  return {
    icon: ShieldCheck,
    title: "Draft verification",
    description:
      "Complete every required section, save progress when needed, then submit for admin approval.",
    className: "border-ride/30 bg-ride/10 text-ride",
  };
}

function getRoleSummary(form: VerificationForm, partnerKind: PartnerKind) {
  if (partnerKind === "store") {
    return form.storeType;
  }

  if (partnerKind === "home-services") {
    return form.serviceCategories.length > 0 ? form.serviceCategories.join(", ") : "Home services";
  }

  return `${form.vehicleType} ${form.vehicleNumber}`.trim();
}

function formatAddress(form: VerificationForm) {
  const parts = [form.addressLine, form.city, form.state, form.pincode].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Missing";
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

function getSubmitLabel(isReviewLocked: boolean, isPending: boolean) {
  if (isReviewLocked) {
    return "Waiting for review";
  }

  if (isPending) {
    return "Submitting...";
  }

  return "Submit for review";
}

function buildVerificationPayload(
  form: VerificationForm,
  files: Partial<Record<DocumentKey, FileSnapshot>>,
  liveCapture: CapturedPhoto | null,
  partnerKind: PartnerKind,
) {
  const documentFiles = Object.fromEntries(
    Object.entries(files).filter(([key]) => !["profileImage", "bankProof"].includes(key)),
  );

  return {
    partnerKind,
    name: form.ownerName.trim() || undefined,
    profile: {
      ownerName: form.ownerName,
      businessName: form.businessName,
      description: form.description,
      storeType: form.storeType,
      avgPrepTimeMinutes: form.avgPrepTimeMinutes,
      minOrderValue: form.minOrderValue,
      deliveryRadiusKm: form.deliveryRadiusKm,
      openingHours: form.openingHours,
      vehicleType: form.vehicleType,
      vehicleNumber: form.vehicleNumber,
      experienceYears: form.experienceYears,
      emergencyContact: form.emergencyContact,
      serviceCategories: form.serviceCategories,
      serviceRadiusKm: form.serviceRadiusKm,
      profileImage: files.profileImage ?? null,
      liveCapture: liveCapture ? { capturedAt: liveCapture.capturedAt, captured: true } : null,
    },
    address: {
      line: form.addressLine,
      city: form.city,
      state: form.state,
      pincode: form.pincode,
      landmark: form.landmark,
      location: form.location,
    },
    documents: {
      aadhaarNumber: form.aadhaarNumber,
      panNumber: form.panNumber,
      licenseNumber: form.licenseNumber,
      gstNumber: form.gstNumber,
      fssaiNumber: form.fssaiNumber,
      documentExpiry: form.documentExpiry,
      vehicleRcNumber: form.vehicleRcNumber,
      insuranceExpiry: form.insuranceExpiry,
      policeVerificationRef: form.policeVerificationRef,
      files: documentFiles,
    },
    settlements: {
      accountHolderName: form.accountHolderName,
      bankName: form.bankName,
      accountNumber: form.accountNumber,
      ifscCode: form.ifscCode,
      upiId: form.upiId,
      bankProof: files.bankProof ?? null,
      consents: {
        accuracy: form.accuracyConsent,
        verification: form.verificationConsent,
      },
    },
  };
}
