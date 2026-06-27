CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'RESTAURANT', 'DELIVERY', 'DRIVER', 'SUPPORT', 'FINANCE', 'ADMIN', 'SUPER_ADMIN');
CREATE TYPE "AdminType" AS ENUM ('ADMIN', 'SUPER_ADMIN');
CREATE TYPE "StoreType" AS ENUM ('FOOD', 'GROCERY', 'PHARMACY');
CREATE TYPE "VehicleType" AS ENUM ('BIKE', 'AUTO', 'CAB');
CREATE TYPE "PaymentMethod" AS ENUM ('WALLET', 'CASH', 'ONLINE');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED');
CREATE TYPE "ServiceType" AS ENUM ('FOOD', 'GROCERY', 'PHARMACY', 'RIDE', 'COURIER', 'HOME_SERVICE');
CREATE TYPE "OrderStatus" AS ENUM ('PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'PICKED_UP', 'DELIVERED', 'CANCELLED');
CREATE TYPE "RideStatus" AS ENUM ('REQUESTED', 'ASSIGNED', 'ARRIVED', 'IN_RIDE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "CourierStatus" AS ENUM ('REQUESTED', 'ASSIGNED', 'ARRIVED', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED');
CREATE TYPE "HomeServiceStatus" AS ENUM ('REQUESTED', 'ASSIGNED', 'ARRIVED', 'IN_SERVICE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "PartnerApproval" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "LedgerEntryType" AS ENUM ('CREDIT', 'DEBIT', 'COMMISSION', 'PAYOUT', 'REFUND', 'ADJUSTMENT');
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED');
CREATE TYPE "InvoiceType" AS ENUM ('ORDER', 'RIDE', 'COURIER', 'HOME_SERVICE');
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'VOID');
CREATE TYPE "CouponDiscountType" AS ENUM ('PERCENTAGE', 'FLAT');
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
CREATE TYPE "SupportTicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "NotificationType" AS ENUM ('SYSTEM', 'ORDER', 'RIDE', 'PAYMENT', 'SUPPORT', 'PROMOTION');

CREATE SEQUENCE invoice_number_seq START WITH 100000;

CREATE FUNCTION next_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN 'INV-' || lpad(nextval('invoice_number_seq')::TEXT, 10, '0');
END;
$$;

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "role" "UserRole" NOT NULL,
  "adminType" "AdminType",
  "phoneE164" TEXT,
  "email" TEXT,
  "passwordHash" TEXT,
  "name" TEXT,
  "avatarUrl" TEXT,
  "walletBalanceCached" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "isBanned" BOOLEAN NOT NULL DEFAULT false,
  "isOnline" BOOLEAN NOT NULL DEFAULT false,
  "partnerApproval" "PartnerApproval" NOT NULL DEFAULT 'NONE',
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Address" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "line" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "pincode" TEXT NOT NULL,
  "lat" DECIMAL(10,7) NOT NULL,
  "lng" DECIMAL(10,7) NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Store" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "type" "StoreType" NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "imageUrl" TEXT,
  "licenseUrl" TEXT,
  "ratingAverage" DECIMAL(3,2) NOT NULL DEFAULT 0,
  "ratingCount" INTEGER NOT NULL DEFAULT 0,
  "etaMinutes" INTEGER NOT NULL,
  "minOrder" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "deliveryRadiusKm" DECIMAL(6,2) NOT NULL DEFAULT 0,
  "lat" DECIMAL(10,7) NOT NULL,
  "lng" DECIMAL(10,7) NOT NULL,
  "location" geography(Point,4326),
  "isOpen" BOOLEAN NOT NULL DEFAULT false,
  "approval" "PartnerApproval" NOT NULL DEFAULT 'PENDING',
  "rejectionReason" TEXT,
  "bankAccount" JSONB,
  "openingHours" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MenuItem" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "section" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "price" DECIMAL(12,2) NOT NULL,
  "imageUrl" TEXT,
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "available" BOOLEAN NOT NULL DEFAULT true,
  "stock" INTEGER NOT NULL DEFAULT -1,
  "customizations" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Order" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "deliveryPartnerId" TEXT,
  "serviceType" "ServiceType" NOT NULL,
  "items" JSONB NOT NULL,
  "status" "OrderStatus" NOT NULL DEFAULT 'PLACED',
  "timeline" JSONB NOT NULL DEFAULT '[]',
  "address" JSONB NOT NULL,
  "paymentMethod" "PaymentMethod" NOT NULL,
  "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "razorpayOrderId" TEXT,
  "razorpayPaymentId" TEXT,
  "razorpaySignature" TEXT,
  "subtotal" DECIMAL(12,2) NOT NULL,
  "deliveryFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "taxes" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(12,2) NOT NULL,
  "couponCode" TEXT,
  "prepTimeMinutes" INTEGER,
  "pickupOtpHash" TEXT,
  "deliveryOtpHash" TEXT,
  "storeLocation" JSONB NOT NULL,
  "rated" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Ride" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "driverId" TEXT,
  "vehicleType" "VehicleType" NOT NULL,
  "pickup" JSONB NOT NULL,
  "drop" JSONB NOT NULL,
  "status" "RideStatus" NOT NULL DEFAULT 'REQUESTED',
  "estimatedFare" DECIMAL(12,2) NOT NULL,
  "finalFare" DECIMAL(12,2),
  "distanceKm" DECIMAL(8,2),
  "durationMinutes" INTEGER,
  "surgeMultiplier" DECIMAL(5,2) NOT NULL DEFAULT 1,
  "startOtpHash" TEXT,
  "paymentMethod" "PaymentMethod" NOT NULL,
  "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "rated" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Ride_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourierBooking" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "deliveryPartnerId" TEXT,
  "pickup" JSONB NOT NULL,
  "drop" JSONB NOT NULL,
  "status" "CourierStatus" NOT NULL DEFAULT 'REQUESTED',
  "packageDescription" TEXT NOT NULL,
  "packageWeightKg" DECIMAL(8,2),
  "estimatedFare" DECIMAL(12,2) NOT NULL,
  "finalFare" DECIMAL(12,2),
  "distanceKm" DECIMAL(8,2),
  "pickupOtpHash" TEXT,
  "deliveryOtpHash" TEXT,
  "paymentMethod" "PaymentMethod" NOT NULL,
  "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "rated" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CourierBooking_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HomeServiceBooking" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "professionalId" TEXT,
  "serviceCategory" TEXT NOT NULL,
  "serviceDescription" TEXT NOT NULL,
  "address" JSONB NOT NULL,
  "scheduledFor" TIMESTAMP(3),
  "status" "HomeServiceStatus" NOT NULL DEFAULT 'REQUESTED',
  "estimatedFare" DECIMAL(12,2) NOT NULL,
  "finalFare" DECIMAL(12,2),
  "durationMinutes" INTEGER,
  "startOtpHash" TEXT,
  "paymentMethod" "PaymentMethod" NOT NULL,
  "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "rated" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HomeServiceBooking_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LedgerEntry" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "userRole" "UserRole" NOT NULL,
  "type" "LedgerEntryType" NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "description" TEXT NOT NULL,
  "paymentMethod" "PaymentMethod",
  "orderId" TEXT,
  "rideId" TEXT,
  "isSettled" BOOLEAN NOT NULL DEFAULT false,
  "paymentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Payout" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "userRole" "UserRole" NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
  "bankAccountName" TEXT NOT NULL,
  "bankAccountNumber" TEXT NOT NULL,
  "bankIfsc" TEXT NOT NULL,
  "reference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Invoice" (
  "id" TEXT NOT NULL,
  "invoiceNumber" TEXT NOT NULL DEFAULT next_invoice_number(),
  "customerId" TEXT NOT NULL,
  "recipient" JSONB NOT NULL,
  "type" "InvoiceType" NOT NULL,
  "referenceId" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "taxBreakdown" JSONB NOT NULL DEFAULT '{}',
  "status" "InvoiceStatus" NOT NULL DEFAULT 'ISSUED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Coupon" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "serviceType" "ServiceType",
  "discountType" "CouponDiscountType" NOT NULL,
  "discountValue" DECIMAL(12,2) NOT NULL,
  "maxDiscount" DECIMAL(12,2),
  "minOrderValue" DECIMAL(12,2),
  "startsAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "usageLimit" INTEGER,
  "usageCount" INTEGER NOT NULL DEFAULT 0,
  "perUserLimit" INTEGER,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupportTicket" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "assignedToId" TEXT,
  "subject" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "SupportTicketPriority" NOT NULL DEFAULT 'MEDIUM',
  "referenceType" TEXT,
  "referenceId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL DEFAULT 'SYSTEM',
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "payload" JSONB,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "actorId" TEXT,
  "actorRole" "UserRole",
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "metadata" JSONB,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SystemConfig" (
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "description" TEXT,
  "isSecret" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "OutboxEvent" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_phoneE164_role_key" ON "User"("phoneE164", "role") WHERE "phoneE164" IS NOT NULL;
CREATE UNIQUE INDEX "User_email_key" ON "User"("email") WHERE "email" IS NOT NULL;
CREATE UNIQUE INDEX "LedgerEntry_paymentId_key" ON "LedgerEntry"("paymentId") WHERE "paymentId" IS NOT NULL;
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_partnerApproval_idx" ON "User"("partnerApproval");
CREATE INDEX "Address_userId_idx" ON "Address"("userId");
CREATE INDEX "Store_ownerId_idx" ON "Store"("ownerId");
CREATE INDEX "Store_type_approval_isOpen_idx" ON "Store"("type", "approval", "isOpen");
CREATE INDEX "Store_location_gist_idx" ON "Store" USING GIST ("location");
CREATE INDEX "MenuItem_storeId_available_idx" ON "MenuItem"("storeId", "available");
CREATE INDEX "Order_customerId_createdAt_idx" ON "Order"("customerId", "createdAt" DESC);
CREATE INDEX "Order_storeId_status_idx" ON "Order"("storeId", "status");
CREATE INDEX "Order_deliveryPartnerId_status_createdAt_idx" ON "Order"("deliveryPartnerId", "status", "createdAt" DESC);
CREATE INDEX "Ride_customerId_createdAt_idx" ON "Ride"("customerId", "createdAt" DESC);
CREATE INDEX "Ride_driverId_status_createdAt_idx" ON "Ride"("driverId", "status", "createdAt" DESC);
CREATE INDEX "Ride_status_vehicleType_createdAt_idx" ON "Ride"("status", "vehicleType", "createdAt" DESC);
CREATE INDEX "CourierBooking_customerId_createdAt_idx" ON "CourierBooking"("customerId", "createdAt" DESC);
CREATE INDEX "CourierBooking_deliveryPartnerId_status_createdAt_idx" ON "CourierBooking"("deliveryPartnerId", "status", "createdAt" DESC);
CREATE INDEX "CourierBooking_status_createdAt_idx" ON "CourierBooking"("status", "createdAt" DESC);
CREATE INDEX "HomeServiceBooking_customerId_createdAt_idx" ON "HomeServiceBooking"("customerId", "createdAt" DESC);
CREATE INDEX "HomeServiceBooking_professionalId_status_createdAt_idx" ON "HomeServiceBooking"("professionalId", "status", "createdAt" DESC);
CREATE INDEX "HomeServiceBooking_status_createdAt_idx" ON "HomeServiceBooking"("status", "createdAt" DESC);
CREATE INDEX "LedgerEntry_userId_isSettled_type_idx" ON "LedgerEntry"("userId", "isSettled", "type");
CREATE INDEX "LedgerEntry_orderId_idx" ON "LedgerEntry"("orderId");
CREATE INDEX "LedgerEntry_rideId_idx" ON "LedgerEntry"("rideId");
CREATE INDEX "Payout_userId_status_createdAt_idx" ON "Payout"("userId", "status", "createdAt" DESC);
CREATE INDEX "Invoice_customerId_createdAt_idx" ON "Invoice"("customerId", "createdAt" DESC);
CREATE INDEX "Invoice_type_referenceId_idx" ON "Invoice"("type", "referenceId");
CREATE INDEX "Coupon_serviceType_isActive_idx" ON "Coupon"("serviceType", "isActive");
CREATE INDEX "Coupon_expiresAt_idx" ON "Coupon"("expiresAt");
CREATE INDEX "SupportTicket_userId_createdAt_idx" ON "SupportTicket"("userId", "createdAt" DESC);
CREATE INDEX "SupportTicket_assignedToId_status_idx" ON "SupportTicket"("assignedToId", "status");
CREATE INDEX "SupportTicket_status_priority_createdAt_idx" ON "SupportTicket"("status", "priority", "createdAt" DESC);
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt" DESC);
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt" DESC);
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt" DESC);
CREATE INDEX "OutboxEvent_processedAt_createdAt_idx" ON "OutboxEvent"("processedAt", "createdAt");
CREATE INDEX "OutboxEvent_type_createdAt_idx" ON "OutboxEvent"("type", "createdAt");

ALTER TABLE "Address" ADD CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Store" ADD CONSTRAINT "Store_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_deliveryPartnerId_fkey" FOREIGN KEY ("deliveryPartnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Ride" ADD CONSTRAINT "Ride_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Ride" ADD CONSTRAINT "Ride_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CourierBooking" ADD CONSTRAINT "CourierBooking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CourierBooking" ADD CONSTRAINT "CourierBooking_deliveryPartnerId_fkey" FOREIGN KEY ("deliveryPartnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HomeServiceBooking" ADD CONSTRAINT "HomeServiceBooking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HomeServiceBooking" ADD CONSTRAINT "HomeServiceBooking_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "Ride"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
