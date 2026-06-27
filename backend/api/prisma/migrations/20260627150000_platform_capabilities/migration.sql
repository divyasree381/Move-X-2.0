CREATE TABLE "AnalyticsDailyProjection" (
  "id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "scope" TEXT NOT NULL DEFAULT 'ALL',
  "ordersCount" INTEGER NOT NULL DEFAULT 0,
  "ridesCount" INTEGER NOT NULL DEFAULT 0,
  "courierCount" INTEGER NOT NULL DEFAULT 0,
  "homeServiceCount" INTEGER NOT NULL DEFAULT 0,
  "gmv" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "activePartners" INTEGER NOT NULL DEFAULT 0,
  "refreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnalyticsDailyProjection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnalyticsDailyProjection_date_scope_key" ON "AnalyticsDailyProjection"("date", "scope");
CREATE INDEX "AnalyticsDailyProjection_scope_date_idx" ON "AnalyticsDailyProjection"("scope", "date");

CREATE TABLE "FeatureFlag" (
  "key" TEXT NOT NULL,
  "description" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "rollout" JSONB NOT NULL DEFAULT '{}',
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "FeatureFlag_enabled_updatedAt_idx" ON "FeatureFlag"("enabled", "updatedAt");

ALTER TABLE "FeatureFlag"
  ADD CONSTRAINT "FeatureFlag_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
