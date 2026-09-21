-- Migration: add_location_fields (MASTER-005 / INV-TASK-001 part 2)
-- Adds the location typing fields to the warehouses table required by:
--   * specs/inventory-ux-mvp/data-model.md §1 (Warehouse gains locationType /
--     locationNature)
--   * specs/inventori-product-inventory-master-plan/migration-order.md Migration 6
--
-- Strategy:
--   * Do NOT rename the warehouses table. UI/API adapters may expose
--     `location*` naming while backend physical names remain compatible
--     (see data-model.md §2 "No destructive renames").
--   * Add two additive enum-typed columns.
--   * Backfill using data-model.md §1 mapping:
--       ADMIN_VIRTUAL / COURSES_VIRTUAL / AFFILIATIONS_VIRTUAL  -> OTHER  + VIRTUAL
--       any other warehouseType with is_virtual = TRUE           -> OTHER  + VIRTUAL
--       any other warehouseType with is_virtual = FALSE          -> BODEGA + PHYSICAL
--   * NOT NULL is enforced after backfill.
--   * Legacy warehouseType and is_virtual columns are preserved (§5 backward
--     compatibility).
--
-- Idempotency: information_schema + pg_type guards.

-- 1. Enums ---------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LocationType') THEN
    CREATE TYPE "LocationType" AS ENUM ('BODEGA', 'ALMACEN', 'CEDI', 'OTHER');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LocationNature') THEN
    CREATE TYPE "LocationNature" AS ENUM ('PHYSICAL', 'VIRTUAL');
  END IF;
END$$;

-- 2. Columns (nullable first) ------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'warehouses' AND column_name = 'location_type'
  ) THEN
    ALTER TABLE "warehouses" ADD COLUMN "location_type" "LocationType";
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'warehouses' AND column_name = 'location_nature'
  ) THEN
    ALTER TABLE "warehouses" ADD COLUMN "location_nature" "LocationNature";
  END IF;
END$$;

-- 3. Backfill (§1 mapping) ---------------------------------------------
UPDATE "warehouses"
   SET "location_nature" = 'VIRTUAL'::"LocationNature"
 WHERE "location_nature" IS NULL
   AND (
        "warehouse_type"::text IN ('ADMIN_VIRTUAL', 'COURSES_VIRTUAL', 'AFFILIATIONS_VIRTUAL')
     OR "is_virtual" = TRUE
   );

UPDATE "warehouses"
   SET "location_nature" = 'PHYSICAL'::"LocationNature"
 WHERE "location_nature" IS NULL;

UPDATE "warehouses"
   SET "location_type" = 'OTHER'::"LocationType"
 WHERE "location_type"   IS NULL
   AND "location_nature" = 'VIRTUAL'::"LocationNature";

UPDATE "warehouses"
   SET "location_type" = 'BODEGA'::"LocationType"
 WHERE "location_type"   IS NULL;

-- 4. Enforce defaults + NOT NULL ----------------------------------------
ALTER TABLE "warehouses" ALTER COLUMN "location_type"    SET DEFAULT 'BODEGA';
ALTER TABLE "warehouses" ALTER COLUMN "location_type"    SET NOT NULL;
ALTER TABLE "warehouses" ALTER COLUMN "location_nature"  SET DEFAULT 'PHYSICAL';
ALTER TABLE "warehouses" ALTER COLUMN "location_nature"  SET NOT NULL;
