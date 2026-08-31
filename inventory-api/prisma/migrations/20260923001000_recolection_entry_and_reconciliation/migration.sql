-- TASK-003 (qa-rejection-material-reconciliation-amendment)
-- Add lot-level recolection entry and terminal reconciliation tables.
-- Also expand ProductionRecolectionStage with recoveryType to distinguish
-- legacy virtual recolection from the new replacement recovery flow.
--
-- Existing rows default to VIRTUAL_RECOLECTION, preserving backward compatibility.

-- 1. Expand production_recolection_stages with recoveryType
ALTER TABLE "production_recolection_stages"
  ADD COLUMN "recovery_type" TEXT NOT NULL DEFAULT 'VIRTUAL_RECOLECTION';

-- 2. Create lot-level recolection entry table
CREATE TABLE "production_recolection_entries" (
  "id"                   BIGSERIAL PRIMARY KEY,
  "recolection_stage_id" BIGINT NOT NULL REFERENCES "production_recolection_stages"("id") ON DELETE CASCADE,
  "product_id"           BIGINT NOT NULL REFERENCES "products"("id"),
  "lot_id"               BIGINT NOT NULL REFERENCES "lots"("id"),
  "quantity"             DECIMAL(14,3) NOT NULL,
  "unit"                 TEXT,
  "created_at"           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "production_recolection_entries_stage_idx" ON "production_recolection_entries"("recolection_stage_id");
CREATE INDEX "production_recolection_entries_product_idx" ON "production_recolection_entries"("product_id");
CREATE INDEX "production_recolection_entries_lot_idx" ON "production_recolection_entries"("lot_id");

-- 3. Create terminal reconciliation table
-- outcome: USED | RETURNED | DISCARDED (BR-007, FR-012)
CREATE TABLE "production_recolection_reconciliations" (
  "id"                   BIGSERIAL PRIMARY KEY,
  "recolection_stage_id" BIGINT NOT NULL REFERENCES "production_recolection_stages"("id") ON DELETE CASCADE,
  "product_id"           BIGINT NOT NULL REFERENCES "products"("id"),
  "lot_id"               BIGINT NOT NULL REFERENCES "lots"("id"),
  "quantity"             DECIMAL(14,3) NOT NULL,
  "outcome"              TEXT NOT NULL,
  "notes"                TEXT,
  "reconciled_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "created_at"           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "production_recolection_reconciliations_stage_idx" ON "production_recolection_reconciliations"("recolection_stage_id");
CREATE INDEX "production_recolection_reconciliations_product_idx" ON "production_recolection_reconciliations"("product_id");
CREATE INDEX "production_recolection_reconciliations_lot_idx" ON "production_recolection_reconciliations"("lot_id");
