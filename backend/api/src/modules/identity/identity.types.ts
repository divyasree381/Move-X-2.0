import type { UserRoleValue } from "./constants";

export type IdentityUser = {
  id: string;
  role: UserRoleValue;
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
  createdAt?: Date;
  updatedAt?: Date;
};

export type PublicUser = {
  id: string;
  role: UserRoleValue;
  phoneE164?: string | null;
  email?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
  mfaEnabled?: boolean;
  isOnline: boolean;
  isBanned: boolean;
  partnerApproval: string;
  rejectionReason?: string | null;
  lastSeenAt?: string | null;
};

export type SessionRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date | null;
  lastSeenAt?: Date | null;
  user: IdentityUser;
};

export type CachedSession = Omit<SessionRecord, "expiresAt" | "revokedAt" | "lastSeenAt" | "user"> & {
  expiresAt: string;
  revokedAt?: string | null;
  lastSeenAt?: string | null;
  user: Omit<IdentityUser, "lastSeenAt" | "createdAt" | "updatedAt"> & {
    lastSeenAt?: string | null;
    createdAt?: string;
    updatedAt?: string;
  };
};

export type OtpChallenge = {
  phoneE164: string;
  role: UserRoleValue;
  codeHash: string;
  attempts: number;
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
};

export type RequestMetadata = {
  ipAddress?: string;
  userAgent?: string;
};

export type CreateSessionInput = {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
};
