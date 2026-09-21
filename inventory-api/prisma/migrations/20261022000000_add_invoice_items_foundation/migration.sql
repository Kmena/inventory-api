-- Migration: add_invoice_items_foundation (MASTER-003 / NPP-TASK-003)
-- Adds the InvoiceItem billing-snapshot foundation required by:
--   * specs/non-physical-products-mvp/data-model.md §1, §4
--   * specs/non-physical-products-mvp/migration.md §2 Migration C
--   * specs/inventori-product-inventory-master-plan/migration-order.md Migration 3
--
-- Strategy:
--   1. Create the InvoiceItemKind enum.
--   2. Create the invoice_items table with the approved column set,
--      snapshot columns, tenant scope (company_id) and foreign keys.
--   3. Create indexes and the unique [invoice_id, order_item_id] constraint
--      that anchors backfill idempotency.
--   4. Backfill historical invoices, once, using ONLY data already present in
--      the database:
--        * Order-derived invoices (orderId IS NOT NULL): one InvoiceItem per
--          OrderItem, snapshotting quantity, unit price and discount from
--          existing OrderItem columns; subtotal computed as
--          quantity * unit_price - total_discount (matches
--          billing-trigger.service.js:calculateInvoiceAmount at the line
--          level); tax fields snapshotted from current Product tax config
--          (tax_category, tax_rate).
--        * Manual/legacy invoices (orderId IS NULL): a single fallback line
--          with description "Factura histórica <number>", quantity 1,
--          unit_price = invoice.amount. lineKind = SERVICE.
--   5. All backfill INSERTs are guarded by the unique
--      [invoice_id, order_item_id] constraint (and NOT EXISTS for the manual
--      fallback which uses NULL order_item_id) so re-running the migration is
--      a no-op.
--
-- Company ownership rule:
--   invoice_items.company_id is derived from the invoice's client.company_id
--   at insert time. No cross-company InvoiceItem can be produced by this
--   migration because the JOIN is anchored on the invoice→client→company
--   chain and no data is invented.
--
-- Idempotency guards:
--   * Enum creation uses pg_type IF NOT EXISTS.
--   * Table creation uses CREATE TABLE IF NOT EXISTS.
--   * Index creation uses CREATE INDEX IF NOT EXISTS.
--   * Unique constraint uses ALTER TABLE ... ADD CONSTRAINT ... IF NOT
--     EXISTS via a DO $$ guard.
--   * Backfill uses INSERT ... ON CONFLICT DO NOTHING and NOT EXISTS.
--
-- Rollback: table can remain unused. New code that depends on it lives in
-- Wave 2 (MASTER-008).

-- 1. InvoiceItemKind enum -------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InvoiceItemKind') THEN
    CREATE TYPE "InvoiceItemKind" AS ENUM ('PHYSICAL_GOOD', 'SERVICE', 'ENTITLEMENT');
  END IF;
END$$;

-- 2. invoice_items table --------------------------------------------------
CREATE TABLE IF NOT EXISTS "invoice_items" (
  "id"                       BIGSERIAL           PRIMARY KEY,
  "invoice_id"               BIGINT              NOT NULL,
  "order_item_id"            BIGINT              NULL,
  "product_id"               BIGINT              NULL,
  "company_id"               BIGINT              NOT NULL,
  "line_kind"                "InvoiceItemKind"   NOT NULL,
  "description_snapshot"     TEXT                NOT NULL,
  "product_code_snapshot"    TEXT                NULL,
  "quantity"                 DECIMAL(14, 3)      NOT NULL,
  "unit_price"               DECIMAL(14, 2)      NOT NULL,
  "discount_percent"         DECIMAL(8, 2)       NOT NULL DEFAULT 0,
  "discount_amount"          DECIMAL(14, 2)      NOT NULL DEFAULT 0,
  "tax_category_snapshot"    TEXT                NULL,
  "tax_rate_snapshot"        DECIMAL(5, 2)       NULL,
  "subtotal"                 DECIMAL(14, 2)      NOT NULL,
  "tax"                      DECIMAL(14, 2)      NOT NULL DEFAULT 0,
  "total"                    DECIMAL(14, 2)      NOT NULL,
  "created_at"               TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Foreign keys ---------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoice_items_invoice_id_fkey'
  ) THEN
    ALTER TABLE "invoice_items"
      ADD CONSTRAINT "invoice_items_invoice_id_fkey"
      FOREIGN KEY ("invoice_id") REFERENCES "invoices" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoice_items_order_item_id_fkey'
  ) THEN
    ALTER TABLE "invoice_items"
      ADD CONSTRAINT "invoice_items_order_item_id_fkey"
      FOREIGN KEY ("order_item_id") REFERENCES "order_items" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoice_items_product_id_fkey'
  ) THEN
    ALTER TABLE "invoice_items"
      ADD CONSTRAINT "invoice_items_product_id_fkey"
      FOREIGN KEY ("product_id") REFERENCES "products" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoice_items_company_id_fkey'
  ) THEN
    ALTER TABLE "invoice_items"
      ADD CONSTRAINT "invoice_items_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "companies" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

