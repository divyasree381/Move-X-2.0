import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

const ALGORITHM = "aes-256-gcm";

type EncryptedPayload = {
  encrypted: true;
  alg: typeof ALGORITHM;
  iv: string;
  tag: string;
  ciphertext: string;
};

@Injectable()
export class SensitiveDataService {
  encrypt(value: Record<string, string>): Prisma.InputJsonValue {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, this.encryptionKey(), iv);
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(value), "utf8"),
      cipher.final(),
    ]);
    const payload: EncryptedPayload = {
      encrypted: true,
      alg: ALGORITHM,
      iv: iv.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
      ciphertext: ciphertext.toString("base64"),
    };
    return payload as Prisma.InputJsonValue;
  }

  maskAadhaar(value: string): string {
    const digits = value.replace(/\D/g, "");
    return digits.length >= 4 ? `XXXX XXXX ${digits.slice(-4)}` : "XXXX XXXX XXXX";
  }

  maskPan(value: string): string {
    const normalized = value.trim().toUpperCase();
    return normalized.length >= 4 ? `${normalized.slice(0, 2)}*****${normalized.slice(-3)}` : "**********";
  }

  maskAccount(value: string): string {
    const normalized = value.replace(/\s/g, "");
    return normalized.length >= 4 ? `********${normalized.slice(-4)}` : "********";
  }

  maskUpi(value: string): string {
    const [handle, provider] = value.trim().split("@");
    if (!handle || !provider) return "********";
    return `${handle.slice(0, 2)}***@${provider}`;
  }

  private encryptionKey(): Buffer {
    const raw = process.env.PARTNER_KYC_SECRET_KEY ?? process.env.CONFIG_SECRET_KEY;
    if (!raw && process.env.NODE_ENV === "production") {
      throw new Error("PARTNER_KYC_SECRET_KEY or CONFIG_SECRET_KEY is required in production");
    }
    return createHash("sha256").update(raw ?? "movex-local-kyc-secret").digest();
  }
}