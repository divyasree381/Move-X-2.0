import type { UserRole } from "@movex/shared";

export type UserRoleValue = `${UserRole}`;

export const OTP_LOGIN_ROLES = ["CUSTOMER", "RESTAURANT", "DELIVERY", "DRIVER"] as const satisfies readonly UserRoleValue[];

export type OtpLoginRole = (typeof OTP_LOGIN_ROLES)[number];

export const SESSION_COOKIE_FALLBACK = "__Host-movex_session";
export const HAS_SESSION_COOKIE = "has_session";
export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;