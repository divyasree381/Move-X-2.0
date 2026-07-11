CREATE TYPE "ReviewStatus" AS ENUM ('PUBLISHED', 'HIDDEN', 'REMOVED');

ALTER TABLE "User"
ADD COLUMN "ratingAverage" DECIMAL(3,2) NOT NULL DEFAULT 0,
ADD COLUMN "ratingCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "Review" (
  "id" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "targetUserId" TEXT,
  "storeId" TEXT,
  "menuItemId" TEXT,
  "orderId" TEXT,
  "rideId" TEXT,
  "courierBookingId" TEXT,
  "homeServiceBookingId" TEXT,
  "rating" INTEGER NOT NULL,
  "comment" TEXT,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" "ReviewStatus" NOT NULL DEFAULT 'PUBLISHED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Review_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Review_rating_check" CHECK ("rating" BETWEEN 1 AND 5)
);

CREATE UNIQUE INDEX "Review_authorId_orderId_key" ON "Review"("authorId", "orderId");
CREATE UNIQUE INDEX "Review_authorId_rideId_key" ON "Review"("authorId", "rideId");
CREATE UNIQUE INDEX "Review_authorId_courierBookingId_key" ON "Review"("authorId", "courierBookingId");
CREATE UNIQUE INDEX "Review_authorId_homeServiceBookingId_key" ON "Review"("authorId", "homeServiceBookingId");
CREATE INDEX "Review_storeId_status_createdAt_idx" ON "Review"("storeId", "status", "createdAt" DESC);
CREATE INDEX "Review_menuItemId_status_createdAt_idx" ON "Review"("menuItemId", "status", "createdAt" DESC);
CREATE INDEX "Review_targetUserId_status_createdAt_idx" ON "Review"("targetUserId", "status", "createdAt" DESC);

ALTER TABLE "Review" ADD CONSTRAINT "Review_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "Ride"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_courierBookingId_fkey" FOREIGN KEY ("courierBookingId") REFERENCES "CourierBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_homeServiceBookingId_fkey" FOREIGN KEY ("homeServiceBookingId") REFERENCES "HomeServiceBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WalletTopUp" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "providerPaymentId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WalletTopUp_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WalletTopUp_amount_check" CHECK ("amount" BETWEEN 10 AND 100000)
);
CREATE UNIQUE INDEX "WalletTopUp_providerPaymentId_key" ON "WalletTopUp"("providerPaymentId");
CREATE UNIQUE INDEX "WalletTopUp_idempotencyKey_key" ON "WalletTopUp"("idempotencyKey");
CREATE INDEX "WalletTopUp_userId_createdAt_idx" ON "WalletTopUp"("userId", "createdAt" DESC);
ALTER TABLE "WalletTopUp" ADD CONSTRAINT "WalletTopUp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
