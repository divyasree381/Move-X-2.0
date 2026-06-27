import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";

import { RedisStoreService } from "../../../infrastructure/redis/redis-store.service";

const DEFAULT_WINDOW_MS = 15 * 60 * 1000;

@Injectable()
export class IdentityRateLimiterService {
  constructor(@Inject(RedisStoreService) private readonly redisStore: RedisStoreService) {}

  async consumeOtpRequest(phoneE164: string, ipAddress: string | undefined): Promise<void> {
    await Promise.all([
      this.consume(`identity:otp-request:phone:${phoneE164}`, this.getNumber("OTP_REQUEST_PHONE_LIMIT", 3), DEFAULT_WINDOW_MS),
      this.consume(`identity:otp-request:ip:${ipAddress ?? "unknown"}`, this.getNumber("OTP_REQUEST_IP_LIMIT", 20), DEFAULT_WINDOW_MS),
    ]);
  }

  async consumeOtpVerify(phoneE164: string, ipAddress: string | undefined): Promise<void> {
    await Promise.all([
      this.consume(`identity:otp-verify:phone:${phoneE164}`, this.getNumber("OTP_VERIFY_PHONE_LIMIT", 20), DEFAULT_WINDOW_MS),
      this.consume(`identity:otp-verify:ip:${ipAddress ?? "unknown"}`, this.getNumber("OTP_VERIFY_IP_LIMIT", 60), DEFAULT_WINDOW_MS),
    ]);
  }

  private async consume(key: string, limit: number, ttlMs: number): Promise<void> {
    const count = await this.redisStore.increment(key, ttlMs);

    if (count > limit) {
      throw new HttpException("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private getNumber(name: string, fallback: number): number {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }
}