-- 4. Unique constraint + indexes ------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoice_items_invoice_order_item_unique'
  ) THEN
    ALTER TABLE "invoice_items"
      ADD CONSTRAINT "invoice_items_invoice_order_item_unique"
      UNIQUE ("invoice_id", "order_item_id");
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS "invoice_items_company_id_invoice_id_idx"
  ON "invoice_items" ("company_id", "invoice_id");

CREATE INDEX IF NOT EXISTS "invoice_items_product_id_idx"
  ON "invoice_items" ("product_id");

-- 5. Historical backfill --------------------------------------------------
-- 5.a. Order-derived invoices -> one InvoiceItem per OrderItem.
-- Guarded by the [invoice_id, order_item_id] unique constraint so re-running
-- the migration produces no duplicates.
--
-- Line kind: forced to PHYSICAL_GOOD for the historical backfill. Historical
-- orders only reference legacy inventory-controlled products (Wave 0 backfilled
-- controls_inventory=TRUE for every existing product). Wave 2 (MASTER-008)
-- will start emitting SERVICE / ENTITLEMENT for new invoices.
INSERT INTO "invoice_items" (
  "invoice_id",
  "order_item_id",
  "product_id",
  "company_id",
  "line_kind",
  "description_snapshot",
  "product_code_snapshot",
  "quantity",
  "unit_price",
  "discount_percent",
  "discount_amount",
  "tax_category_snapshot",
  "tax_rate_snapshot",
  "subtotal",
  "tax",
  "total",
  "created_at"
)
SELECT
  inv."id",
  oi."id",
  p."id",
  c."company_id",
  'PHYSICAL_GOOD'::"InvoiceItemKind",
  COALESCE(p."name", 'Producto'),
  p."code",
  oi."quantity",
  oi."unit_price",
  oi."discount_percent",
  oi."discount_amount",
  p."tax_category",
  p."tax_rate",
  GREATEST(0, (oi."quantity" * oi."unit_price") - COALESCE(oi."total_discount", 0)),
  0,
  GREATEST(0, (oi."quantity" * oi."unit_price") - COALESCE(oi."total_discount", 0)),
  inv."created_at"
FROM "invoices" inv
JOIN "clients"      c  ON c."id"  = inv."client_id"
JOIN "order_items"  oi ON oi."order_id" = inv."order_id"
JOIN "products"     p  ON p."id"  = oi."product_id"
WHERE inv."order_id" IS NOT NULL
ON CONFLICT ON CONSTRAINT "invoice_items_invoice_order_item_unique" DO NOTHING;

-- 5.b. Manual / legacy invoices (no order) -> a single fallback line.
-- Because order_item_id is NULL for these rows, the unique constraint above
-- does not protect against duplicates (PostgreSQL treats NULL as distinct),
-- so we guard with NOT EXISTS on invoice_id.
INSERT INTO "invoice_items" (
  "invoice_id",
  "order_item_id",
  "product_id",
  "company_id",
  "line_kind",
  "description_snapshot",
  "product_code_snapshot",
  "quantity",
  "unit_price",
  "discount_percent",
  "discount_amount",
  "tax_category_snapshot",
  "tax_rate_snapshot",
  "subtotal",
  "tax",
  "total",
  "created_at"
)
SELECT
  inv."id",
  NULL,
  NULL,
  c."company_id",
  'SERVICE'::"InvoiceItemKind",
  'Factura histórica ' || inv."number",
  NULL,
  1,
  inv."amount",
  0,
  0,
  NULL,
  NULL,
  inv."amount",
  0,
  inv."amount",
  inv."created_at"
FROM "invoices" inv
JOIN "clients" c ON c."id" = inv."client_id"
WHERE inv."order_id" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "invoice_items" ii WHERE ii."invoice_id" = inv."id"
  );
