-- Migration: add_product_sourcing_foundation
-- Adds additive product sourcing/classification fields, supplier metadata,
-- and allowed-warehouse authorization without mutating historical data.

CREATE TYPE "ProductSourcingMethod" AS ENUM (
  'PRODUCTION_ONLY',
  'PURCHASE_ONLY',
  'PRODUCTION_OR_PURCHASE'
);

CREATE TYPE "ProductInventoryType" AS ENUM (
  'RAW_MATERIAL',
  'PACKAGING',
  'WORK_IN_PROCESS',
  'FINISHED_GOOD'
);

ALTER TABLE "products"
  ADD COLUMN "sku" TEXT,
  ADD COLUMN "barcode" TEXT,
  ADD COLUMN "sourcing_method" "ProductSourcingMethod",
  ADD COLUMN "inventory_type" "ProductInventoryType",
  ADD COLUMN "requires_lot" BOOLEAN,
  ADD COLUMN "requires_expiration" BOOLEAN,
  ADD COLUMN "standard_cost" DECIMAL(14, 2),
  ADD COLUMN "real_cost" DECIMAL(14, 2);

ALTER TABLE "product_suppliers"
  ADD COLUMN "is_preferred" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "supplier_sku" TEXT,
  ADD COLUMN "lead_time_days" INTEGER,
  ADD COLUMN "minimum_order_quantity" DECIMAL(14, 3),
  ADD COLUMN "notes" TEXT;

CREATE TABLE "product_allowed_warehouses" (
  "product_id" BIGINT NOT NULL,
  "warehouse_id" BIGINT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_allowed_warehouses_pkey" PRIMARY KEY ("product_id", "warehouse_id"),
  CONSTRAINT "product_allowed_warehouses_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "product_allowed_warehouses_warehouse_id_fkey"
    FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "products_sourcing_method_idx" ON "products"("sourcing_method");
CREATE INDEX "products_inventory_type_idx" ON "products"("inventory_type");
CREATE INDEX "products_barcode_idx" ON "products"("barcode");
CREATE INDEX "product_allowed_warehouses_warehouse_id_idx" ON "product_allowed_warehouses"("warehouse_id");
