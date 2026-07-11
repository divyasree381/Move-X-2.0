CREATE TYPE "PartnerDocumentType" AS ENUM ('PROFILE_IMAGE', 'LIVE_PHOTO', 'STORE_LICENSE', 'AADHAAR', 'PAN', 'DRIVING_LICENSE', 'VEHICLE_RC', 'VEHICLE_INSURANCE', 'SKILL_CERTIFICATE', 'POLICE_VERIFICATION', 'BANK_PROOF');
CREATE TYPE "PartnerDocumentStatus" AS ENUM ('UPLOADED', 'APPROVED', 'REJECTED', 'SUPERSEDED');

ALTER TABLE "PartnerVerification"
  ADD COLUMN "sensitiveDetailsEncrypted" JSONB,
  ADD COLUMN "sensitiveDetailsMasked" JSONB;

CREATE TABLE "PartnerDocument" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "verificationId" TEXT,
  "documentType" "PartnerDocumentType" NOT NULL,
  "bucket" TEXT NOT NULL,
  "objectKey" TEXT NOT NULL,
  "originalFileName" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "checksumSha256" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "PartnerDocumentStatus" NOT NULL DEFAULT 'UPLOADED',
  "rejectionReason" TEXT,
  "expiresAt" TIMESTAMP(3),
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartnerDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PartnerDocument_objectKey_key" ON "PartnerDocument"("objectKey");
CREATE UNIQUE INDEX "PartnerDocument_userId_documentType_version_key" ON "PartnerDocument"("userId", "documentType", "version");
CREATE INDEX "PartnerDocument_userId_status_uploadedAt_idx" ON "PartnerDocument"("userId", "status", "uploadedAt" DESC);
CREATE INDEX "PartnerDocument_verificationId_documentType_idx" ON "PartnerDocument"("verificationId", "documentType");
CREATE INDEX "PartnerDocument_reviewedById_reviewedAt_idx" ON "PartnerDocument"("reviewedById", "reviewedAt");

ALTER TABLE "PartnerDocument" ADD CONSTRAINT "PartnerDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerDocument" ADD CONSTRAINT "PartnerDocument_verificationId_fkey" FOREIGN KEY ("verificationId") REFERENCES "PartnerVerification"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PartnerDocument" ADD CONSTRAINT "PartnerDocument_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PartnerDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PartnerVerification" ENABLE ROW LEVEL SECURITY;