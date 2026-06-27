import { strict as assert } from "node:assert";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import type { App } from "supertest/types";

import { AppModule } from "../src/app.module";
import { IdentityRepository } from "../src/modules/identity/identity.repository";
import type { CreateSessionInput, IdentityUser, SessionRecord } from "../src/modules/identity/identity.types";
import type { OtpLoginRole, UserRoleValue } from "../src/modules/identity/constants";
import { RedisStoreService } from "../src/infrastructure/redis/redis-store.service";
import { SMS_PROVIDER, type SendOtpInput, type SendSmsInput, type SmsProvider } from "../src/infrastructure/sms/sms-provider";
import { PasswordService } from "../src/modules/identity/security/password.service";
import { setupApp } from "../src/setup-app";

type MemoryRecord = {
  value: string;
  expiresAt?: number;
};

class TestRedisStoreService {
  private readonly memoryStore = new Map<string, MemoryRecord>();

  async getJson<T>(key: string): Promise<T | null> {
    const value = this.getMemoryValue(key);
    return value ? (JSON.parse(value) as T) : null;
  }

  async setJson(key: string, value: unknown, ttlMs: number): Promise<void> {
    this.memoryStore.set(key, { value: JSON.stringify(value), expiresAt: Date.now() + ttlMs });
  }

  async delete(key: string): Promise<void> {
    this.memoryStore.delete(key);
  }

  async increment(key: string, ttlMs: number): Promise<number> {
    const now = Date.now();
    const existing = this.memoryStore.get(key);
    const count = existing && (!existing.expiresAt || existing.expiresAt > now) ? Number(existing.value) + 1 : 1;
    this.memoryStore.set(key, { value: String(count), expiresAt: now + ttlMs });
    return count;
  }


  async writeGeoWithHeartbeat(input: {
    geoKey: string;
    heartbeatKey: string;
    member: string;
    lng: number;
    lat: number;
    ttlMs: number;
    payload: unknown;
  }): Promise<void> {
    this.memoryStore.set(`${input.geoKey}:${input.member}`, {
      value: JSON.stringify({ lng: input.lng, lat: input.lat, member: input.member }),
      expiresAt: Date.now() + input.ttlMs,
    });
    this.memoryStore.set(input.heartbeatKey, {
      value: JSON.stringify(input.payload),
      expiresAt: Date.now() + input.ttlMs,
    });
  }

  dumpMemoryForTesting(): Record<string, string> {
    const now = Date.now();
    const snapshot: Record<string, string> = {};

    for (const [key, record] of this.memoryStore.entries()) {
      if (!record.expiresAt || record.expiresAt > now) {
        snapshot[key] = record.value;
      }
    }

    return snapshot;
  }

  expireMemoryKeyForTesting(key: string): void {
    const record = this.memoryStore.get(key);

    if (record) {
      record.expiresAt = Date.now() - 1;
    }
  }

  private getMemoryValue(key: string): string | null {
    const record = this.memoryStore.get(key);

    if (!record) {
      return null;
    }

    if (record.expiresAt && record.expiresAt <= Date.now()) {
      this.memoryStore.delete(key);
      return null;
    }

    return record.value;
  }
}

class TestSmsProvider implements SmsProvider {
  readonly sentMessages: SendOtpInput[] = [];

  async sendOtp(input: SendOtpInput): Promise<void> {
    this.sentMessages.push(input);
  }

  async sendSms(input: SendSmsInput): Promise<void> {
    void input;
    // Not used by identity OTP tests.
  }
}

type TestUser = IdentityUser & { passwordHash?: string | null };

type TestAddress = {
  id: string;
  userId: string;
  line: string;
  city: string;
  state: string;
  pincode: string;
  lat: number;
  lng: number;
  isDefault: boolean;
};

class InMemoryIdentityRepository {
  readonly users: TestUser[] = [];
  readonly sessions: SessionRecord[] = [];
  readonly addresses: TestAddress[] = [];
  private userSequence = 0;
  private sessionSequence = 0;
  private addressSequence = 0;

