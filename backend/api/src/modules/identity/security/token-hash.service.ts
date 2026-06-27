import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { Injectable } from "@nestjs/common";

@Injectable()
export class TokenHashService {
  private readonly secret: string;

  constructor() {
    const configuredSecret = process.env.AUTH_HASH_SECRET;

    if (!configuredSecret && process.env.NODE_ENV === "production") {
      throw new Error("AUTH_HASH_SECRET is required in production.");
    }

    this.secret = configuredSecret ?? randomBytes(32).toString("hex");
  }

  hashOtp(phoneE164: string, role: string, code: string): string {
    return this.hash("otp", `${phoneE164}:${role}:${code}`);
  }

  hashSessionToken(token: string): string {
    return this.hash("session", token);
  }

  timingSafeEqualHash(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left, "hex");
    const rightBuffer = Buffer.from(right, "hex");

    if (leftBuffer.length !== rightBuffer.length) {
      return false;
    }

    return timingSafeEqual(leftBuffer, rightBuffer);
  }

  private hash(purpose: string, value: string): string {
    return createHmac("sha256", this.secret).update(purpose).update("\0").update(value).digest("hex");
  }
}