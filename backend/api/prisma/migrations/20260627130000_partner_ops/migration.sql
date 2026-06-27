CREATE TYPE "PartnerShiftStatus" AS ENUM ('SCHEDULED', 'CANCELLED', 'COMPLETED');

CREATE TABLE "PartnerShift" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "status" "PartnerShiftStatus" NOT NULL DEFAULT 'SCHEDULED',
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartnerShift_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PartnerShift_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PartnerShift_window_check" CHECK ("endsAt" > "startsAt")
);
CREATE INDEX "PartnerShift_userId_startsAt_idx" ON "PartnerShift"("userId", "startsAt");
CREATE INDEX "PartnerShift_status_startsAt_idx" ON "PartnerShift"("status", "startsAt");

CREATE TABLE "PartnerOnlineSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "lastHeartbeatAt" TIMESTAMP(3),
  "durationSeconds" INTEGER,
  "source" TEXT,
  CONSTRAINT "PartnerOnlineSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PartnerOnlineSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "PartnerOnlineSession_userId_startedAt_idx" ON "PartnerOnlineSession"("userId", "startedAt");
CREATE INDEX "PartnerOnlineSession_userId_endedAt_idx" ON "PartnerOnlineSession"("userId", "endedAt");
CREATE UNIQUE INDEX "PartnerOnlineSession_userId_open_key" ON "PartnerOnlineSession"("userId") WHERE "endedAt" IS NULL;