  async findUserById(userId: string): Promise<IdentityUser | null> {
    return this.users.find((user) => user.id === userId) ?? null;
  }

  async findUserByEmail(email: string): Promise<IdentityUser | null> {
    return this.users.find((user) => user.email?.toLowerCase() === email.toLowerCase()) ?? null;
  }

  async findUserPasswordByEmail(email: string): Promise<(IdentityUser & { passwordHash?: string | null }) | null> {
    return this.users.find((user) => user.email?.toLowerCase() === email.toLowerCase()) ?? null;
  }

  async hasSuperAdmin(): Promise<boolean> {
    return this.users.some((user) => user.role === "SUPER_ADMIN");
  }

  async findUserByPhoneAndRole(phoneE164: string, role: OtpLoginRole): Promise<IdentityUser | null> {
    return this.users.find((user) => user.phoneE164 === phoneE164 && user.role === role) ?? null;
  }

  async createUserWithPhone(phoneE164: string, role: OtpLoginRole): Promise<IdentityUser> {
    const user: IdentityUser = {
      id: `test-user-${++this.userSequence}`,
      role,
      phoneE164,
      email: null,
      name: null,
      avatarUrl: null,
      isBanned: false,
      isOnline: false,
      partnerApproval: "NONE",
      lastSeenAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.users.push(user);
    return user;
  }

  async updateUserLastSeen(userId: string, lastSeenAt: Date): Promise<void> {
    const user = this.users.find((candidate) => candidate.id === userId);

    if (user) {
      user.lastSeenAt = lastSeenAt;
    }
  }

  async createSession(input: CreateSessionInput): Promise<SessionRecord> {
    const user = this.requireUser(input.userId);
    const session: SessionRecord = {
      id: `test-session-${++this.sessionSequence}`,
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      revokedAt: null,
      lastSeenAt: null,
      user,
    };

    this.sessions.push(session);
    return session;
  }

  async findActiveSessionByTokenHash(tokenHash: string, now: Date): Promise<SessionRecord | null> {
    const session = this.sessions.find((candidate) => candidate.tokenHash === tokenHash);

    if (!session || session.revokedAt || session.expiresAt <= now || session.user.isBanned) {
      return null;
    }

    return {
      ...session,
      user: this.requireUser(session.userId),
    };
  }

  async touchSession(sessionId: string, userId: string, lastSeenAt: Date): Promise<void> {
    const session = this.sessions.find((candidate) => candidate.id === sessionId);

    if (session) {
      session.lastSeenAt = lastSeenAt;
    }

    await this.updateUserLastSeen(userId, lastSeenAt);
  }

  async revokeSessionByTokenHash(tokenHash: string, revokedAt: Date): Promise<void> {
    for (const session of this.sessions) {
      if (session.tokenHash === tokenHash && !session.revokedAt) {
        session.revokedAt = revokedAt;
      }
    }
  }

  async revokeAllUserSessions(userId: string, revokedAt: Date): Promise<string[]> {
    const tokenHashes: string[] = [];

    for (const session of this.sessions) {
      if (session.userId === userId && !session.revokedAt && session.expiresAt > revokedAt) {
        tokenHashes.push(session.tokenHash);
        session.revokedAt = revokedAt;
      }
    }

    return tokenHashes;
  }


  async createPasswordUser(input: {
    role: UserRoleValue;
    email: string;
    passwordHash: string;
    phoneE164?: string;
    name?: string;
  }): Promise<IdentityUser> {
    const user: TestUser = {
      id: `test-user-${++this.userSequence}`,
      role: input.role,
      phoneE164: input.phoneE164,
      email: input.email.toLowerCase(),
      passwordHash: input.passwordHash,
      name: input.name ?? null,
      avatarUrl: null,
      isBanned: false,
      isOnline: false,
      partnerApproval: "NONE",
      lastSeenAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.users.push(user);
    return user;
  }

  async updateUserProfile(userId: string, input: { name?: string; email?: string; avatarUrl?: string }): Promise<IdentityUser> {
    const user = this.requireUser(userId);
    user.name = input.name ?? user.name;
    user.email = input.email?.toLowerCase() ?? user.email;
    user.avatarUrl = input.avatarUrl ?? user.avatarUrl;
    return user;
  }

  async submitPartnerProfile(userId: string, input: { name?: string; avatarUrl?: string }): Promise<IdentityUser> {
    const user = this.requireUser(userId);
    user.name = input.name ?? user.name;
    user.avatarUrl = input.avatarUrl ?? user.avatarUrl;
    user.partnerApproval = "PENDING";
    user.rejectionReason = null;
    return user;
  }

  async setPartnerApproval(userId: string, approval: "APPROVED" | "REJECTED", reason?: string): Promise<IdentityUser> {
    const user = this.requireUser(userId);
    user.partnerApproval = approval;
    user.rejectionReason = approval === "REJECTED" ? reason ?? "Rejected" : null;
    return user;
  }

  async setUserBanned(userId: string, isBanned: boolean, reason?: string): Promise<IdentityUser> {
    const user = this.requireUser(userId);
    user.isBanned = isBanned;
    user.rejectionReason = isBanned ? reason ?? null : null;
    user.isOnline = isBanned ? false : user.isOnline;
    return user;
  }

  async setUserOnline(userId: string, isOnline: boolean): Promise<IdentityUser> {
    const user = this.requireUser(userId);
    user.isOnline = isOnline;
    return user;
  }

  async listUsers(input: { cursor?: string; limit: number; role?: UserRoleValue }) {
    const filtered = this.users
      .filter((user) => !input.role || user.role === input.role)
      .sort((left, right) => left.id.localeCompare(right.id));
    const start = input.cursor ? filtered.findIndex((user) => user.id === input.cursor) + 1 : 0;
    const page = filtered.slice(start, start + input.limit + 1);

    return {
      items: page.slice(0, input.limit),
      nextCursor: page.length > input.limit ? page[input.limit]?.id : null,
    };
  }

  async listPendingPartners(limit: number, cursor?: string) {
    const filtered = this.users
      .filter((user) => ["RESTAURANT", "DELIVERY", "DRIVER"].includes(user.role) && user.partnerApproval === "PENDING")
      .sort((left, right) => left.id.localeCompare(right.id));
    const start = cursor ? filtered.findIndex((user) => user.id === cursor) + 1 : 0;
    const page = filtered.slice(start, start + limit + 1);

    return {
      items: page.slice(0, limit),
      nextCursor: page.length > limit ? page[limit]?.id : null,
    };
  }

  async listAddresses(userId: string): Promise<TestAddress[]> {
    return this.addresses.filter((address) => address.userId === userId);
  }

  async createAddress(userId: string, input: Omit<TestAddress, "id" | "userId">): Promise<TestAddress> {
    if (input.isDefault) {
      for (const address of this.addresses) {
        if (address.userId === userId) {
          address.isDefault = false;
        }
      }
    }

    const address = { ...input, id: `test-address-${++this.addressSequence}`, userId };
    this.addresses.push(address);
    return address;
  }

  async updateAddress(userId: string, addressId: string, input: Partial<Omit<TestAddress, "id" | "userId">>): Promise<TestAddress> {
    const address = this.addresses.find((candidate) => candidate.id === addressId && candidate.userId === userId);

    if (!address) {
      throw new Error("Address not found");
    }

    if (input.isDefault) {
      for (const existing of this.addresses) {
        if (existing.userId === userId) {
          existing.isDefault = false;
        }
      }
    }

    Object.assign(address, input);
    return address;
  }

  async deleteAddress(userId: string, addressId: string): Promise<void> {
    const index = this.addresses.findIndex((candidate) => candidate.id === addressId && candidate.userId === userId);

    if (index === -1) {
      throw new Error("Address not found");
    }

    this.addresses.splice(index, 1);
  }

  dumpForTesting() {
    return {
      users: this.users,
      sessions: this.sessions.map((session) => ({
        id: session.id,
        userId: session.userId,
        tokenHash: session.tokenHash,
        expiresAt: session.expiresAt.toISOString(),
        revokedAt: session.revokedAt?.toISOString() ?? null,
      })),
    };
  }

  private requireUser(userId: string): IdentityUser {
    const user = this.users.find((candidate) => candidate.id === userId);

    if (!user) {
      throw new Error(`Missing test user ${userId}`);
    }

    return user;
  }
}

type TestContext = {
  app: INestApplication;
  repository: InMemoryIdentityRepository;
  redisStore: TestRedisStoreService;
};

async function createApp(): Promise<TestContext> {
  process.env.NODE_ENV = "test";
  process.env.AUTH_HASH_SECRET = "test-auth-hash-secret-with-enough-entropy";
  process.env.SESSION_COOKIE_NAME = "__Host-movex_session";
  process.env.OTP_REQUEST_PHONE_LIMIT = "20";
  process.env.OTP_REQUEST_IP_LIMIT = "100";
  process.env.OTP_VERIFY_PHONE_LIMIT = "6";
  process.env.OTP_VERIFY_IP_LIMIT = "100";
  process.env.ADMIN_BOOTSTRAP_TOKEN = "setup-token-for-tests";

  const repository = new InMemoryIdentityRepository();
  const redisStore = new TestRedisStoreService();
  const smsProvider = new TestSmsProvider();

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(IdentityRepository)
    .useValue(repository)
    .overrideProvider(RedisStoreService)
    .useValue(redisStore)
    .overrideProvider(SMS_PROVIDER)
    .useValue(smsProvider)
    .compile();

  const app = moduleRef.createNestApplication({ rawBody: true });
  setupApp(app);
  await app.init();

  return { app, repository, redisStore };
}

function requestOtp(server: App, phone: string, role: OtpLoginRole = "CUSTOMER") {
  return request(server).post("/api/v1/auth/otp/request").send({ phone, role }).expect(201);
}

function verifyOtp(server: App, phone: string, code: string, role: OtpLoginRole = "CUSTOMER") {
  return request(server).post("/api/v1/auth/otp/verify").send({ phone, role, code });
}

function getDevCode(response: request.Response): string {
  const code = response.body.data?.devCode;
  assert.equal(typeof code, "string");
  assert.match(code, /^\d{6}$/);
  return code;
}

function getCookieValue(response: request.Response, cookieName: string): string {
  const setCookie = response.headers["set-cookie"];
  assert(Array.isArray(setCookie));
  const cookie = setCookie.find((value) => value.startsWith(`${cookieName}=`));
  assert(cookie, `Missing ${cookieName} cookie`);
  return cookie.split(";", 1)[0].slice(cookieName.length + 1);
}

function assertStorageDoesNotContain(context: TestContext, secret: string): void {
  const storage = JSON.stringify({
    repository: context.repository.dumpForTesting(),
    redis: context.redisStore.dumpMemoryForTesting(),
  });

  assert(!storage.includes(secret), `Secret leaked into persistence: ${secret}`);
}

async function captureStdout(run: () => Promise<void>): Promise<string> {
  const originalWrite = process.stdout.write;
  let output = "";

  process.stdout.write = ((chunk: string | Uint8Array, encodingOrCallback?: BufferEncoding | ((error?: Error | null) => void), callback?: (error?: Error | null) => void): boolean => {
    output += chunk.toString();

    if (typeof encodingOrCallback === "function") {
      encodingOrCallback();
    }

    if (callback) {
      callback();
    }

    return true;
  }) as typeof process.stdout.write;

  try {
    await run();
  } finally {
    process.stdout.write = originalWrite;
  }

  return output;
}

async function main(): Promise<void> {
  const context = await createApp();
  const server = context.app.getHttpServer();
  const sessionCookieName = "__Host-movex_session";

  try {
    const firstRequest = await requestOtp(server, "99000 00101");
    assert.equal(firstRequest.body.data.message, "If the OTP can be sent, it will arrive shortly.");
    const firstCode = getDevCode(firstRequest);
    assertStorageDoesNotContain(context, firstCode);

    let verifyResponse!: request.Response;
    const verifyLogs = await captureStdout(async () => {
      verifyResponse = await verifyOtp(server, "9900000101", firstCode).expect(201);
    });
    const sessionToken = getCookieValue(verifyResponse, sessionCookieName);
    assert.equal(verifyResponse.body.data.user.phoneE164, "+919900000101");
    assert.equal(context.repository.users.length, 1);
    assertStorageDoesNotContain(context, firstCode);
    assertStorageDoesNotContain(context, sessionToken);
    assert(!verifyLogs.includes(firstCode), "OTP leaked into request logs");
    assert(!verifyLogs.includes(sessionToken), "Session token leaked into request logs");

    await verifyOtp(server, "9900000101", firstCode).expect(401);

    const secondRequest = await requestOtp(server, "+91 99000 00101");
    const secondCode = getDevCode(secondRequest);
    await verifyOtp(server, "919900000101", secondCode).expect(201);
    assert.equal(context.repository.users.length, 1);

    let meResponse!: request.Response;
    const meLogs = await captureStdout(async () => {
      meResponse = await request(server)
        .get("/api/v1/auth/me")
        .set("Cookie", `${sessionCookieName}=${sessionToken}`)
        .expect(200);
    });
    assert.equal(meResponse.body.data.user.phoneE164, "+919900000101");
    assert(context.repository.users[0]?.lastSeenAt instanceof Date);
    assert(!meLogs.includes(sessionToken), "Session cookie leaked into request logs");

    await request(server)
      .post("/api/v1/auth/logout")
      .set("Origin", "http://localhost:3000")
      .set("Cookie", `${sessionCookieName}=${sessionToken}`)
      .expect(201);
    await request(server).get("/api/v1/auth/me").set("Cookie", `${sessionCookieName}=${sessionToken}`).expect(401);

    const expiredRequest = await requestOtp(server, "9900000102");
    const expiredCode = getDevCode(expiredRequest);
    const expiredOtpKey = Object.keys(context.redisStore.dumpMemoryForTesting()).find((key) => key.startsWith("identity:otp:latest:") && key.includes("+919900000102"));
    assert(expiredOtpKey);
    context.redisStore.expireMemoryKeyForTesting(expiredOtpKey);
    await verifyOtp(server, "9900000102", expiredCode).expect(401);

    const limitedRequest = await requestOtp(server, "9900000103");
    const limitedCode = getDevCode(limitedRequest);
    const wrongCode = limitedCode === "000000" ? "111111" : "000000";

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await verifyOtp(server, "9900000103", wrongCode).expect(401);
    }

    await verifyOtp(server, "9900000103", limitedCode).expect(401);

    for (let attempt = 0; attempt < 6; attempt += 1) {
      await verifyOtp(server, "9900000199", "123456").expect(401);
    }

    const rateLimitedResponse = await verifyOtp(server, "9900000199", "123456").expect(429);
    assert.equal(rateLimitedResponse.body.errorCode, "RATE_LIMITED");
    const permissionsResponse = await request(server).get("/api/v1/auth/permissions").expect(200);
    assert(Array.isArray(permissionsResponse.body.data.SUPER_ADMIN));
    assert(permissionsResponse.body.data.SUPER_ADMIN.includes("identity:staff:register"));

    const bootstrapResponse = await request(server)
      .post("/api/v1/auth/admin/bootstrap")
      .send({
        setupToken: "setup-token-for-tests",
        email: "root@movex.test",
        password: "RootPassword123",
        name: "Root Admin",
      })
      .expect(201);
    const superAdminToken = getCookieValue(bootstrapResponse, sessionCookieName);
    assert.equal(bootstrapResponse.body.data.user.role, "SUPER_ADMIN");
    assertStorageDoesNotContain(context, "RootPassword123");

    await request(server)
      .post("/api/v1/auth/admin/bootstrap")
      .send({ setupToken: "setup-token-for-tests", email: "second@movex.test", password: "RootPassword123" })
      .expect(409);

    const passwordService = context.app.get(PasswordService);
    const customerPasswordHash = await passwordService.hashPassword("CustomerPassword123");
    await context.repository.createPasswordUser({
      role: "CUSTOMER",
      email: "customer-password@movex.test",
      passwordHash: customerPasswordHash,
    });
    await request(server)
      .post("/api/v1/auth/admin/login")
      .send({ email: "customer-password@movex.test", password: "CustomerPassword123" })
      .expect(401);

    const adminRegisterResponse = await request(server)
      .post("/api/v1/auth/admin/register")
      .set("Origin", "http://localhost:3000")
      .set("Cookie", `${sessionCookieName}=${superAdminToken}`)
      .send({ email: "ops@movex.test", password: "OpsPassword123", role: "ADMIN", name: "Ops Admin" })
      .expect(201);
    const adminUserId = adminRegisterResponse.body.data.user.id;
    assert.equal(adminRegisterResponse.body.data.user.role, "ADMIN");
    assertStorageDoesNotContain(context, "OpsPassword123");

    const adminLoginResponse = await request(server)
      .post("/api/v1/auth/admin/login")
      .send({ email: "ops@movex.test", password: "OpsPassword123" })
      .expect(201);
    const adminToken = getCookieValue(adminLoginResponse, sessionCookieName);
    await request(server).get("/api/v1/auth/me").set("Cookie", `${sessionCookieName}=${adminToken}`).expect(200);

    await request(server)
      .post(`/api/v1/users/admin/${adminUserId}/ban`)
      .set("Origin", "http://localhost:3000")
      .set("Cookie", `${sessionCookieName}=${superAdminToken}`)
      .send({ reason: "policy" })
      .expect(201);
    await request(server).get("/api/v1/auth/me").set("Cookie", `${sessionCookieName}=${adminToken}`).expect(401);
    await request(server)
      .post("/api/v1/auth/admin/login")
      .send({ email: "ops@movex.test", password: "OpsPassword123" })
      .expect(401);

    const partnerOtpRequest = await requestOtp(server, "9900000201", "DRIVER");
    const partnerCode = getDevCode(partnerOtpRequest);
    const partnerVerifyResponse = await verifyOtp(server, "9900000201", partnerCode, "DRIVER").expect(201);
    const partnerToken = getCookieValue(partnerVerifyResponse, sessionCookieName);
    const partnerId = partnerVerifyResponse.body.data.user.id;

    await request(server)
      .patch("/api/v1/users/me/partner-profile")
      .set("Origin", "http://localhost:3000")
      .set("Cookie", `${sessionCookieName}=${partnerToken}`)
      .send({ name: "Driver Partner" })
      .expect(200);

    await request(server)
      .post("/api/v1/users/me/online")
      .set("Origin", "http://localhost:3000")
      .set("Cookie", `${sessionCookieName}=${partnerToken}`)
      .send({ isOnline: true })
      .expect(403);

    const pendingPartnersResponse = await request(server)
      .get("/api/v1/users/admin/partners/pending")
      .set("Cookie", `${sessionCookieName}=${superAdminToken}`)
      .expect(200);
    assert(pendingPartnersResponse.body.data.items.some((user: { id: string }) => user.id === partnerId));

    await request(server)
      .post(`/api/v1/users/admin/partners/${partnerId}/review`)
      .set("Origin", "http://localhost:3000")
      .set("Cookie", `${sessionCookieName}=${superAdminToken}`)
      .send({ approval: "APPROVED" })
      .expect(201);
  } finally {
    await context.app.close();
  }
}

void main();