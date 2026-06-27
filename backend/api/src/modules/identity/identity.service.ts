import { ConflictException, ForbiddenException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { AdminType } from "@prisma/client";
import { canPasswordLogin, PERMISSION_MATRIX } from "@movex/shared";
import { randomInt } from "node:crypto";

import { SMS_PROVIDER, type SmsProvider } from "../../infrastructure/sms/sms-provider";
import { OTP_MAX_ATTEMPTS, type OtpLoginRole, type UserRoleValue } from "./constants";
import { IdentityRepository } from "./identity.repository";
import type { PublicUser, RequestMetadata, SessionRecord } from "./identity.types";
import { OtpChallengeService } from "./otp/otp-challenge.service";
import { IdentityRateLimiterService } from "./rate-limiter/identity-rate-limiter.service";
import { MfaService } from "./security/mfa.service";
import { PasswordService } from "./security/password.service";
import { TokenHashService } from "./security/token-hash.service";
import { SessionService, type CreatedSession } from "./session/session.service";
import { normalizePhoneToE164 } from "./utils/phone.util";

const GENERIC_OTP_MESSAGE = "If the OTP can be sent, it will arrive shortly.";
const GENERIC_AUTH_ERROR = "Invalid credentials";

export type OtpRequestResult = {
  message: string;
  devCode?: string;
};

export type OtpVerifyResult = {
  session: CreatedSession;
  user: PublicUser;
};

@Injectable()
export class IdentityService {
  constructor(
    @Inject(IdentityRepository) private readonly repository: IdentityRepository,
    @Inject(TokenHashService) private readonly tokenHashService: TokenHashService,
    @Inject(OtpChallengeService) private readonly otpChallenges: OtpChallengeService,
    @Inject(IdentityRateLimiterService) private readonly rateLimiter: IdentityRateLimiterService,
    @Inject(SessionService) private readonly sessionService: SessionService,
    @Inject(PasswordService) private readonly passwordService: PasswordService,
    @Inject(SMS_PROVIDER) private readonly smsProvider: SmsProvider,
  ) {}

  getPermissionMatrix() {
    return PERMISSION_MATRIX;
  }

  async requestOtp(input: { phone: string; role: OtpLoginRole }, metadata: RequestMetadata): Promise<OtpRequestResult> {
    const phoneE164 = normalizePhoneToE164(input.phone);
    await this.rateLimiter.consumeOtpRequest(phoneE164, metadata.ipAddress);

    const code = this.generateOtpCode();
    const codeHash = this.tokenHashService.hashOtp(phoneE164, input.role, code);

    await this.otpChallenges.saveLatest({
      phoneE164,
      role: input.role,
      codeHash,
      now: new Date(),
    });

    try {
      await this.smsProvider.sendOtp({ phoneE164, code, purpose: "LOGIN" });
    } catch {
      // Keep the public response generic to avoid account or provider-state enumeration.
    }

    return {
      message: GENERIC_OTP_MESSAGE,
      ...(process.env.NODE_ENV === "production" ? {} : { devCode: code }),
    };
  }

  async verifyOtp(input: { phone: string; role: OtpLoginRole; code: string }, metadata: RequestMetadata): Promise<OtpVerifyResult> {
    const phoneE164 = normalizePhoneToE164(input.phone);
    await this.rateLimiter.consumeOtpVerify(phoneE164, metadata.ipAddress);

    const challenge = await this.otpChallenges.getLatest(phoneE164, input.role);
    const now = new Date();

    if (!challenge || challenge.phoneE164 !== phoneE164 || challenge.role !== input.role) {
      throw this.invalidOtp();
    }

    if (challenge.usedAt || new Date(challenge.expiresAt) <= now) {
      throw this.invalidOtp();
    }

    if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
      throw this.invalidOtp();
    }

    const submittedHash = this.tokenHashService.hashOtp(phoneE164, input.role, input.code);

    if (!this.tokenHashService.timingSafeEqualHash(challenge.codeHash, submittedHash)) {
      challenge.attempts += 1;
      await this.otpChallenges.save(challenge);
      throw this.invalidOtp();
    }

    challenge.usedAt = now.toISOString();
    await this.otpChallenges.save(challenge);

    const user = await this.findOrCreateUser(phoneE164, input.role);

    if (user.isBanned) {
      throw new UnauthorizedException(GENERIC_AUTH_ERROR);
    }

    const session = await this.sessionService.createSession({
      userId: user.id,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });

    return {
      session,
      user: this.sessionService.toPublicUser(session.session.user),
    };
  }

  async loginAdmin(input: { email: string; password: string; mfaCode?: string }, metadata: RequestMetadata): Promise<OtpVerifyResult> {
    const user = await this.repository.findUserPasswordByEmail(input.email);

    if (!user?.passwordHash || user.isBanned || !canPasswordLogin(user.role as UserRoleValue)) {
      throw new UnauthorizedException(GENERIC_AUTH_ERROR);
    }

    const passwordMatches = await this.passwordService.verifyPassword(input.password, user.passwordHash);

    if (!passwordMatches) {
      throw new UnauthorizedException(GENERIC_AUTH_ERROR);
    }

    if (user.mfaEnabled) {
      const secret = this.mfaService.decryptSecret(user.mfaSecretEncrypted);

      if (!secret || !input.mfaCode || !this.mfaService.verifyCode(secret, input.mfaCode)) {
        throw new UnauthorizedException(GENERIC_AUTH_ERROR);
      }
    } else if (process.env.NODE_ENV === "production" && process.env.STAFF_MFA_REQUIRED !== "false") {
      throw new UnauthorizedException("MFA enrollment is required for staff login");
    }

    const session = await this.sessionService.createSession({
      userId: user.id,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });

    return {
      session,
      user: this.sessionService.toPublicUser(session.session.user),
    };
  }

  async bootstrapSuperAdmin(input: { setupToken: string; email: string; password: string; name?: string }, metadata: RequestMetadata): Promise<OtpVerifyResult> {
    const expectedToken = process.env.ADMIN_BOOTSTRAP_TOKEN;

    if (!expectedToken || input.setupToken !== expectedToken) {
      throw new ForbiddenException("Invalid setup token");
    }

    if (await this.repository.hasSuperAdmin()) {
      throw new ConflictException("Super admin already exists");
    }

    const passwordHash = await this.passwordService.hashPassword(input.password);
    const user = await this.repository.createPasswordUser({
      role: "SUPER_ADMIN",
      adminType: AdminType.SUPER_ADMIN,
      email: input.email,
      passwordHash,
      name: input.name,
    });
    const session = await this.sessionService.createSession({
      userId: user.id,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });

    return {
      session,
      user: this.sessionService.toPublicUser(session.session.user),
    };
  }

  async setupMfa(userId: string): Promise<{ secret: string; otpauthUrl: string }> {
    const user = await this.repository.getMfaState(userId);

    if (!user || !canPasswordLogin(user.role as UserRoleValue)) {
      throw new ForbiddenException("MFA is only available for staff users");
    }

    const secret = this.mfaService.generateSecret();
    await this.repository.saveMfaSecret(userId, this.mfaService.encryptSecret(secret));

    return {
      secret,
      otpauthUrl: this.mfaService.provisioningUri({ issuer: "MoveX", account: user.email ?? userId, secret }),
    };
  }

  async confirmMfa(userId: string, code: string): Promise<PublicUser> {
    const user = await this.repository.getMfaState(userId);
    const secret = this.mfaService.decryptSecret(user?.mfaSecretEncrypted);

    if (!user || !canPasswordLogin(user.role as UserRoleValue) || !secret) {
      throw new ForbiddenException("MFA setup is not available");
    }

    this.mfaService.assertValidSetupCode(secret, code);
    return this.sessionService.toPublicUser(await this.repository.enableMfa(userId));
  }

  async disableMfa(userId: string, code: string): Promise<PublicUser> {
    const user = await this.repository.getMfaState(userId);
    const secret = this.mfaService.decryptSecret(user?.mfaSecretEncrypted);

    if (!user || !canPasswordLogin(user.role as UserRoleValue) || !user.mfaEnabled || !secret) {
      throw new ForbiddenException("MFA is not enabled");
    }

    this.mfaService.assertValidSetupCode(secret, code);
    return this.sessionService.toPublicUser(await this.repository.disableMfa(userId));
  }
  async registerStaff(input: { email: string; password: string; role: UserRoleValue; name?: string; phone?: string }): Promise<PublicUser> {
    if (!canPasswordLogin(input.role)) {
      throw new ForbiddenException("Role cannot use password login");
    }

    const existing = await this.repository.findUserByEmail(input.email);

    if (existing) {
      throw new ConflictException("User already exists");
    }

    const passwordHash = await this.passwordService.hashPassword(input.password);
    const user = await this.repository.createPasswordUser({
      role: input.role,
      adminType: this.getAdminType(input.role),
      email: input.email,
      passwordHash,
      phoneE164: input.phone ? normalizePhoneToE164(input.phone) : undefined,
      name: input.name,
    });

    return this.sessionService.toPublicUser(user);
  }

  async getMe(session: SessionRecord): Promise<PublicUser> {
    const touchedSession = await this.sessionService.touchSession(session);
    return this.sessionService.toPublicUser(touchedSession.user);
  }

  private async findOrCreateUser(phoneE164: string, role: OtpLoginRole) {
    const existingUser = await this.repository.findUserByPhoneAndRole(phoneE164, role);

    if (existingUser) {
      return existingUser;
    }

    return this.repository.createUserWithPhone(phoneE164, role);
  }

  private getAdminType(role: UserRoleValue): AdminType | undefined {
    if (role === "SUPER_ADMIN") {
      return AdminType.SUPER_ADMIN;
    }

    if (role === "ADMIN") {
      return AdminType.ADMIN;
    }

    return undefined;
  }

  private generateOtpCode(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, "0");
  }

  private invalidOtp(): UnauthorizedException {
    return new UnauthorizedException("Invalid or expired OTP");
  }
}

