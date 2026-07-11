import { createHmac, timingSafeEqual } from "node:crypto";
import { Injectable } from "@nestjs/common";

@Injectable()
export class TokenHashService {
  private readonly secret: string;

  constructor() {
    const configuredSecret = process.env.AUTH_HASH_SECRET;

    if (!configuredSecret && process.env.NODE_ENV === "production") {
      throw new Error("AUTH_HASH_SECRET is required in production.");
    }

    this.secret = configuredSecret ?? (process.env.NODE_ENV === "test" ? "movex-test-auth-hash-secret" : "movex-dev-auth-hash-secret");
  }

  hashOtp(phoneE164: string, role: string, code: string): string {
    return this.hash("otp", `${phoneE164}:${role}:${code}`);
  }

  hashSessionToken(token: string): string {
    return this.hash("session", token);
  }

  createStaffAuthToken(tokenId: string, purpose: string): string {
    const signature = createHmac("sha256", this.secret)
      .update("staff-auth-token")
      .update("\0")
      .update(tokenId + ":" + purpose)
      .digest("base64url");
    return tokenId + "." + signature;
  }

  hashStaffAuthToken(token: string): string {
    return this.hash("staff-auth-token", token);
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