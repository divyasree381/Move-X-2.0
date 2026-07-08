import { AlertTriangle, Info } from "lucide-react";

import { cn } from "@/lib/utils";

type DisclaimerService = "FOOD" | "GROCERY" | "PHARMACY" | "RIDE" | "COURIER" | "HOME_SERVICE" | string;

const disclaimerCopy: Record<string, { title: string; points: string[] }> = {
  FOOD: {
    title: "Food order disclaimer",
    points: [
      "Restaurant prices, item availability, taxes, and preparation time can change before checkout.",
      "Food images and nutritional notes are indicative and may vary by portion, packaging, and recipe.",
    ],
  },
  GROCERY: {
    title: "Grocery order disclaimer",
    points: [
      "Weights, freshness, substitutions, discounts, and stock are confirmed by the picker before dispatch.",
      "Final bill values are recomputed on the server at checkout and again before handoff when needed.",
    ],
  },
  PHARMACY: {
    title: "Pharmacy disclaimer",
    points: [
      "Prescription medicines require pharmacist verification before acceptance and dispatch.",
      "MoveX does not replace medical advice; consult a qualified professional for dosage or treatment decisions.",
    ],
  },
  RIDE: {
    title: "Ride fare disclaimer",
    points: [
      "Route, ETA, surge, and cancellation fees are estimates until the live MapsProvider and matching state are confirmed.",
      "Final fare is computed server-side from the accepted vehicle, route, and trip status.",
    ],
  },
  COURIER: {
    title: "Courier disclaimer",
    points: [
      "Pickup/drop timing, parcel eligibility, and any cancellation fee depend on live partner progress.",
      "Do not send prohibited, illegal, hazardous, or restricted items through courier bookings.",
    ],
  },
  HOME_SERVICE: {
    title: "Home-service disclaimer",
    points: [
      "Visit time, scope, and final charge may change after professional inspection and customer approval.",
      "Only verified professionals should start work; report safety or billing issues through support.",
    ],
  },
};

export function ServiceDisclaimer({ serviceType, compact = false }: { serviceType: DisclaimerService; compact?: boolean }) {
  const normalized = serviceType.toUpperCase();
  const copy = disclaimerCopy[normalized] ?? {
    title: "Service disclaimer",
    points: ["Availability, timing, pricing, and fees are finalized by live backend validation before confirmation."],
  };
  const Icon = normalized === "PHARMACY" || normalized === "COURIER" ? AlertTriangle : Info;

  return (
    <section className={cn("rounded-md border border-border bg-surface-muted text-sm", compact ? "p-3" : "p-4")} aria-label={copy.title}>
      <p className="flex items-center gap-2 font-semibold text-foreground">
        <Icon className="size-4 text-warning" aria-hidden="true" />
        {copy.title}
      </p>
      <ul className="mt-2 space-y-1 text-xs leading-5 text-muted-foreground">
        {copy.points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
    </section>
  );
}