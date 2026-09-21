-- Migration: add_inventory_operations (MASTER-005 / INV-TASK-001 part 3)
-- Adds the InventoryOperation grouping model required by:
--   * specs/inventory-ux-mvp/data-model.md §5 (InventoryOperation)
--   * specs/inventory-ux-mvp/architecture.md (grouping/idempotency for
--     Initial Inventory, Adjustment, Transfer)
--   * specs/inventori-product-inventory-master-plan/migration-order.md Migration 7
--
-- Strategy:
--   * Additive table. No StockMovement column changes in this migration:
--     existing sourceType/sourceId columns are re-used by future adapters
--     ("Use StockMovement.sourceType + sourceId to point to operation
--     records", data-model.md §1 InventoryOperation footer).
--   * No historical StockMovement is rewritten.
--   * operation_type and status are stored as TEXT (per data-model.md §5)
--     so future values (e.g. INITIAL_INVENTORY / ADJUSTMENT / TRANSFER,
--     COMPLETED / CANCELLED / PENDING) can be introduced without an enum
--     migration. Application-layer validation is out of scope for this Wave 1
--     foundation.
--   * Unique constraint on (company_id, operation_type, idempotency_key)
--     supports Wave 2/3 idempotency (NULL idempotency_key remains distinct).
--
-- Idempotency: CREATE TABLE IF NOT EXISTS + pg_constraint / pg_indexes
-- guards.

CREATE TABLE IF NOT EXISTS "inventory_operations" (
  "id"                       BIGSERIAL         PRIMARY KEY,
  "company_id"               BIGINT            NOT NULL,
  "operation_type"           TEXT              NOT NULL,
  "idempotency_key"          TEXT              NULL,
  "status"                   TEXT              NOT NULL DEFAULT 'COMPLETED',
  "product_id"               BIGINT            NULL,
  "source_warehouse_id"      BIGINT            NULL,
  "destination_warehouse_id" BIGINT            NULL,
  "movement_group_id"        TEXT              NULL,
  "reason_code"              TEXT              NULL,
  "note"                     TEXT              NULL,
  "metadata"                 JSONB             NULL,
  "created_by_user_id"       BIGINT            NULL,
  "created_at"               TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"               TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventory_operations_company_id_fkey'
  ) THEN
    ALTER TABLE "inventory_operations"
      ADD CONSTRAINT "inventory_operations_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "companies" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'inventory_operations_company_type_idempotency_unique'
  ) THEN
    ALTER TABLE "inventory_operations"
      ADD CONSTRAINT "inventory_operations_company_type_idempotency_unique"
      UNIQUE ("company_id", "operation_type", "idempotency_key");
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS "inventory_operations_company_operation_type_created_at_idx"
  ON "inventory_operations" ("company_id", "operation_type", "created_at");

CREATE INDEX IF NOT EXISTS "inventory_operations_movement_group_id_idx"
  ON "inventory_operations" ("movement_group_id");
