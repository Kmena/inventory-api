-- Migration: add_system_lot_fields (MASTER-005 / INV-TASK-001 part 1)
-- Adds the system-lot classification fields to the lots table required by:
--   * specs/inventory-ux-mvp/data-model.md §1 (System lot classification)
--   * specs/inventory-ux-mvp/domain-model.md (transparent persisted system lots)
--   * specs/inventori-product-inventory-master-plan/migration-order.md Migration 5
--
-- Strategy:
--   * Additive columns only.
--   * is_system_generated defaults to FALSE and backfills FALSE for every
--     existing lot (§4 of data-model.md: "Existing lots default
--     isSystemGenerated=false. No existing business lot is converted to a
--     system lot automatically.").
--   * system_lot_key is nullable; only future auto-generated lots populate it.
--   * Unique constraint [company_id, system_lot_key] anchors deterministic
--     retrieval of the "one system lot per (company, product)" contract from
--     the system-lot policy without impacting historical rows (NULL keys are
--     treated as distinct by PostgreSQL).
--   * Composite index supports FIFO queries filtered by system-generated
--     status.
--
-- No existing lot is rewritten. No stock is recomputed. No reservation, PO
-- receipt or production behavior is altered.
--
-- Idempotency: information_schema / pg_indexes / pg_constraint guards allow
-- safe re-runs.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'lots' AND column_name = 'is_system_generated'
  ) THEN
    ALTER TABLE "lots" ADD COLUMN "is_system_generated" BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'lots' AND column_name = 'system_lot_key'
  ) THEN
    ALTER TABLE "lots" ADD COLUMN "system_lot_key" TEXT NULL;
  END IF;
END$$;

-- Unique constraint on (company_id, system_lot_key). NULLs remain distinct
-- so existing lots without a system key are unaffected.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lots_company_system_lot_key_unique'
  ) THEN
    ALTER TABLE "lots"
      ADD CONSTRAINT "lots_company_system_lot_key_unique"
      UNIQUE ("company_id", "system_lot_key");
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS "lots_company_id_product_id_is_system_generated_idx"
  ON "lots" ("company_id", "product_id", "is_system_generated");
