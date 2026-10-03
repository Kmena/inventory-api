-- Migration: receiver_fiscal_readiness_wave1
-- spec: inventori-receiver-fiscal-readiness v2.0.2  (Wave 1)
--
-- Wave 1 data model foundations for receiver fiscal readiness.
-- All changes are ADDITIVE and BACKWARD-COMPATIBLE.
-- No existing rows are modified. No data backfill performed.
--
-- Changes:
--   1. client_economic_activities — verified economic activities per ClientLegalEntity
--   2. Verification columns on client_legal_entities (nullable, safe defaults)
--   3. order_fiscal_approvals — immutable fiscal approval decision per Order
--
-- Rollback (manual):
--   DROP TABLE order_fiscal_approvals;
--   ALTER TABLE client_legal_entities
--     DROP COLUMN IF EXISTS verification_status,
--     DROP COLUMN IF EXISTS last_verified_at,
--     DROP COLUMN IF EXISTS taxpayer_name;
--   DROP TABLE client_economic_activities;

-- ── 1. client_economic_activities ────────────────────────────────────────────
--
-- Stores the verified economic activities returned by Hacienda /fe/ae for a
-- given ClientLegalEntity. Updated by Wave 2+ verification service via upsert.
-- No rows exist after this migration — backfill is intentionally withheld.
-- The @@unique([client_legal_entity_id, code]) prevents duplicate activity codes
-- per entity and enables idempotent upserts in future waves.

CREATE TABLE IF NOT EXISTS "client_economic_activities" (
  "id"                    BIGSERIAL     PRIMARY KEY,
  "company_id"            BIGINT        NOT NULL,
  "client_legal_entity_id" BIGINT       NOT NULL,
  "code"                  TEXT          NOT NULL,
  "description"           TEXT          NULL,
  "hacienda_status"       TEXT          NULL,
  "hacienda_type"         TEXT          NULL,
  "is_currently_returned" BOOLEAN       NOT NULL DEFAULT true,
  "verified_at"           TIMESTAMP(3)  NOT NULL,
  "created_at"            TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"            TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Unique: one record per (entity, code) — enables idempotent upsert
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'client_economic_activities_entity_code_unique'
  ) THEN
    ALTER TABLE "client_economic_activities"
      ADD CONSTRAINT "client_economic_activities_entity_code_unique"
      UNIQUE ("client_legal_entity_id", "code");
  END IF;
END$$;

-- FK: company (CASCADE — activities are company-scoped)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'client_economic_activities_company_id_fkey'
  ) THEN
    ALTER TABLE "client_economic_activities"
      ADD CONSTRAINT "client_economic_activities_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "companies" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

-- FK: client_legal_entity (CASCADE — activities are owned by the entity)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'client_economic_activities_client_legal_entity_id_fkey'
  ) THEN
    ALTER TABLE "client_economic_activities"
      ADD CONSTRAINT "client_economic_activities_client_legal_entity_id_fkey"
      FOREIGN KEY ("client_legal_entity_id") REFERENCES "client_legal_entities" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

-- Index: company-scoped activity lookups
CREATE INDEX IF NOT EXISTS "client_economic_activities_company_entity_idx"
  ON "client_economic_activities" ("company_id", "client_legal_entity_id");

-- ── 2. client_legal_entities — verification columns ──────────────────────────
--
-- Three new nullable columns added to existing table.
-- Existing rows receive NULL which is treated as UNVERIFIED in service logic.
-- verification_status gets a DEFAULT of 'UNVERIFIED' for new inserts only.
-- Existing rows with NULL are intentionally NOT backfilled to UNVERIFIED
-- because NULL and 'UNVERIFIED' are semantically equivalent at the service layer.
-- No existing rows are changed.

ALTER TABLE "client_legal_entities"
  ADD COLUMN IF NOT EXISTS "verification_status" TEXT NOT NULL DEFAULT 'UNVERIFIED',
  ADD COLUMN IF NOT EXISTS "last_verified_at"    TIMESTAMP(3) NULL,
  ADD COLUMN IF NOT EXISTS "taxpayer_name"        TEXT NULL;
-- PostgreSQL 11+ constant-DEFAULT optimization: existing rows observe
-- verification_status = 'UNVERIFIED' immediately (no table rewrite performed).
-- SQL-visible semantics: SELECT verification_status FROM client_legal_entities
-- returns 'UNVERIFIED' for every pre-existing row — NOT NULL.

-- ── 3. order_fiscal_approvals ─────────────────────────────────────────────────
--
-- Immutable record created atomically with Order approval when fiscal billing
-- is enabled and the receiver has verified economic activities (Wave 3+).
-- Presence of a record = new-flow fiscal order.
-- Absence = legacy/pre-feature order OR billing-disabled order.
-- orderId UNIQUE enforces at most one fiscal approval per Order.
-- No updatedAt column — this record is intentionally immutable after creation.

CREATE TABLE IF NOT EXISTS "order_fiscal_approvals" (
  "id"                               BIGSERIAL     PRIMARY KEY,
  "company_id"                       BIGINT        NOT NULL,
  "order_id"                         BIGINT        NOT NULL,
  "client_legal_entity_id"           BIGINT        NOT NULL,
  "receiver_economic_activity_code"  TEXT          NULL,
  "confirmed_by_id"                  BIGINT        NULL,
  "created_at"                       TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Unique: at most one fiscal approval per Order (DB-enforced 1:0..1 constraint)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_fiscal_approvals_order_id_key'
  ) THEN
    ALTER TABLE "order_fiscal_approvals"
      ADD CONSTRAINT "order_fiscal_approvals_order_id_key"
      UNIQUE ("order_id");
  END IF;
END$$;

-- FK: company (CASCADE)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_fiscal_approvals_company_id_fkey'
  ) THEN
    ALTER TABLE "order_fiscal_approvals"
      ADD CONSTRAINT "order_fiscal_approvals_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "companies" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

-- FK: order (CASCADE — fiscal approval cannot outlive its order)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_fiscal_approvals_order_id_fkey'
  ) THEN
    ALTER TABLE "order_fiscal_approvals"
      ADD CONSTRAINT "order_fiscal_approvals_order_id_fkey"
      FOREIGN KEY ("order_id") REFERENCES "orders" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

-- FK: client_legal_entity (RESTRICT — fiscal approval must not be orphaned by entity deletion)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_fiscal_approvals_client_legal_entity_id_fkey'
  ) THEN
    ALTER TABLE "order_fiscal_approvals"
      ADD CONSTRAINT "order_fiscal_approvals_client_legal_entity_id_fkey"
      FOREIGN KEY ("client_legal_entity_id") REFERENCES "client_legal_entities" ("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END$$;

-- FK: confirmed_by (SET NULL — user deletion must not destroy fiscal approval records)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_fiscal_approvals_confirmed_by_id_fkey'
  ) THEN
    ALTER TABLE "order_fiscal_approvals"
      ADD CONSTRAINT "order_fiscal_approvals_confirmed_by_id_fkey"
      FOREIGN KEY ("confirmed_by_id") REFERENCES "users" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

-- Index: company-scoped lookups by order
CREATE INDEX IF NOT EXISTS "order_fiscal_approvals_company_order_idx"
  ON "order_fiscal_approvals" ("company_id", "order_id");
