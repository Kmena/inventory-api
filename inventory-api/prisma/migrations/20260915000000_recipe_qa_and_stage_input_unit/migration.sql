-- Migration: recipe_qa_and_stage_input_unit
-- Adds recipe-stage-input unit guardrails and production execution QA flags.

ALTER TABLE "recipe_stage_inputs"
  ADD CONSTRAINT "recipe_stage_inputs_unit_required_when_product"
  CHECK (
    "product_id" IS NULL
    OR (
      "unit" IS NOT NULL
      AND btrim("unit") <> ''
    )
  );

COMMENT ON COLUMN "recipe_stage_inputs"."quantity" IS
  'Cantidad de insumo por 1 unidad de producto terminado (base unitaria).';

ALTER TABLE "production_stage_executions"
  ADD COLUMN "qa_out_of_tolerance" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "override_justification" TEXT;

CREATE INDEX "production_stage_executions_qa_out_of_tolerance_idx"
  ON "production_stage_executions" ("production_order_id", "qa_out_of_tolerance")
  WHERE "qa_out_of_tolerance" = true;
