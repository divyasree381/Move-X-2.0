CREATE TABLE "HomeServiceCatalogItem" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "price" DECIMAL(12,2) NOT NULL,
  "durationMinutes" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HomeServiceCatalogItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HomeServiceCatalogItem_code_key" ON "HomeServiceCatalogItem"("code");
CREATE INDEX "HomeServiceCatalogItem_category_isActive_sortOrder_idx" ON "HomeServiceCatalogItem"("category", "isActive", "sortOrder");
CREATE INDEX "HomeServiceCatalogItem_isActive_sortOrder_idx" ON "HomeServiceCatalogItem"("isActive", "sortOrder");