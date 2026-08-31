-- Migration: qa_rejection_disposition_and_continuation
-- Feature: qa-rejection-disposition-and-continuation
-- Created: 2025-01-15
--
-- Purpose:
--   1. Add disposition and continuation fields to quality_inspections (nullable, backward compat).
--   2. Create production_recolection_stages table for virtual recolection workflow.
--
-- Rollback:
--   DROP TABLE IF EXISTS production_recolection_stages;
--   ALTER TABLE quality_inspections
--     DROP COLUMN IF EXISTS material_dispositions,
--     DROP COLUMN IF EXISTS continuation_stage_id,
--     DROP COLUMN IF EXISTS continuation_point;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Extend quality_inspections with disposition and continuation fields
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE quality_inspections
  ADD COLUMN continuation_point       VARCHAR(30) NULL,
  ADD COLUMN continuation_stage_id    BIGINT      NULL,
  ADD COLUMN material_dispositions     JSONB       NULL;

COMMENT ON COLUMN quality_inspections.continuation_point IS
  'CURRENT (default) | PRIOR_STAGE — punto desde donde retoma la producción tras rechazo.';
COMMENT ON COLUMN quality_inspections.continuation_stage_id IS
  'recipeStageId hacia donde retrocede la producción cuando continuation_point=PRIOR_STAGE.';
COMMENT ON COLUMN quality_inspections.material_dispositions IS
  'Snapshot de disposiciones declaradas inline: [{productId, lotId, disposition, quantity}]';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Create production_recolection_stages
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE production_recolection_stages (
  id                      BIGSERIAL     PRIMARY KEY,
  company_id              BIGINT        NOT NULL,
  production_order_id     BIGINT        NOT NULL,
  rejected_execution_id   BIGINT        NOT NULL,
  recipe_stage_id         BIGINT        NOT NULL,
  status                  VARCHAR(20)   NOT NULL DEFAULT 'PENDING',
  required_items          JSONB         NOT NULL DEFAULT '[]',
  completed_by_user_id    BIGINT        NULL,
  completed_at            TIMESTAMPTZ   NULL,
  notes                   TEXT          NULL,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT fk_prod_recol_company
    FOREIGN KEY (company_id)
    REFERENCES companies(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_prod_recol_order
    FOREIGN KEY (production_order_id)
    REFERENCES production_orders(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_prod_recol_exec
    FOREIGN KEY (rejected_execution_id)
    REFERENCES production_stage_executions(id)
    ON DELETE CASCADE,

  CONSTRAINT chk_prod_recol_status
    CHECK (status IN ('PENDING', 'COMPLETED')),

  CONSTRAINT uq_prod_recol_exec
    UNIQUE (rejected_execution_id)
);

COMMENT ON TABLE production_recolection_stages IS
  'Etapa virtual de recolección de material creada cuando el inspector rechaza con disposición RECOLLECT. status=PENDING bloquea la re-ejecución hasta que el operador confirma.';

CREATE INDEX production_recolection_stages_order_idx
  ON production_recolection_stages (production_order_id, status);

CREATE INDEX production_recolection_stages_exec_idx
  ON production_recolection_stages (rejected_execution_id);
