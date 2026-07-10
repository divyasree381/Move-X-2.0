CREATE TABLE "PartnerVerification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "partnerKind" TEXT NOT NULL,
  "profile" JSONB NOT NULL DEFAULT '{}',
  "address" JSONB NOT NULL DEFAULT '{}',
  "documents" JSONB NOT NULL DEFAULT '{}',
  "settlements" JSONB NOT NULL DEFAULT '{}',
  "status" "PartnerApproval" NOT NULL DEFAULT 'PENDING',
  "rejectionReason" TEXT,
  "submittedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PartnerVerification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PartnerVerification_userId_key" ON "PartnerVerification"("userId");
CREATE INDEX "PartnerVerification_status_submittedAt_idx" ON "PartnerVerification"("status", "submittedAt");
CREATE INDEX "PartnerVerification_partnerKind_status_idx" ON "PartnerVerification"("partnerKind", "status");
CREATE INDEX "PartnerVerification_reviewedById_reviewedAt_idx" ON "PartnerVerification"("reviewedById", "reviewedAt");

ALTER TABLE "PartnerVerification"
  ADD CONSTRAINT "PartnerVerification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
