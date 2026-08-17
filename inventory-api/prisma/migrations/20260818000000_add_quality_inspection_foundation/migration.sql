-- Migration: add_quality_inspection_foundation
-- Adds QualityInspectionResult enum and QualityInspection table for stage-level QA.

CREATE TYPE "QualityInspectionResult" AS ENUM ('APPROVED', 'CONDITIONALLY_ACCEPTED', 'REJECTED');

CREATE TABLE "quality_inspections" (
  "id" BIGSERIAL NOT NULL,
  "production_order_id" BIGINT NOT NULL,
  "stage_execution_id" BIGINT NOT NULL,
  "inspector_user_id" BIGINT NOT NULL,
  "lot_id" BIGINT,
  "result" "QualityInspectionResult" NOT NULL,
  "expected_parameters" JSONB,
  "actual_results" JSONB,
  "observations" TEXT,
  "evidence" JSONB,
  "corrective_action" TEXT,
  "inspected_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "quality_inspections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "quality_inspections_production_order_id_fkey"
    FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "quality_inspections_stage_execution_id_fkey"
    FOREIGN KEY ("stage_execution_id") REFERENCES "production_stage_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "quality_inspections_lot_id_fkey"
    FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "quality_inspections_production_order_id_stage_execution_id_created_at_idx"
  ON "quality_inspections"("production_order_id", "stage_execution_id", "created_at");

CREATE INDEX "quality_inspections_lot_id_idx"
  ON "quality_inspections"("lot_id");
