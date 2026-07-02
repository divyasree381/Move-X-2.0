import type { OtpLoginRole } from "@/lib/api";

export const PARTNER_LOGIN_TYPE_SESSION_KEY = "movex-partner-login-type";

export type PartnerLoginType = "store-partner" | "delivery-partner" | "driver" | "electrician" | "home-repair" | "plumber";

export type PartnerLoginConfig = {
  slug: PartnerLoginType;
  label: string;
  shortLabel: string;
  description: string;
  backendRole: OtpLoginRole;
  serviceLine: string;
};

export const partnerLoginTypes = ["store-partner", "delivery-partner", "driver", "electrician", "home-repair", "plumber"] as const satisfies readonly PartnerLoginType[];

export const partnerLoginConfigs: PartnerLoginConfig[] = [
  {
    slug: "store-partner",
    label: "Store Partner",
    shortLabel: "Store",
    description: "Restaurants, grocery stores, and pharmacies managing catalog and orders.",
    backendRole: "RESTAURANT",
    serviceLine: "Marketplace",
  },
  {
    slug: "delivery-partner",
    label: "Delivery Partner",
    shortLabel: "Delivery",
    description: "Food, grocery, pharmacy, and courier delivery partners.",
    backendRole: "DELIVERY",
    serviceLine: "Delivery",
  },
  {
    slug: "driver",
    label: "Driver",
    shortLabel: "Driver",
    description: "Bike, auto, and cab drivers accepting ride requests.",
    backendRole: "DRIVER",
    serviceLine: "Mobility",
  },
  {
    slug: "electrician",
    label: "Electrician",
    shortLabel: "Electrician",
    description: "Verified electrical service professionals for scheduled home jobs.",
    backendRole: "DELIVERY",
    serviceLine: "Home services",
  },
  {
    slug: "home-repair",
    label: "Home Repair",
    shortLabel: "Repair",
    description: "Repair professionals handling appliance and maintenance visits.",
    backendRole: "DELIVERY",
    serviceLine: "Home services",
  },
  {
    slug: "plumber",
    label: "Plumber",
    shortLabel: "Plumber",
    description: "Verified plumbing professionals for scheduled service requests.",
    backendRole: "DELIVERY",
    serviceLine: "Home services",
  },
];

export function isPartnerLoginType(value: unknown): value is PartnerLoginType {
  return typeof value === "string" && (partnerLoginTypes as readonly string[]).includes(value);
}

export function getPartnerLoginConfig(value: PartnerLoginType) {
  return partnerLoginConfigs.find((config) => config.slug === value)!;
}
