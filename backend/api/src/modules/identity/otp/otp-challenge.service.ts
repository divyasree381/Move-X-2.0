import { Inject, Injectable } from "@nestjs/common";
import { RedisStoreService } from "../../../infrastructure/redis/redis-store.service";
import { OTP_TTL_MS, type OtpLoginRole } from "../constants";
import type { OtpChallenge } from "../identity.types";

@Injectable()
export class OtpChallengeService {
  constructor(@Inject(RedisStoreService) private readonly redisStore: RedisStoreService) {}

  async saveLatest(input: {
    phoneE164: string;
    role: OtpLoginRole;
    codeHash: string;
    now: Date;
  }): Promise<OtpChallenge> {
    const ttlMs = this.getTtlMs();
    const challenge: OtpChallenge = {
      phoneE164: input.phoneE164,
      role: input.role,
      codeHash: input.codeHash,
      attempts: 0,
      createdAt: input.now.toISOString(),
      expiresAt: new Date(input.now.getTime() + ttlMs).toISOString(),
    };

    await this.redisStore.setJson(this.getLatestKey(input.phoneE164, input.role), challenge, ttlMs);
    return challenge;
  }

  async getLatest(phoneE164: string, role: string): Promise<OtpChallenge | null> {
    return this.redisStore.getJson<OtpChallenge>(this.getLatestKey(phoneE164, role));
  }

  async save(challenge: OtpChallenge): Promise<void> {
    const ttlMs = Math.max(new Date(challenge.expiresAt).getTime() - Date.now(), 1_000);
    await this.redisStore.setJson(this.getLatestKey(challenge.phoneE164, challenge.role), challenge, ttlMs);
  }

  getLatestKey(phoneE164: string, role: string): string {
    return `identity:otp:latest:${role}:${phoneE164}`;
  }

  private getTtlMs(): number {
    const ttlSeconds = Number(process.env.OTP_TTL_SECONDS);
    return Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? ttlSeconds * 1000 : OTP_TTL_MS;
  }
}