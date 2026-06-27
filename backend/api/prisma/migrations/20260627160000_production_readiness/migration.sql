ALTER TABLE "User"
  ADD COLUMN "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "mfaSecretEncrypted" JSONB;

CREATE INDEX "User_mfaEnabled_role_idx" ON "User"("mfaEnabled", "role");
