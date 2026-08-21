-- Migration: add_production_consumption_tolerance
-- Adds per-company configurable consumption tolerance for production stage execution.
-- Decision DEC-002: tolerancia de sobre-consumo persistida en companies con default 5.00%.
-- The field replaces the hardcoded CONSUMPTION_TOLERANCE_PERCENT = 0.05 in
-- production-stage-validation.service.js.

ALTER TABLE "companies"
  ADD COLUMN "production_consumption_tolerance_percent" DECIMAL(5, 2) NOT NULL DEFAULT 5.00;

COMMENT ON COLUMN "companies"."production_consumption_tolerance_percent" IS
  'Porcentaje de tolerancia de sobre-consumo de materias primas en etapas de producción. '
  'Valor por defecto: 5.00%. Reemplaza la constante hardcodeada CONSUMPTION_TOLERANCE_PERCENT.';
