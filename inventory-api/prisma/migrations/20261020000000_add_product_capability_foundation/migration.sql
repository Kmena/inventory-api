-- Migration: add_product_capability_foundation (MASTER-001 / NPP-TASK-001)
-- Adds the Product capability foundation required by both approved specs:
--   * specs/non-physical-products-mvp/data-model.md §1-§2
--   * specs/inventori-product-inventory-master-plan/migration-order.md Migration 1
--
-- Strategy:
--   1. Create capability enums (ProductNature, ProductCommercialBehavior,
--      ProductEntitlementKind, ProductValidityUnit, ProductBillingInterval).
--   2. Add Product columns as nullable to allow safe backfill on large tables.
--   3. Backfill existing rows to conservative physical/inventory defaults:
--        product_nature = 'GOOD'
--        controls_inventory = TRUE
--        commercial_behavior = 'STANDARD'
--        entitlement_kind = NULL
--        default_validity_count / default_validity_unit / billing_interval = NULL
--   4. Enforce NOT NULL + DEFAULT on the three required columns.
--   5. Add capability indexes.
--
-- Idempotency guards use information_schema and pg_type so the migration can be
-- safely re-run against databases where a prior forward-fix already applied
-- part of the change.
--
-- Legacy compatibility (see specs/non-physical-products-mvp/migration.md §3):
--   * Product.product_type IS NOT MODIFIED. Legacy values FINISHED_PRODUCT,
--     RAW_MATERIAL, PACKAGING, etc. remain intact for history/UI compatibility.
--   * Legacy WarehouseType.COURSES_VIRTUAL / AFFILIATIONS_VIRTUAL are not touched.
--   * No historical stock, lot, movement, order, invoice or payment row is
--     rewritten.

-- 1. Enums -----------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProductNature') THEN
    CREATE TYPE "ProductNature" AS ENUM ('GOOD', 'SERVICE');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProductCommercialBehavior') THEN
    CREATE TYPE "ProductCommercialBehavior" AS ENUM ('STANDARD', 'ENTITLEMENT');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProductEntitlementKind') THEN
    CREATE TYPE "ProductEntitlementKind" AS ENUM (
      'SUBSCRIPTION',
      'MEMBERSHIP',
      'AFFILIATION',
      'COURSE',
      'SERVICE_PERIOD'
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProductValidityUnit') THEN
    CREATE TYPE "ProductValidityUnit" AS ENUM ('DAY', 'MONTH', 'YEAR');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProductBillingInterval') THEN
    CREATE TYPE "ProductBillingInterval" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY');
  END IF;
END$$;

-- 2. Add Product columns as nullable (safe on large tables) ----------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'products' AND column_name = 'product_nature'
  ) THEN
    ALTER TABLE "products" ADD COLUMN "product_nature" "ProductNature";
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'products' AND column_name = 'controls_inventory'
  ) THEN
    ALTER TABLE "products" ADD COLUMN "controls_inventory" BOOLEAN;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'products' AND column_name = 'commercial_behavior'
  ) THEN
    ALTER TABLE "products" ADD COLUMN "commercial_behavior" "ProductCommercialBehavior";
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'products' AND column_name = 'entitlement_kind'
  ) THEN
    ALTER TABLE "products" ADD COLUMN "entitlement_kind" "ProductEntitlementKind";
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'products' AND column_name = 'default_validity_count'
  ) THEN
    ALTER TABLE "products" ADD COLUMN "default_validity_count" INTEGER;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'products' AND column_name = 'default_validity_unit'
  ) THEN
    ALTER TABLE "products" ADD COLUMN "default_validity_unit" "ProductValidityUnit";
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'products' AND column_name = 'billing_interval'
  ) THEN
    ALTER TABLE "products" ADD COLUMN "billing_interval" "ProductBillingInterval";
  END IF;
END$$;

-- 3. Backfill conservative defaults on existing rows -----------------------
-- These preserve current physical inventory behavior for every existing product.
UPDATE "products" SET "product_nature"     = 'GOOD'      WHERE "product_nature"     IS NULL;
UPDATE "products" SET "controls_inventory" = TRUE        WHERE "controls_inventory" IS NULL;
UPDATE "products" SET "commercial_behavior"= 'STANDARD'  WHERE "commercial_behavior" IS NULL;
-- entitlement_kind / default_validity_count / default_validity_unit /
-- billing_interval must remain NULL for existing rows; STANDARD products
-- have no entitlement subtype and no default validity or billing cadence.

-- 4. Enforce NOT NULL + DEFAULT on the three required columns --------------
ALTER TABLE "products" ALTER COLUMN "product_nature"      SET DEFAULT 'GOOD';
ALTER TABLE "products" ALTER COLUMN "product_nature"      SET NOT NULL;
ALTER TABLE "products" ALTER COLUMN "controls_inventory"  SET DEFAULT TRUE;
ALTER TABLE "products" ALTER COLUMN "controls_inventory"  SET NOT NULL;
ALTER TABLE "products" ALTER COLUMN "commercial_behavior" SET DEFAULT 'STANDARD';
ALTER TABLE "products" ALTER COLUMN "commercial_behavior" SET NOT NULL;

-- 5. Capability indexes ----------------------------------------------------
-- These indexes support the future INV-003 / INV-007 / catalog queries that
-- filter products by their inventory boundary and entitlement classification.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname = current_schema()
       AND tablename  = 'products'
       AND indexname  = 'products_company_id_controls_inventory_idx'
  ) THEN
    CREATE INDEX "products_company_id_controls_inventory_idx"
      ON "products" ("company_id", "controls_inventory");
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname = current_schema()
       AND tablename  = 'products'
       AND indexname  = 'products_company_id_commercial_behavior_entitlement_kind_idx'
  ) THEN
    CREATE INDEX "products_company_id_commercial_behavior_entitlement_kind_idx"
      ON "products" ("company_id", "commercial_behavior", "entitlement_kind");
  END IF;
END$$;
