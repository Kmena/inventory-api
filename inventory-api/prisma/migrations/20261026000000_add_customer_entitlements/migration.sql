-- Migration: add_customer_entitlements (MASTER-007 / NPP-TASK-004 part 1)
-- Adds the CustomerEntitlement commercial-lifecycle model required by:
--   * specs/non-physical-products-mvp/data-model.md §1, §3
--   * specs/non-physical-products-mvp/migration.md §2 Migration D
--   * specs/inventori-product-inventory-master-plan/migration-order.md Migration 4
--
-- Strategy:
--   * Create the CustomerEntitlementStatus enum.
--   * Create the customer_entitlements table with the approved column set,
--     snapshot fields, tenant scope (company_id) and foreign keys.
--   * Foreign keys use ON DELETE SET NULL for optional source references
--     (order/invoice/orderItem/invoiceItem) so historical deletes never
--     cascade into entitlement records.
--   * client / product / company use ON DELETE CASCADE — an entitlement
--     cannot exist without its business owner.
--   * previousEntitlementId supports renewal chains and uses SET NULL to
--     avoid orphan cascades.
--   * Unique constraints on (company_id, source_order_item_id) and
--     (company_id, source_invoice_item_id) provide idempotency for
--     order/invoice-derived activation. NULL sources remain distinct in
--     PostgreSQL so manual entitlements (activation_source = 'MANUAL') do
--     not collide.
--   * Indexes cover the "list by client", "list by product", and expiration
--     ordering queries defined in the api-contracts.
--
-- No pre-existing data is backfilled. Historical orders/invoices did not
-- carry entitlement contracts and must not receive synthetic entitlements
-- (specs/non-physical-products-mvp/migration.md §2 Migration D "no
-- entitlement backfill for historical orders").
--
-- Idempotency: pg_type / pg_constraint / pg_indexes guards for enum, table,
-- foreign keys, unique constraints and indexes.

-- 1. Enum ------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CustomerEntitlementStatus') THEN
    CREATE TYPE "CustomerEntitlementStatus" AS ENUM ('ACTIVE', 'CANCELLED');
  END IF;
END$$;

-- 2. Table -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "customer_entitlements" (
  "id"                         BIGSERIAL                     PRIMARY KEY,
  "company_id"                 BIGINT                        NOT NULL,
  "client_id"                  BIGINT                        NOT NULL,
  "product_id"                 BIGINT                        NOT NULL,
  "source_order_id"            BIGINT                        NULL,
  "source_order_item_id"       BIGINT                        NULL,
  "source_invoice_id"          BIGINT                        NULL,
  "source_invoice_item_id"     BIGINT                        NULL,
  "previous_entitlement_id"    BIGINT                        NULL,
  "status"                     "CustomerEntitlementStatus"   NOT NULL DEFAULT 'ACTIVE',
  "entitlement_kind"           "ProductEntitlementKind"      NOT NULL,
  "start_date"                 TIMESTAMP(3)                  NOT NULL,
  "end_date"                   TIMESTAMP(3)                  NULL,
  "activated_at"               TIMESTAMP(3)                  NULL,
  "activated_by_user_id"       BIGINT                        NULL,
  "activation_source"          TEXT                          NOT NULL,
  "manual_activation_reason"   TEXT                          NULL,
  "cancelled_at"               TIMESTAMP(3)                  NULL,
  "cancelled_by_user_id"       BIGINT                        NULL,
  "cancellation_reason"        TEXT                          NULL,
  "price_snapshot"             DECIMAL(14, 2)                NOT NULL,
  "currency_snapshot"          TEXT                          NOT NULL DEFAULT 'CRC',
  "validity_count_snapshot"    INTEGER                       NULL,
  "validity_unit_snapshot"     "ProductValidityUnit"         NULL,
  "billing_interval_snapshot"  "ProductBillingInterval"      NULL,
  "metadata"                   JSONB                         NULL,
  "created_at"                 TIMESTAMP(3)                  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                 TIMESTAMP(3)                  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Foreign keys ----------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_entitlements_company_id_fkey') THEN
    ALTER TABLE "customer_entitlements"
      ADD CONSTRAINT "customer_entitlements_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "companies" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_entitlements_client_id_fkey') THEN
    ALTER TABLE "customer_entitlements"
      ADD CONSTRAINT "customer_entitlements_client_id_fkey"
      FOREIGN KEY ("client_id") REFERENCES "clients" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_entitlements_product_id_fkey') THEN
    ALTER TABLE "customer_entitlements"
      ADD CONSTRAINT "customer_entitlements_product_id_fkey"
      FOREIGN KEY ("product_id") REFERENCES "products" ("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_entitlements_source_order_id_fkey') THEN
    ALTER TABLE "customer_entitlements"
      ADD CONSTRAINT "customer_entitlements_source_order_id_fkey"
      FOREIGN KEY ("source_order_id") REFERENCES "orders" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_entitlements_source_order_item_id_fkey') THEN
    ALTER TABLE "customer_entitlements"
      ADD CONSTRAINT "customer_entitlements_source_order_item_id_fkey"
      FOREIGN KEY ("source_order_item_id") REFERENCES "order_items" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_entitlements_source_invoice_id_fkey') THEN
    ALTER TABLE "customer_entitlements"
      ADD CONSTRAINT "customer_entitlements_source_invoice_id_fkey"
      FOREIGN KEY ("source_invoice_id") REFERENCES "invoices" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_entitlements_source_invoice_item_id_fkey') THEN
    ALTER TABLE "customer_entitlements"
      ADD CONSTRAINT "customer_entitlements_source_invoice_item_id_fkey"
      FOREIGN KEY ("source_invoice_item_id") REFERENCES "invoice_items" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_entitlements_previous_entitlement_id_fkey') THEN
    ALTER TABLE "customer_entitlements"
      ADD CONSTRAINT "customer_entitlements_previous_entitlement_id_fkey"
      FOREIGN KEY ("previous_entitlement_id") REFERENCES "customer_entitlements" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

-- 4. Unique idempotency constraints ---------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_entitlements_source_order_item_unique') THEN
    ALTER TABLE "customer_entitlements"
      ADD CONSTRAINT "customer_entitlements_source_order_item_unique"
      UNIQUE ("company_id", "source_order_item_id");
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_entitlements_source_invoice_item_unique') THEN
    ALTER TABLE "customer_entitlements"
      ADD CONSTRAINT "customer_entitlements_source_invoice_item_unique"
      UNIQUE ("company_id", "source_invoice_item_id");
  END IF;
END$$;

-- 5. Indexes ---------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "customer_entitlements_company_client_status_idx"
  ON "customer_entitlements" ("company_id", "client_id", "status");

CREATE INDEX IF NOT EXISTS "customer_entitlements_company_product_idx"
  ON "customer_entitlements" ("company_id", "product_id");

CREATE INDEX IF NOT EXISTS "customer_entitlements_company_end_date_idx"
  ON "customer_entitlements" ("company_id", "end_date");

CREATE INDEX IF NOT EXISTS "customer_entitlements_previous_entitlement_id_idx"
  ON "customer_entitlements" ("previous_entitlement_id");
