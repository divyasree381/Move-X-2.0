-- This field existed in the Prisma schema before the staff lifecycle migration,
-- but it was missing from the migration history. Keep this idempotent for
-- databases that already received the column through an earlier schema sync.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);
