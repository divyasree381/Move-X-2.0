import { strict as assert } from "node:assert";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

import { getAllowedOrigins } from "../src/common/utils/origin.util";
import { validateProductionReadiness } from "../src/common/security/production-readiness";
import { TokenHashService } from "../src/modules/identity/security/token-hash.service";
import { MfaService } from "../src/modules/identity/security/mfa.service";
import { RazorpayProvider } from "../src/modules/payments/razorpay.provider";

function withEnv<T>(env: NodeJS.ProcessEnv, run: () => T): T {
  const previous = { ...process.env };
  process.env = { ...previous, ...env };

  try {
    return run();
  } finally {
    process.env = previous;
  }
}

async function main(): Promise<void> {
  withEnv({ NODE_ENV: "production", CORS_ORIGIN: "https://ops.movex.example,https://app.movex.example" }, () => {
    const origins = getAllowedOrigins();
    assert(origins.has("https://ops.movex.example"));
    assert(!origins.has("http://localhost:3000"));
  });

  withEnv(
    {
      NODE_ENV: "production",
      CORS_ORIGIN: "*",
      SMS_PROVIDER: "mock",
      PAYMENT_PROVIDER: "mock",
      SESSION_COOKIE_NAME: "movex_session",
    },
    () => {
      assert.throws(() => validateProductionReadiness(), /CORS origin is not production-safe/);
    },
  );

  withEnv(
    {
      NODE_ENV: "production",
      CORS_ORIGIN: "https://app.movex.example",
      SMS_PROVIDER: "mock",
      PAYMENT_PROVIDER: "razorpay",
      SESSION_COOKIE_NAME: "__Host-movex_session",
      AUTH_HASH_SECRET: "prod-auth-secret",
      CONFIG_SECRET_KEY: "prod-config-secret",
      MFA_SECRET_KEY: "prod-mfa-secret",
      RAZORPAY_KEY_ID: "rzp_live_key",
      RAZORPAY_KEY_SECRET: "rzp_live_secret",
      RAZORPAY_WEBHOOK_SECRET: "webhook-secret",
    },
    () => {
      assert.throws(() => validateProductionReadiness(), /SMS_PROVIDER=mock/);
    },
  );

  withEnv(
    {
      NODE_ENV: "production",
      CORS_ORIGIN: "https://app.movex.example",
      SMS_PROVIDER: "msg91",
      SMS_GATEWAY_URL: "https://sms.example/send",
      SMS_GATEWAY_API_KEY: "sms-secret",
      PAYMENT_PROVIDER: "razorpay",
      SESSION_COOKIE_NAME: "__Host-movex_session",
      AUTH_HASH_SECRET: "prod-auth-secret",
      CONFIG_SECRET_KEY: "prod-config-secret",
      MFA_SECRET_KEY: "prod-mfa-secret",
      RAZORPAY_KEY_ID: "rzp_live_key",
      RAZORPAY_KEY_SECRET: "rzp_live_secret",
      RAZORPAY_WEBHOOK_SECRET: "webhook-secret",
      MQTT_ENABLED: "true",
      MQTT_BROKER_ACL_CONFIGURED: "false",
    },
    () => {
      assert.throws(() => validateProductionReadiness(), /MQTT_BROKER_ACL_CONFIGURED/);
    },
  );

  withEnv(
    {
      NODE_ENV: "production",
      CORS_ORIGIN: "https://app.movex.example",
      SMS_PROVIDER: "msg91",
      SMS_GATEWAY_URL: "https://sms.example/send",
      SMS_GATEWAY_API_KEY: "sms-secret",
      PAYMENT_PROVIDER: "razorpay",
      SESSION_COOKIE_NAME: "__Host-movex_session",
      AUTH_HASH_SECRET: "prod-auth-secret",
      CONFIG_SECRET_KEY: "prod-config-secret",
      MFA_SECRET_KEY: "prod-mfa-secret",
      RAZORPAY_KEY_ID: "rzp_live_key",
      RAZORPAY_KEY_SECRET: "rzp_live_secret",
      RAZORPAY_WEBHOOK_SECRET: "webhook-secret",
    },
    () => {
      assert.doesNotThrow(() => validateProductionReadiness());
    },
  );

  withEnv({ NODE_ENV: "test", AUTH_HASH_SECRET: "hash-secret" }, () => {
    const tokenHashService = new TokenHashService();
    const rawToken = "raw-session-token";
    const sessionHash = tokenHashService.hashSessionToken(rawToken);
    assert.notEqual(sessionHash, rawToken);
    assert.match(sessionHash, /^[0-9a-f]{64}$/);
    assert(tokenHashService.timingSafeEqualHash(sessionHash, tokenHashService.hashSessionToken(rawToken)));
  });

  withEnv({ NODE_ENV: "test", MFA_SECRET_KEY: "mfa-key" }, () => {
    const mfa = new MfaService();
    const secret = mfa.generateSecret();
    const encrypted = mfa.encryptSecret(secret);
    assert(!JSON.stringify(encrypted).includes(secret), "MFA secret must be encrypted at rest");
    assert.equal(mfa.decryptSecret(encrypted as unknown as Parameters<MfaService["decryptSecret"]>[0]), secret);
    assert.match(mfa.provisioningUri({ issuer: "MoveX", account: "ops@example.com", secret }), /^otpauth:\/\/totp\//);
  });

  const ordersSource = readFileSync("src/modules/orders/orders.service.ts", "utf8");
  const ridesSource = readFileSync("src/modules/rides/rides.service.ts", "utf8");
  const financeSource = readFileSync("src/modules/payments/finance.service.ts", "utf8");
  const opsSource = readFileSync("src/modules/ops/ops.service.ts", "utf8");
  const csrfSource = readFileSync("src/common/guards/csrf.guard.ts", "utf8");
  assert.match(ordersSource, /pickupOtpHash: this\.hashOtp/);
  assert.match(ordersSource, /deliveryOtpHash: this\.hashOtp/);
  assert.match(ridesSource, /startOtpHash: this\.hashOtp/);
  assert.match(financeSource, /ledgerEntry\.create/);
  assert.match(financeSource, /walletBalanceCached/);
  assert.match(opsSource, /createCipheriv/);
  assert.match(csrfSource, /origin/);
  assert.match(csrfSource, /referer/);
  assert.match(csrfSource, /x-csrf-token/);

  withEnv({ RAZORPAY_WEBHOOK_SECRET: "webhook-secret" }, () => {
    const provider = new RazorpayProvider();
    const body = Buffer.from(JSON.stringify({ event: "payment.captured", payload: { id: "pay_1" } }));
    const signature = createHmac("sha256", "webhook-secret").update(body).digest("hex");
    assert.equal(provider.verifyWebhookSignature(body, signature), true);
    assert.equal(provider.verifyWebhookSignature(body, signature.replace(/.$/, "0")), false);
  });
}

void main();


