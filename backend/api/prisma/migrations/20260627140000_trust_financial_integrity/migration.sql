CREATE TYPE "DisputeReferenceType" AS ENUM ('ORDER', 'RIDE', 'COURIER', 'HOME_SERVICE');
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED');
CREATE TYPE "DisputeReason" AS ENUM ('NOT_DELIVERED', 'DAMAGED_OR_INCOMPLETE', 'OVERCHARGED', 'SAFETY_OR_BEHAVIOR', 'CANCELLATION_FEE', 'OTHER');
CREATE TYPE "DisputeResolution" AS ENUM ('REFUND', 'WALLET_CREDIT', 'PARTNER_CREDIT', 'NO_ACTION', 'OTHER');
CREATE TYPE "ReconciliationReportStatus" AS ENUM ('CLEAR', 'HAS_MISMATCHES');

CREATE TABLE "Dispute" (
  "id" TEXT NOT NULL,
  "supportTicketId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "partnerId" TEXT,
  "referenceType" "DisputeReferenceType" NOT NULL,
  "referenceId" TEXT NOT NULL,
  "reason" "DisputeReason" NOT NULL,
  "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
  "resolution" "DisputeResolution",
  "summary" TEXT NOT NULL,
  "customerNote" TEXT,
  "partnerNote" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Dispute_supportTicketId_fkey" FOREIGN KEY ("supportTicketId") REFERENCES "SupportTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Dispute_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Dispute_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "DisputeAction" (
  "id" TEXT NOT NULL,
  "disputeId" TEXT NOT NULL,
  "actorId" TEXT,
  "actorRole" "UserRole",
  "action" TEXT NOT NULL,
  "note" TEXT,
  "statusFrom" "DisputeStatus",
  "statusTo" "DisputeStatus",
  "resolution" "DisputeResolution",
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DisputeAction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DisputeAction_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DisputeAction_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "PaymentReconciliationReport" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'RAZORPAY',
  "status" "ReconciliationReportStatus" NOT NULL,
  "from" TIMESTAMP(3) NOT NULL,
  "to" TIMESTAMP(3) NOT NULL,
  "providerTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "ledgerTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "mismatchCount" INTEGER NOT NULL DEFAULT 0,
  "matchedCount" INTEGER NOT NULL DEFAULT 0,
  "rows" JSONB NOT NULL,
  "mismatches" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentReconciliationReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Dispute_customerId_createdAt_idx" ON "Dispute"("customerId", "createdAt" DESC);
CREATE INDEX "Dispute_partnerId_status_createdAt_idx" ON "Dispute"("partnerId", "status", "createdAt" DESC);
CREATE INDEX "Dispute_referenceType_referenceId_idx" ON "Dispute"("referenceType", "referenceId");
CREATE INDEX "Dispute_status_createdAt_idx" ON "Dispute"("status", "createdAt" DESC);
CREATE INDEX "DisputeAction_disputeId_createdAt_idx" ON "DisputeAction"("disputeId", "createdAt");
CREATE INDEX "DisputeAction_actorId_createdAt_idx" ON "DisputeAction"("actorId", "createdAt" DESC);
CREATE INDEX "PaymentReconciliationReport_provider_createdAt_idx" ON "PaymentReconciliationReport"("provider", "createdAt" DESC);
CREATE INDEX "PaymentReconciliationReport_status_createdAt_idx" ON "PaymentReconciliationReport"("status", "createdAt" DESC);