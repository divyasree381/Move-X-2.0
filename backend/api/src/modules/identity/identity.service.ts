import { ConflictException, ForbiddenException, Inject, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { AdminType, StaffAuthTokenPurpose } from "@prisma/client";
import { canPasswordLogin, PERMISSION_MATRIX } from "@movex/shared";
import { randomInt, randomUUID } from "node:crypto";

import { SMS_PROVIDER, type SmsProvider } from "../../infrastructure/sms/sms-provider";
import { OTP_MAX_ATTEMPTS, type OtpLoginRole, type UserRoleValue } from "./constants";
import { IdentityRepository } from "./identity.repository";
import type { PublicUser, RequestMetadata, SessionRecord } from "./identity.types";
import { OtpChallengeService } from "./otp/otp-challenge.service";
import { IdentityRateLimiterService } from "./rate-limiter/identity-rate-limiter.service";
import { PasswordService } from "./security/password.service";
import { TokenHashService } from "./security/token-hash.service";
import { SessionService, type CreatedSession } from "./session/session.service";
import { normalizePhoneToE164 } from "./utils/phone.util";

const GENERIC_OTP_MESSAGE = "If the OTP can be sent, it will arrive shortly.";
const GENERIC_AUTH_ERROR = "Invalid credentials";
const GENERIC_PASSWORD_RESET_MESSAGE = "If the account exists, password reset instructions will be sent shortly.";
const STAFF_INVITATION_TTL_MS = 48 * 60 * 60 * 1000;
const STAFF_PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;

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
  private readonly logger = new Logger(IdentityService.name);

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

    this.logger.log(`OTP request received for ${phoneE164} (Role: ${input.role})`);

    const code = this.generateOtpCode();
    const codeHash = this.tokenHashService.hashOtp(phoneE164, input.role, code);

    await this.otpChallenges.saveLatest({
      phoneE164,
      role: input.role,
      codeHash,
      now: new Date(),
    });

    this.logger.log(`OTP generated and stored for ${phoneE164}`);

    this.logger.log(`Sending SMS API request for ${phoneE164}...`);
    this.smsProvider.sendOtp({ phoneE164, code, purpose: "LOGIN" })
      .then(() => {
        this.logger.log(`SMS API request sent successfully to ${phoneE164}`);
      })
      .catch((error: unknown) => {
        this.logger.error(`Failed to send SMS to ${phoneE164}. Exact error:`, error);
      });

    return {
      message: GENERIC_OTP_MESSAGE,
      // devCode: process.env.NODE_ENV !== "production" ? code : undefined,
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

    // OTP is valid. Delete it from Redis so it cannot be used again.
    await this.otpChallenges.deleteLatest(phoneE164, input.role);

    // Find existing user or create a new one permanently in Postgres
    const user = await this.findOrCreateUser(phoneE164, input.role);

    if (user.isBanned) {
      throw new UnauthorizedException(GENERIC_AUTH_ERROR);
    }

    // Update the last login timestamp for tracking
    await this.repository.updateUserLastLogin(user.id, now);

    // Generate the session/JWT
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

  async loginAdmin(input: { email: string; password: string }, metadata: RequestMetadata): Promise<OtpVerifyResult> {
    const email = input.email.trim().toLowerCase();
    await this.rateLimiter.consumeStaffLogin(email, metadata.ipAddress);
    const user = await this.repository.findUserPasswordByEmail(email);

    if (!user?.passwordHash || user.isBanned || !canPasswordLogin(user.role as UserRoleValue)) {
      throw new UnauthorizedException(GENERIC_AUTH_ERROR);
    }

    const passwordMatches = await this.passwordService.verifyPassword(input.password, user.passwordHash);

    if (!passwordMatches) {
      throw new UnauthorizedException(GENERIC_AUTH_ERROR);
    }

    await this.repository.updateUserLastLogin(user.id, new Date());

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

    const email = input.email.trim().toLowerCase();
    const passwordHash = await this.passwordService.hashPassword(input.password);
    const user = await this.repository.createPasswordUser({
      role: "SUPER_ADMIN",
      adminType: AdminType.SUPER_ADMIN,
      email,
      passwordHash,
      name: input.name,
      emailVerifiedAt: new Date(),
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

  async registerStaff(input: { email: string; password: string; role: UserRoleValue; name?: string; phone?: string }): Promise<PublicUser> {
    if (!canPasswordLogin(input.role)) {
      throw new ForbiddenException("Role cannot use password login");
    }

    const email = input.email.trim().toLowerCase();
    const existing = await this.repository.findUserByEmail(email);

    if (existing) {
      throw new ConflictException("User already exists");
    }

    const passwordHash = await this.passwordService.hashPassword(input.password);
    const tokenId = randomUUID();
    const invitationToken = this.tokenHashService.createStaffAuthToken(tokenId, StaffAuthTokenPurpose.INVITATION);
    const user = await this.repository.createStaffWithInvitation({
      role: input.role,
      adminType: this.getAdminType(input.role),
      email,
      passwordHash,
      phoneE164: input.phone ? normalizePhoneToE164(input.phone) : undefined,
      name: input.name,
      tokenId,
      tokenHash: this.tokenHashService.hashStaffAuthToken(invitationToken),
      tokenExpiresAt: new Date(Date.now() + STAFF_INVITATION_TTL_MS),
    });

    return this.sessionService.toPublicUser(user);
  }

  async resendStaffInvitation(userId: string): Promise<{ message: string }> {
    const user = await this.repository.findUserById(userId);

    if (!user || !canPasswordLogin(user.role) || user.isBanned) {
      throw new UnauthorizedException("Staff account is unavailable");
    }

    if (user.emailVerifiedAt) {
      throw new ConflictException("Staff email is already verified");
    }

    const tokenId = randomUUID();
    const invitationToken = this.tokenHashService.createStaffAuthToken(tokenId, StaffAuthTokenPurpose.INVITATION);
    await this.repository.createInvitationToken({
      userId,
      tokenId,
      tokenHash: this.tokenHashService.hashStaffAuthToken(invitationToken),
      expiresAt: new Date(Date.now() + STAFF_INVITATION_TTL_MS),
    });
    return { message: "Invitation queued for delivery" };
  }
  async requestStaffPasswordReset(input: { email: string }, metadata: RequestMetadata): Promise<{ message: string }> {
    const email = input.email.trim().toLowerCase();
    await this.rateLimiter.consumeStaffRecovery(email, metadata.ipAddress);
    const user = await this.repository.findUserPasswordByEmail(email);

    if (user?.passwordHash && !user.isBanned && canPasswordLogin(user.role as UserRoleValue)) {
      const tokenId = randomUUID();
      const resetToken = this.tokenHashService.createStaffAuthToken(tokenId, StaffAuthTokenPurpose.PASSWORD_RESET);
      await this.repository.createPasswordResetToken({
        userId: user.id,
        tokenId,
        tokenHash: this.tokenHashService.hashStaffAuthToken(resetToken),
        expiresAt: new Date(Date.now() + STAFF_PASSWORD_RESET_TTL_MS),
      });
    }

    return { message: GENERIC_PASSWORD_RESET_MESSAGE };
  }

  async acceptStaffInvitation(input: { token: string; newPassword: string }): Promise<{ message: string }> {
    const passwordHash = await this.passwordService.hashPassword(input.newPassword);
    const user = await this.repository.consumeStaffAuthToken({
      tokenHash: this.tokenHashService.hashStaffAuthToken(input.token),
      purpose: StaffAuthTokenPurpose.INVITATION,
      passwordHash,
      now: new Date(),
    });

    if (!user) {
      throw new UnauthorizedException("Invalid or expired invitation");
    }

    await this.sessionService.revokeAllForUser(user.id);
    return { message: "Staff account activated" };
  }

  async resetStaffPassword(input: { token: string; newPassword: string }): Promise<{ message: string }> {
    const passwordHash = await this.passwordService.hashPassword(input.newPassword);
    const user = await this.repository.consumeStaffAuthToken({
      tokenHash: this.tokenHashService.hashStaffAuthToken(input.token),
      purpose: StaffAuthTokenPurpose.PASSWORD_RESET,
      passwordHash,
      now: new Date(),
    });

    if (!user) {
      throw new UnauthorizedException("Invalid or expired password reset link");
    }

    await this.sessionService.revokeAllForUser(user.id);
    return { message: "Password reset complete" };
  }

  async changeStaffPassword(
    session: SessionRecord,
    input: { currentPassword: string; newPassword: string },
  ): Promise<{ user: PublicUser }> {
    if (!canPasswordLogin(session.user.role)) {
      throw new ForbiddenException("Password change is only available for staff accounts");
    }

    const user = session.user.email ? await this.repository.findUserPasswordByEmail(session.user.email) : null;

    if (!user?.passwordHash || !(await this.passwordService.verifyPassword(input.currentPassword, user.passwordHash))) {
      throw new UnauthorizedException(GENERIC_AUTH_ERROR);
    }

    if (await this.passwordService.verifyPassword(input.newPassword, user.passwordHash)) {
      throw new ConflictException("New password must be different from the current password");
    }

    const passwordHash = await this.passwordService.hashPassword(input.newPassword);
    const updated = await this.repository.updateStaffPassword(user.id, passwordHash);
    await this.sessionService.revokeAllForUser(user.id);
    return { user: this.sessionService.toPublicUser(updated) };
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

