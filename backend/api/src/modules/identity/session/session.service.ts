import { randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { Request } from "express";

import { RedisStoreService } from "../../../infrastructure/redis/redis-store.service";
import { HAS_SESSION_COOKIE, SESSION_COOKIE_FALLBACK, SESSION_TTL_SECONDS } from "../constants";
import { IdentityRepository } from "../identity.repository";
import type { CachedSession, CreateSessionInput, PublicUser, RequestMetadata, SessionRecord } from "../identity.types";
import { TokenHashService } from "../security/token-hash.service";

const SESSION_CACHE_PREFIX = "identity:session:";

export type CreatedSession = {
  token: string;
  session: SessionRecord;
  maxAgeSeconds: number;
};

@Injectable()
export class SessionService {
  constructor(
    @Inject(IdentityRepository) private readonly repository: IdentityRepository,
    @Inject(TokenHashService) private readonly tokenHashService: TokenHashService,
    @Inject(RedisStoreService) private readonly redisStore: RedisStoreService,
  ) {}

  async createSession(input: Omit<CreateSessionInput, "tokenHash" | "expiresAt">): Promise<CreatedSession> {
    const token = randomBytes(32).toString("base64url");
    const tokenHash = this.tokenHashService.hashSessionToken(token);
    const maxAgeSeconds = this.getSessionTtlSeconds();
    const expiresAt = new Date(Date.now() + maxAgeSeconds * 1000);
    const session = await this.repository.createSession({
      ...input,
      tokenHash,
      expiresAt,
    });

    await this.cacheSession(session, maxAgeSeconds * 1000);

    return { token, session, maxAgeSeconds };
  }

  async resolveRequest(request: Request): Promise<SessionRecord | null> {
    const token = this.getSessionTokenFromRequest(request);

    if (!token) {
      return null;
    }

    return this.resolveToken(token);
  }

  async resolveToken(token: string): Promise<SessionRecord | null> {
    const tokenHash = this.tokenHashService.hashSessionToken(token);
    const cacheKey = this.getCacheKey(tokenHash);
    const cached = await this.redisStore.getJson<CachedSession>(cacheKey);

    if (cached) {
      const session = this.fromCachedSession(cached);

      if (!session.revokedAt && session.expiresAt > new Date() && !session.user.isBanned) {
        return session;
      }

      await this.redisStore.delete(cacheKey);
    }

    const session = await this.repository.findActiveSessionByTokenHash(tokenHash, new Date());

    if (!session) {
      return null;
    }

    await this.cacheSession(session, Math.max(session.expiresAt.getTime() - Date.now(), 1_000));
    return session;
  }

  async touchSession(session: SessionRecord, at = new Date()): Promise<SessionRecord> {
    await this.repository.touchSession(session.id, session.userId, at);
    const touchedSession: SessionRecord = {
      ...session,
      lastSeenAt: at,
      user: {
        ...session.user,
        lastSeenAt: at,
      },
    };

    await this.cacheSession(touchedSession, Math.max(touchedSession.expiresAt.getTime() - Date.now(), 1_000));
    return touchedSession;
  }

  async revokeToken(token: string, revokedAt = new Date()): Promise<void> {
    const tokenHash = this.tokenHashService.hashSessionToken(token);
    await this.repository.revokeSessionByTokenHash(tokenHash, revokedAt);
    await this.redisStore.delete(this.getCacheKey(tokenHash));
  }

  async revokeAllForUser(userId: string, revokedAt = new Date()): Promise<void> {
    const tokenHashes = await this.repository.revokeAllUserSessions(userId, revokedAt);
    await Promise.all(tokenHashes.map((tokenHash) => this.redisStore.delete(this.getCacheKey(tokenHash))));
  }

  getSessionCookieName(): string {
    const configured = process.env.SESSION_COOKIE_NAME ?? SESSION_COOKIE_FALLBACK;
    return configured.startsWith("__Host-") ? configured : `__Host-${configured}`;
  }

  getHasSessionCookieName(): string {
    return HAS_SESSION_COOKIE;
  }

  getSessionTokenFromRequest(request: Request): string | undefined {
    const cookieSession = request.cookies?.[this.getSessionCookieName()];

    if (typeof cookieSession === "string" && cookieSession.trim()) {
      return cookieSession.trim();
    }

    const authorization = request.header("authorization");
    const bearerPrefix = "Bearer ";

    if (authorization?.startsWith(bearerPrefix)) {
      const token = authorization.slice(bearerPrefix.length).trim();
      return token || undefined;
    }

    return undefined;
  }

  toPublicUser(user: SessionRecord["user"]): PublicUser {
    return {
      id: user.id,
      role: user.role,
      phoneE164: user.phoneE164,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      mfaEnabled: user.mfaEnabled ?? false,
      isOnline: user.isOnline,
      isBanned: user.isBanned,
      partnerApproval: user.partnerApproval,
      rejectionReason: user.rejectionReason,
      lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
    };
  }

  toRequestMetadata(request: Request): RequestMetadata {
    return {
      ipAddress: request.ip || request.socket.remoteAddress,
      userAgent: request.header("user-agent"),
    };
  }

  private async cacheSession(session: SessionRecord, ttlMs: number): Promise<void> {
    await this.redisStore.setJson(this.getCacheKey(session.tokenHash), this.toCachedSession(session), ttlMs);
  }

  private getCacheKey(tokenHash: string): string {
    return `${SESSION_CACHE_PREFIX}${tokenHash}`;
  }

  private getSessionTtlSeconds(): number {
    const configured = Number(process.env.SESSION_TTL_SECONDS);
    return Number.isFinite(configured) && configured > 0 ? configured : SESSION_TTL_SECONDS;
  }

  private toCachedSession(session: SessionRecord): CachedSession {
    return {
      id: session.id,
      userId: session.userId,
      tokenHash: session.tokenHash,
      expiresAt: session.expiresAt.toISOString(),
      revokedAt: session.revokedAt?.toISOString() ?? null,
      lastSeenAt: session.lastSeenAt?.toISOString() ?? null,
      user: {
        ...session.user,
        lastSeenAt: session.user.lastSeenAt?.toISOString() ?? null,
        createdAt: session.user.createdAt?.toISOString(),
        updatedAt: session.user.updatedAt?.toISOString(),
      },
    };
  }

  private fromCachedSession(session: CachedSession): SessionRecord {
    return {
      ...session,
      expiresAt: new Date(session.expiresAt),
      revokedAt: session.revokedAt ? new Date(session.revokedAt) : null,
      lastSeenAt: session.lastSeenAt ? new Date(session.lastSeenAt) : null,
      user: {
        ...session.user,
        lastSeenAt: session.user.lastSeenAt ? new Date(session.user.lastSeenAt) : null,
        createdAt: session.user.createdAt ? new Date(session.user.createdAt) : undefined,
        updatedAt: session.user.updatedAt ? new Date(session.user.updatedAt) : undefined,
      },
    };
  }
}
