import { getAllowedOrigins } from "../utils/origin.util";

const LOCAL_ORIGIN_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::\d+)?$/i;

export function validateProductionReadiness(): void {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const errors: string[] = [];
  const origins = [...getAllowedOrigins()];

  if (origins.length === 0) {
    errors.push("CORS_ORIGIN must contain an exact production allowlist.");
  }

  for (const origin of origins) {
    if (origin.includes("*") || LOCAL_ORIGIN_PATTERN.test(origin)) {
      errors.push(`CORS origin is not production-safe: ${origin}`);
    }
  }

  requireEnv(errors, "AUTH_HASH_SECRET");
  requireEnv(errors, "CONFIG_SECRET_KEY");
  requireEnv(errors, "MFA_SECRET_KEY");
  requireEnv(errors, "RAZORPAY_KEY_ID");
  requireEnv(errors, "RAZORPAY_KEY_SECRET");
  requireEnv(errors, "RAZORPAY_WEBHOOK_SECRET");

  if ((process.env.SESSION_COOKIE_NAME ?? "").startsWith("__Host-") === false) {
    errors.push("SESSION_COOKIE_NAME must use the __Host- prefix in production.");
  }

  if ((process.env.SMS_PROVIDER ?? "mock") === "mock") {
    errors.push("SMS_PROVIDER=mock is not allowed in production.");
  }
  requireEnv(errors, "SMS_GATEWAY_URL");
  requireEnv(errors, "SMS_GATEWAY_API_KEY");

  if ((process.env.PAYMENT_PROVIDER ?? "mock") === "mock") {
    errors.push("PAYMENT_PROVIDER=mock is not allowed in production.");
  }

  if (process.env.MQTT_ENABLED === "true" && process.env.MQTT_BROKER_ACL_CONFIGURED !== "true") {
    errors.push("MQTT_BROKER_ACL_CONFIGURED=true is required when MQTT is enabled.");
  }

  if (errors.length > 0) {
    throw new Error(`Production readiness check failed:\n- ${errors.join("\n- ")}`);
  }
}

function requireEnv(errors: string[], key: string): void {
  if (!process.env[key]) {
    errors.push(`${key} is required in production.`);
  }
}

