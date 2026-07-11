import { Inject, Injectable } from "@nestjs/common";
import { PartnerApproval, Prisma, StaffAuthTokenPurpose, UserRole as PrismaUserRole, type AdminType as PrismaAdminType } from "@prisma/client";

import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import type { UserRoleValue } from "./constants";
import type { CreateSessionInput, IdentityUser, SessionRecord } from "./identity.types";
import type { OtpLoginRole } from "./constants";

export type UserListInput = {
  cursor?: string;
  limit: number;
  role?: UserRoleValue;
};

export type CreatePasswordUserInput = {
  role: UserRoleValue;
  adminType?: PrismaAdminType;
  email: string;
  passwordHash: string;
  phoneE164?: string;
  name?: string;
  mustChangePassword?: boolean;
  emailVerifiedAt?: Date;
};

export type AddressInput = {
  line: string;
  city: string;
  state: string;
  pincode: string;
  lat: number;
  lng: number;
  isDefault?: boolean;
};

export type AddressUpdateInput = Partial<AddressInput>;

@Injectable()
export class IdentityRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findUserById(userId: string): Promise<IdentityUser | null> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return user ? this.toIdentityUser(user) : null;
  }

  async findUserByEmail(email: string): Promise<IdentityUser | null> {
    const user = await this.prisma.user.findFirst({
      where: { email: email.toLowerCase() },
    });

    return user ? this.toIdentityUser(user) : null;
  }

  async findUserPasswordByEmail(email: string): Promise<(IdentityUser & { passwordHash?: string | null; mfaSecretEncrypted?: Prisma.JsonValue | null }) | null> {
    const user = await this.prisma.user.findFirst({
      where: { email: email.toLowerCase() },
    });

    return user ? { ...this.toIdentityUser(user), passwordHash: user.passwordHash, mfaSecretEncrypted: user.mfaSecretEncrypted } : null;
  }

  async hasSuperAdmin(): Promise<boolean> {
    const count = await this.prisma.user.count({ where: { role: PrismaUserRole.SUPER_ADMIN } });
    return count > 0;
  }

  async findUserByPhoneAndRole(phoneE164: string, role: OtpLoginRole): Promise<IdentityUser | null> {
    const user = await this.prisma.user.findFirst({
      where: {
        phoneE164,
        role: role as PrismaUserRole,
      },
    });

    return user ? this.toIdentityUser(user) : null;
  }

  async createUserWithPhone(phoneE164: string, role: OtpLoginRole): Promise<IdentityUser> {
    const user = await this.prisma.user.create({
      data: {
        phoneE164,
        role: role as PrismaUserRole,
      },
    });

    return this.toIdentityUser(user);
  }

  async createPasswordUser(input: CreatePasswordUserInput): Promise<IdentityUser> {
    const user = await this.prisma.user.create({
      data: {
        role: input.role as PrismaUserRole,
        adminType: input.adminType,
        email: input.email.toLowerCase(),
        phoneE164: input.phoneE164,
        passwordHash: input.passwordHash,
        name: input.name,
        mustChangePassword: input.mustChangePassword ?? false,
        emailVerifiedAt: input.emailVerifiedAt,
        partnerApproval: PartnerApproval.NONE,
      },
    });

    return this.toIdentityUser(user);
  }

  async createStaffWithInvitation(input: CreatePasswordUserInput & {
    tokenId: string;
    tokenHash: string;
    tokenExpiresAt: Date;
  }): Promise<IdentityUser> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          role: input.role as PrismaUserRole,
          adminType: input.adminType,
          email: input.email.toLowerCase(),
          phoneE164: input.phoneE164,
          passwordHash: input.passwordHash,
          name: input.name,
          mustChangePassword: true,
          partnerApproval: PartnerApproval.NONE,
        },
      });
      await tx.staffAuthToken.create({
        data: {
          id: input.tokenId,
          userId: user.id,
          purpose: StaffAuthTokenPurpose.INVITATION,
          tokenHash: input.tokenHash,
          expiresAt: input.tokenExpiresAt,
        },
      });
      await tx.outboxEvent.create({
        data: {
          type: "staff.invited",
          payload: {
            userId: user.id,
            tokenId: input.tokenId,
            tokenPurpose: StaffAuthTokenPurpose.INVITATION,
          },
        },
      });
      return this.toIdentityUser(user);
    });
  }

  async createInvitationToken(input: {
    userId: string;
    tokenId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.staffAuthToken.updateMany({
        where: {
          userId: input.userId,
          purpose: StaffAuthTokenPurpose.INVITATION,
          usedAt: null,
        },
        data: { usedAt: new Date() },
      });
      await tx.staffAuthToken.create({
        data: {
          id: input.tokenId,
          userId: input.userId,
          purpose: StaffAuthTokenPurpose.INVITATION,
          tokenHash: input.tokenHash,
          expiresAt: input.expiresAt,
        },
      });
      await tx.outboxEvent.create({
        data: {
          type: "staff.invited",
          payload: {
            userId: input.userId,
            tokenId: input.tokenId,
            tokenPurpose: StaffAuthTokenPurpose.INVITATION,
          },
        },
      });
    });
  }
  async createPasswordResetToken(input: {
    userId: string;
    tokenId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.staffAuthToken.updateMany({
        where: {
          userId: input.userId,
          purpose: StaffAuthTokenPurpose.PASSWORD_RESET,
          usedAt: null,
        },
        data: { usedAt: new Date() },
      });
      await tx.staffAuthToken.create({
        data: {
          id: input.tokenId,
          userId: input.userId,
          purpose: StaffAuthTokenPurpose.PASSWORD_RESET,
          tokenHash: input.tokenHash,
          expiresAt: input.expiresAt,
        },
      });
      await tx.outboxEvent.create({
        data: {
          type: "staff.password-reset-requested",
          payload: {
            userId: input.userId,
            tokenId: input.tokenId,
            tokenPurpose: StaffAuthTokenPurpose.PASSWORD_RESET,
          },
        },
      });
    });
  }

  async consumeStaffAuthToken(input: {
    tokenHash: string;
    purpose: StaffAuthTokenPurpose;
    passwordHash: string;
    now: Date;
  }): Promise<IdentityUser | null> {
    return this.prisma.$transaction(async (tx) => {
      const token = await tx.staffAuthToken.findUnique({
        where: { tokenHash: input.tokenHash },
        include: { user: true },
      });

      if (!token || token.purpose !== input.purpose || token.usedAt || token.expiresAt <= input.now || token.user.isBanned) {
        return null;
      }

      const consumed = await tx.staffAuthToken.updateMany({
        where: { id: token.id, usedAt: null, expiresAt: { gt: input.now } },
        data: { usedAt: input.now },
      });

      if (consumed.count !== 1) {
        return null;
      }

      const user = await tx.user.update({
        where: { id: token.userId },
        data: {
          passwordHash: input.passwordHash,
          mustChangePassword: false,
          ...(input.purpose === StaffAuthTokenPurpose.INVITATION ? { emailVerifiedAt: input.now } : {}),
        },
      });
      return this.toIdentityUser(user);
    });
  }

  async updateStaffPassword(userId: string, passwordHash: string): Promise<IdentityUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    });
    return this.toIdentityUser(user);
  }
  async saveMfaSecret(userId: string, encryptedSecret: Prisma.InputJsonValue): Promise<IdentityUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecretEncrypted: encryptedSecret, mfaEnabled: false },
    });

    return this.toIdentityUser(user);
  }

  async enableMfa(userId: string): Promise<IdentityUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true },
    });

    return this.toIdentityUser(user);
  }

  async disableMfa(userId: string): Promise<IdentityUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: false, mfaSecretEncrypted: Prisma.JsonNull },
    });

    return this.toIdentityUser(user);
  }

  async getMfaState(userId: string): Promise<{ mfaEnabled: boolean; mfaSecretEncrypted: Prisma.JsonValue | null; email: string | null; role: PrismaUserRole } | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true, mfaSecretEncrypted: true, email: true, role: true },
    });
  }
  async updateUserProfile(userId: string, input: { name?: string; email?: string; avatarUrl?: string }): Promise<IdentityUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.email !== undefined ? { email: input.email.toLowerCase() } : {}),
        ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
      },
    });

    return this.toIdentityUser(user);
  }

  async submitPartnerProfile(userId: string, input: { name?: string; avatarUrl?: string }): Promise<IdentityUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
        partnerApproval: PartnerApproval.PENDING,
        rejectionReason: null,
      },
    });

    await this.notifyAdminsPartnerPending(user.id, user.role);
    return this.toIdentityUser(user);
  }

  async setPartnerApproval(userId: string, approval: "APPROVED" | "REJECTED", reason?: string): Promise<IdentityUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        partnerApproval: approval === "APPROVED" ? PartnerApproval.APPROVED : PartnerApproval.REJECTED,
        rejectionReason: approval === "REJECTED" ? reason ?? "Rejected" : null,
      },
    });

    return this.toIdentityUser(user);
  }

  async setUserBanned(userId: string, isBanned: boolean, reason?: string): Promise<IdentityUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        isBanned,
        rejectionReason: isBanned ? reason ?? null : null,
        isOnline: isBanned ? false : undefined,
      },
    });

    return this.toIdentityUser(user);
  }

  async setUserOnline(userId: string, isOnline: boolean): Promise<IdentityUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { isOnline },
    });

    return this.toIdentityUser(user);
  }

  async updateUserLastSeen(userId: string, lastSeenAt: Date): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastSeenAt },
    });
  }

  async updateUserLastLogin(userId: string, lastLoginAt: Date): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt },
    });
  }

  async listUsers(input: UserListInput) {
    const users = await this.prisma.user.findMany({
      where: input.role ? { role: input.role as PrismaUserRole } : undefined,
      orderBy: { id: "asc" },
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    });
    const nextCursor = users.length > input.limit ? users[input.limit]?.id : null;

    return {
      items: users.slice(0, input.limit).map((user) => this.toIdentityUser(user)),
      nextCursor,
    };
  }

  async listPendingPartners(limit: number, cursor?: string) {
    const users = await this.prisma.user.findMany({
      where: {
        partnerApproval: PartnerApproval.PENDING,
        role: { in: [PrismaUserRole.RESTAURANT, PrismaUserRole.DELIVERY, PrismaUserRole.DRIVER] },
      },
      orderBy: { id: "asc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const nextCursor = users.length > limit ? users[limit]?.id : null;

    return {
      items: users.slice(0, limit).map((user) => this.toIdentityUser(user)),
      nextCursor,
    };
  }

  async listAddresses(userId: string) {
    return this.prisma.address.findMany({ where: { userId }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] });
  }

  async createAddress(userId: string, input: AddressInput) {
    return this.prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      }

      return tx.address.create({
        data: {
          userId,
          line: input.line,
          city: input.city,
          state: input.state,
          pincode: input.pincode,
          lat: input.lat,
          lng: input.lng,
          isDefault: input.isDefault ?? false,
        },
      });
    });
  }

  async updateAddress(userId: string, addressId: string, input: AddressUpdateInput) {
    return this.prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      }

      const address = await tx.address.findFirst({ where: { id: addressId, userId } });

      if (!address) {
        throw new Error("Address not found");
      }

      return tx.address.update({
        where: { id: addressId },
        data: input,
      });
    });
  }

  async deleteAddress(userId: string, addressId: string): Promise<void> {
    const address = await this.prisma.address.findFirst({ where: { id: addressId, userId } });

    if (!address) {
      throw new Error("Address not found");
    }

    await this.prisma.address.delete({ where: { id: addressId } });
  }

  async createSession(input: CreateSessionInput): Promise<SessionRecord> {
    const session = await this.prisma.session.create({
      data: {
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
      include: { user: true },
    });

    return this.toSessionRecord(session);
  }

  async findActiveSessionByTokenHash(tokenHash: string, now: Date): Promise<SessionRecord | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session || session.revokedAt || session.expiresAt <= now || session.user.isBanned) {
      return null;
    }

    return this.toSessionRecord(session);
  }

  async touchSession(sessionId: string, userId: string, lastSeenAt: Date): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.session.update({
        where: { id: sessionId },
        data: { lastSeenAt },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { lastSeenAt },
      }),
    ]);
  }

  async revokeSessionByTokenHash(tokenHash: string, revokedAt: Date): Promise<void> {
    await this.prisma.session.updateMany({
      where: {
        tokenHash,
        revokedAt: null,
      },
      data: { revokedAt },
    });
  }

  async revokeAllUserSessions(userId: string, revokedAt: Date): Promise<string[]> {
    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: revokedAt },
      },
      select: { tokenHash: true },
    });

    await this.prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: { revokedAt },
    });

    return sessions.map((session) => session.tokenHash);
  }

  private async notifyAdminsPartnerPending(partnerId: string, role: PrismaUserRole): Promise<void> {
    const admins = await this.prisma.user.findMany({
      where: { role: { in: [PrismaUserRole.ADMIN, PrismaUserRole.SUPER_ADMIN] }, isBanned: false },
      select: { id: true },
    });

    if (!admins.length) {
      return;
    }

    await this.prisma.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        title: "Partner approval pending",
        body: `${role} partner ${partnerId} submitted a profile for review.`,
        payload: { partnerId, role },
      })),
    });
  }

  private toSessionRecord(session: { id: string; userId: string; tokenHash: string; expiresAt: Date; revokedAt: Date | null; lastSeenAt: Date | null; user: unknown }): SessionRecord {
    return {
      id: session.id,
      userId: session.userId,
      tokenHash: session.tokenHash,
      expiresAt: session.expiresAt,
      revokedAt: session.revokedAt,
      lastSeenAt: session.lastSeenAt,
      user: this.toIdentityUser(session.user),
    };
  }

  private toIdentityUser(user: unknown): IdentityUser {
    const record = user as {
      id: string;
      role: IdentityUser["role"];
      adminType?: string | null;
      phoneE164?: string | null;
      email?: string | null;
      name?: string | null;
      avatarUrl?: string | null;
      mfaEnabled?: boolean;
      isBanned: boolean;
      isOnline: boolean;
      partnerApproval: string;
      rejectionReason?: string | null;
      lastSeenAt?: Date | null;
      lastLoginAt?: Date | null;
      emailVerifiedAt?: Date | null;
      mustChangePassword?: boolean;
      profileCompleted: boolean;
      createdAt?: Date;
      updatedAt?: Date;
    };

    return {
      id: record.id,
      role: record.role,
      adminType: record.adminType,
      phoneE164: record.phoneE164,
      email: record.email,
      name: record.name,
      avatarUrl: record.avatarUrl,
      mfaEnabled: record.mfaEnabled ?? false,
      isBanned: record.isBanned,
      isOnline: record.isOnline,
      partnerApproval: record.partnerApproval,
      rejectionReason: record.rejectionReason,
      lastSeenAt: record.lastSeenAt,
      lastLoginAt: record.lastLoginAt,
      emailVerifiedAt: record.emailVerifiedAt,
      mustChangePassword: record.mustChangePassword ?? false,
      profileCompleted: record.profileCompleted,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}

