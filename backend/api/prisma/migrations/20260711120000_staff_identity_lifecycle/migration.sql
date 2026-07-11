CREATE TYPE "StaffAuthTokenPurpose" AS ENUM ('INVITATION', 'PASSWORD_RESET');

ALTER TABLE "User"
  ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- Existing password-login users predate invitations and remain verified.
UPDATE "User"
SET "emailVerifiedAt" = COALESCE("lastLoginAt", "createdAt")
WHERE "passwordHash" IS NOT NULL;

CREATE TABLE "StaffAuthToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "purpose" "StaffAuthTokenPurpose" NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StaffAuthToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffAuthToken_tokenHash_key" ON "StaffAuthToken"("tokenHash");
CREATE INDEX "StaffAuthToken_userId_purpose_usedAt_idx" ON "StaffAuthToken"("userId", "purpose", "usedAt");
CREATE INDEX "StaffAuthToken_expiresAt_usedAt_idx" ON "StaffAuthToken"("expiresAt", "usedAt");

ALTER TABLE "StaffAuthToken"
  ADD CONSTRAINT "StaffAuthToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;