-- Migration: production_stage_rejection_losses
-- Feature: production-stage-rejection-and-reexecution
-- Created: 2026-09-19
--
-- Purpose:
--   1. Add `status` column to production_stage_executions to mark a stage
--      execution as COMPLETED (default, backward-compat) or QA_REJECTED.
--   2. Add `losses_acknowledged` / `losses_acknowledged_at` columns as the
--      gate that the supervisor must clear (even with an empty declaration)
--      before the operator can re-execute a rejected stage.
--   3. Create new table `production_stage_losses` for declarative post-rejection
--      loss registration (no stock movement — audit/traceability only).
--
-- Rollback:
--   DROP TABLE IF EXISTS production_stage_losses;
--   ALTER TABLE production_stage_executions
--     DROP COLUMN IF EXISTS losses_acknowledged_at,
--     DROP COLUMN IF EXISTS losses_acknowledged,
--     DROP COLUMN IF EXISTS status;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Alter production_stage_executions
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE production_stage_executions
  ADD COLUMN status                VARCHAR(30)  NOT NULL DEFAULT 'COMPLETED',
  ADD COLUMN losses_acknowledged   BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN losses_acknowledged_at TIMESTAMPTZ;

COMMENT ON COLUMN production_stage_executions.status IS
  'COMPLETED = ejecución finalizada correctamente. QA_REJECTED = rechazada por inspector QA.';

COMMENT ON COLUMN production_stage_executions.losses_acknowledged IS
  'true cuando el supervisor ha registrado las pérdidas post-rechazo (incluso si son cero). Requerido antes de re-ejecutar la etapa.';

COMMENT ON COLUMN production_stage_executions.losses_acknowledged_at IS
  'Timestamp en que se registró la declaración de pérdidas (incluso declaración de cero).';

-- Index to efficiently find the latest execution for an order+stage (ordered DESC by created_at)
CREATE INDEX production_stage_executions_stage_status_idx
  ON production_stage_executions (production_order_id, recipe_stage_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Create production_stage_losses
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE production_stage_losses (
  id                    BIGSERIAL    PRIMARY KEY,
  company_id            BIGINT       NOT NULL,
  production_order_id   BIGINT       NOT NULL,
  stage_execution_id    BIGINT       NOT NULL,
  product_id            BIGINT       NOT NULL,
  lot_id                BIGINT       NOT NULL,
  quantity              NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  reason_code           VARCHAR(100) NOT NULL,
  note                  TEXT,
  registered_by_user_id BIGINT,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT fk_psl_company
    FOREIGN KEY (company_id)
    REFERENCES companies(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_psl_production_order
    FOREIGN KEY (production_order_id)
    REFERENCES production_orders(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_psl_stage_execution
    FOREIGN KEY (stage_execution_id)
    REFERENCES production_stage_executions(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_psl_product
    FOREIGN KEY (product_id)
    REFERENCES products(id),

  CONSTRAINT fk_psl_lot
    FOREIGN KEY (lot_id)
    REFERENCES lots(id)
);

COMMENT ON TABLE production_stage_losses IS
  'Registro declarativo de materiales perdidos después de un rechazo QA de etapa. No genera movimiento de stock (el stock ya bajó durante el execute).';

CREATE INDEX production_stage_losses_order_idx
  ON production_stage_losses (production_order_id, stage_execution_id);

CREATE INDEX production_stage_losses_lot_idx
  ON production_stage_losses (lot_id);
