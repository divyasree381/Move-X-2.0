import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { BadRequestException, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

const MFA_ALGORITHM = "aes-256-gcm";
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const DEFAULT_STEP_SECONDS = 30;
const DEFAULT_DIGITS = 6;

type EncryptedSecret = {
  encrypted: true;
  alg: typeof MFA_ALGORITHM;
  iv: string;
  tag: string;
  ciphertext: string;
};

@Injectable()
export class MfaService {
  generateSecret(): string {
    return toBase32(randomBytes(20));
  }

  encryptSecret(secret: string): Prisma.InputJsonValue {
    const key = this.encryptionKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv(MFA_ALGORITHM, key, iv);
    const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      encrypted: true,
      alg: MFA_ALGORITHM,
      iv: iv.toString("base64"),
      tag: tag.toString("base64"),
      ciphertext: ciphertext.toString("base64"),
    } satisfies EncryptedSecret;
  }

  decryptSecret(value: Prisma.JsonValue | null | undefined): string | null {
    if (!this.isEncryptedSecret(value)) {
      return null;
    }

    const decipher = createDecipheriv(MFA_ALGORITHM, this.encryptionKey(), Buffer.from(value.iv, "base64"));
    decipher.setAuthTag(Buffer.from(value.tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(value.ciphertext, "base64")), decipher.final()]).toString("utf8");
  }

  verifyCode(secret: string, code: string, now = Date.now()): boolean {
    const normalized = code.replace(/\s+/g, "");

    if (!/^\d{6}$/.test(normalized)) {
      return false;
    }

    const submitted = Buffer.from(normalized);

    for (const offset of [-1, 0, 1]) {
      const expected = Buffer.from(this.generateCode(secret, now, offset));

      if (submitted.length === expected.length && timingSafeEqual(submitted, expected)) {
        return true;
      }
    }

    return false;
  }

  provisioningUri(input: { issuer: string; account: string; secret: string }): string {
    const label = `${encodeURIComponent(input.issuer)}:${encodeURIComponent(input.account)}`;
    const query = new URLSearchParams({ secret: input.secret, issuer: input.issuer, algorithm: "SHA1", digits: String(DEFAULT_DIGITS), period: String(DEFAULT_STEP_SECONDS) });
    return `otpauth://totp/${label}?${query.toString()}`;
  }

  assertValidSetupCode(secret: string, code: string): void {
    if (!this.verifyCode(secret, code)) {
      throw new BadRequestException("Invalid MFA code");
    }
  }

  private generateCode(secret: string, now: number, windowOffset: number): string {
    const counter = Math.floor(now / 1000 / DEFAULT_STEP_SECONDS) + windowOffset;
    const key = fromBase32(secret);
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigUInt64BE(BigInt(counter));
    const hmac = createHmac("sha1", key).update(counterBuffer).digest();
    const offset = hmac[hmac.length - 1]! & 0x0f;
    const binary = ((hmac[offset]! & 0x7f) << 24) | ((hmac[offset + 1]! & 0xff) << 16) | ((hmac[offset + 2]! & 0xff) << 8) | (hmac[offset + 3]! & 0xff);
    return String(binary % 10 ** DEFAULT_DIGITS).padStart(DEFAULT_DIGITS, "0");
  }

  private isEncryptedSecret(value: Prisma.JsonValue | null | undefined): value is EncryptedSecret {
    return Boolean(
      value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        (value as Record<string, unknown>).encrypted === true &&
        (value as Record<string, unknown>).alg === MFA_ALGORITHM &&
        typeof (value as Record<string, unknown>).iv === "string" &&
        typeof (value as Record<string, unknown>).tag === "string" &&
        typeof (value as Record<string, unknown>).ciphertext === "string",
    );
  }

  private encryptionKey(): Buffer {
    const raw = process.env.MFA_SECRET_KEY ?? process.env.CONFIG_SECRET_KEY ?? process.env.AUTH_HASH_SECRET;

    if (!raw && process.env.NODE_ENV === "production") {
      throw new Error("MFA_SECRET_KEY or CONFIG_SECRET_KEY is required in production.");
    }

    return createHash("sha256").update(raw ?? "movex-dev-mfa-secret").digest();
  }
}

function toBase32(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31] ?? "";
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31] ?? "";
  }

  return output;
}

function fromBase32(secret: string): Buffer {
  const clean = secret.replace(/=+$/g, "").replace(/\s+/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);

    if (index === -1) {
      throw new BadRequestException("Invalid MFA secret");
    }

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}
