import type { OtpLoginRole } from "@/lib/api";

export const PARTNER_LOGIN_TYPE_SESSION_KEY = "movex-partner-login-type";

export type PartnerLoginType = "store-partner" | "delivery-partner" | "driver" | "home-services-partner";

export type PartnerLoginConfig = {
  slug: PartnerLoginType;
  label: string;
  shortLabel: string;
  description: string;
  backendRole: OtpLoginRole;
  serviceLine: string;
};

export const partnerLoginTypes = ["store-partner", "delivery-partner", "driver", "home-services-partner"] as const satisfies readonly PartnerLoginType[];

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
    slug: "home-services-partner",
    label: "Home Services Partner",
    shortLabel: "Home services",
    description: "One path for plumbing, electrical, cleaning, repair, and other home-service professionals.",
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