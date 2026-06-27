ALTER TYPE "LedgerEntryType" ADD VALUE IF NOT EXISTS 'PROMOTION';
ALTER TYPE "LedgerEntryType" ADD VALUE IF NOT EXISTS 'LOYALTY';

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralCode" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referredById" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_referralCode_key" ON "User"("referralCode");
CREATE INDEX IF NOT EXISTS "User_referralCode_idx" ON "User"("referralCode");

CREATE TABLE IF NOT EXISTS "Favorite" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "storeId" TEXT,
  "menuItemId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Favorite_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Favorite_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Favorite_exactly_one_target_check" CHECK ((("storeId" IS NOT NULL)::int + ("menuItemId" IS NOT NULL)::int) = 1)
);
CREATE UNIQUE INDEX IF NOT EXISTS "Favorite_userId_storeId_key" ON "Favorite"("userId", "storeId");
CREATE UNIQUE INDEX IF NOT EXISTS "Favorite_userId_menuItemId_key" ON "Favorite"("userId", "menuItemId");
CREATE INDEX IF NOT EXISTS "Favorite_userId_createdAt_idx" ON "Favorite"("userId", "createdAt" DESC);

CREATE TABLE IF NOT EXISTS "Referral" (
  "id" TEXT NOT NULL,
  "referrerId" TEXT NOT NULL,
  "refereeId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "referrerCreditedAt" TIMESTAMP(3),
  "refereeCreditedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Referral_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Referral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Referral_refereeId_fkey" FOREIGN KEY ("refereeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Referral_refereeId_key" ON "Referral"("refereeId");
CREATE INDEX IF NOT EXISTS "Referral_referrerId_createdAt_idx" ON "Referral"("referrerId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Referral_code_idx" ON "Referral"("code");

ALTER TABLE "Coupon" ADD COLUMN IF NOT EXISTS "campaignName" TEXT;
ALTER TABLE "Coupon" ADD COLUMN IF NOT EXISTS "campaignTag" TEXT;
ALTER TABLE "Coupon" ADD COLUMN IF NOT EXISTS "firstOrderOnly" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Coupon" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
CREATE INDEX IF NOT EXISTS "Coupon_campaignTag_isActive_idx" ON "Coupon"("campaignTag", "isActive");
CREATE UNIQUE INDEX IF NOT EXISTS "LedgerEntry_paymentId_key" ON "LedgerEntry"("paymentId");
