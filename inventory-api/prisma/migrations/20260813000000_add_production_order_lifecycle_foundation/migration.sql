-- Migration: add_production_order_lifecycle_foundation
-- Replaces sales-order status reuse with a production-specific lifecycle and frozen recipe snapshot fields.

CREATE TYPE "ProductionOrderStatus" AS ENUM (
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'IN_PROGRESS',
  'COMPLETED',
  'QA_HOLD',
  'CANCELLED'
);

ALTER TABLE "production_orders"
  ADD COLUMN "product_id" BIGINT,
  ADD COLUMN "recipe_version_id" BIGINT,
  ADD COLUMN "origin_warehouse_id" BIGINT,
  ADD COLUMN "destination_warehouse_id" BIGINT,
  ADD COLUMN "responsible_user_id" BIGINT,
  ADD COLUMN "production_lot_code" TEXT,
  ADD COLUMN "planned_date" TIMESTAMP(3),
  ADD COLUMN "production_date" TIMESTAMP(3),
  ADD COLUMN "expiration_date" TIMESTAMP(3),
  ADD COLUMN "submitted_at" TIMESTAMP(3),
  ADD COLUMN "approved_at" TIMESTAMP(3),
  ADD COLUMN "started_at" TIMESTAMP(3),
  ADD COLUMN "cancelled_at" TIMESTAMP(3),
  ADD COLUMN "override_justification" TEXT,
  ADD COLUMN "recipe_version_snapshot" JSONB;

ALTER TABLE "production_orders"
  ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "production_orders"
  ALTER COLUMN "status" TYPE "ProductionOrderStatus"
  USING (
    CASE "status"::text
      WHEN 'IN_PRODUCTION' THEN 'IN_PROGRESS'
      WHEN 'DELIVERED' THEN 'COMPLETED'
      ELSE "status"::text
    END
  )::"ProductionOrderStatus";

ALTER TABLE "production_orders"
  ALTER COLUMN "status" SET DEFAULT 'DRAFT';

ALTER TABLE "production_orders"
  ADD CONSTRAINT "production_orders_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "production_orders_recipe_version_id_fkey"
    FOREIGN KEY ("recipe_version_id") REFERENCES "recipe_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "production_orders_origin_warehouse_id_fkey"
    FOREIGN KEY ("origin_warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "production_orders_destination_warehouse_id_fkey"
    FOREIGN KEY ("destination_warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "production_orders_responsible_user_id_fkey"
    FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "production_orders_company_id_status_planned_date_idx"
  ON "production_orders"("company_id", "status", "planned_date");
CREATE INDEX "production_orders_company_id_product_id_created_at_idx"
  ON "production_orders"("company_id", "product_id", "created_at");
