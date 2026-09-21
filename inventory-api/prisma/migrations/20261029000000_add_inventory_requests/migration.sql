-- Migration: add_inventory_requests (inventory-requests spec)
-- Adds the InventoryRequest table supporting an admin→warehouse async
-- movement flow (ADJUSTMENT and TRANSFER requests).
--
-- Strategy:
--   * Additive table only — no existing tables are modified.
--   * type and status stored as TEXT (pattern: InventoryOperation).
--   * All FKs are idempotent via DO-blocks.
--   * Indexes created with IF NOT EXISTS.
--   * Permission backfill is idempotent (ON CONFLICT DO NOTHING / DO UPDATE).
--
-- Rollback: DROP TABLE inventory_requests; DELETE the permission row.

-- ── Table ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "inventory_requests" (
  "id"                          BIGSERIAL       PRIMARY KEY,
  "company_id"                  BIGINT          NOT NULL,
  "type"                        TEXT            NOT NULL,
  "status"                      TEXT            NOT NULL DEFAULT 'PENDING',
  "lot_id"                      BIGINT          NOT NULL,
  "product_id"                  BIGINT          NOT NULL,
  "source_warehouse_id"         BIGINT          NOT NULL,
  "destination_warehouse_id"    BIGINT          NULL,
  "quantity"                    DECIMAL(14,3)   NULL,
  "requested_by_user_id"        BIGINT          NOT NULL,
  "requested_at"                TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assigned_to_user_id"         BIGINT          NULL,
  "note"                        TEXT            NULL,
  "operator_note"               TEXT            NULL,
  "completed_at"                TIMESTAMP(3)    NULL,
  "picked_up_at"                TIMESTAMP(3)    NULL,
  "delivered_at"                TIMESTAMP(3)    NULL,
  "result_operation_id"         BIGINT          NULL,
  "cancelled_at"                TIMESTAMP(3)    NULL,
  "cancelled_reason"            TEXT            NULL,
  "created_at"                  TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                  TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── Foreign keys (idempotent) ────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventory_requests_company_id_fkey'
  ) THEN
    ALTER TABLE "inventory_requests"
      ADD CONSTRAINT "inventory_requests_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "companies"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventory_requests_lot_id_fkey'
  ) THEN
    ALTER TABLE "inventory_requests"
      ADD CONSTRAINT "inventory_requests_lot_id_fkey"
      FOREIGN KEY ("lot_id") REFERENCES "lots"("id");
  END IF;
END$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventory_requests_product_id_fkey'
  ) THEN
    ALTER TABLE "inventory_requests"
      ADD CONSTRAINT "inventory_requests_product_id_fkey"
      FOREIGN KEY ("product_id") REFERENCES "products"("id");
  END IF;
END$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventory_requests_source_warehouse_id_fkey'
  ) THEN
    ALTER TABLE "inventory_requests"
      ADD CONSTRAINT "inventory_requests_source_warehouse_id_fkey"
      FOREIGN KEY ("source_warehouse_id") REFERENCES "warehouses"("id");
  END IF;
END$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventory_requests_destination_warehouse_id_fkey'
  ) THEN
    ALTER TABLE "inventory_requests"
      ADD CONSTRAINT "inventory_requests_destination_warehouse_id_fkey"
      FOREIGN KEY ("destination_warehouse_id") REFERENCES "warehouses"("id");
  END IF;
END$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventory_requests_requested_by_user_id_fkey'
  ) THEN
    ALTER TABLE "inventory_requests"
      ADD CONSTRAINT "inventory_requests_requested_by_user_id_fkey"
      FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id")
      ON DELETE SET NULL;
  END IF;
END$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventory_requests_assigned_to_user_id_fkey'
  ) THEN
    ALTER TABLE "inventory_requests"
      ADD CONSTRAINT "inventory_requests_assigned_to_user_id_fkey"
      FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id")
      ON DELETE SET NULL;
  END IF;
END$$;

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "inventory_requests_company_status_created_idx"
  ON "inventory_requests" ("company_id", "status", "created_at");

CREATE INDEX IF NOT EXISTS "inventory_requests_company_type_status_idx"
  ON "inventory_requests" ("company_id", "type", "status");

CREATE INDEX IF NOT EXISTS "inventory_requests_lot_id_idx"
  ON "inventory_requests" ("lot_id");

-- ── Permission backfill ──────────────────────────────────────────────────────

INSERT INTO "permissions" ("code", "module", "action", "description", "is_active", "created_at", "updated_at")
VALUES (
  'inventory.requests.execute',
  'inventory',
  'requests_execute',
  'Ejecutar solicitudes de movimiento de inventario',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id", "is_enabled", "created_at", "updated_at")
SELECT r."id", p."id", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Role" AS r
CROSS JOIN "permissions" AS p
WHERE r."code" IN ('bodega_prueba', 'admin')
  AND p."code" = 'inventory.requests.execute'
ON CONFLICT ("role_id", "permission_id") DO UPDATE
  SET "is_enabled" = true, "updated_at" = CURRENT_TIMESTAMP;
