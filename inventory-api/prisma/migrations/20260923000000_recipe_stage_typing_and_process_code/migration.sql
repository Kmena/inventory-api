-- TASK-001 (qa-rejection-material-reconciliation-amendment)
-- Add recipe stage typing (RECOLLECTION vs PROCESSING) and process code fields.
--
-- stageType defaults to 'PROCESSING' so all existing stages remain valid
-- under the new model without requiring manual re-authoring.
--
-- processCode is nullable at the DB level; the application layer enforces it
-- as required for PROCESSING stages in new/updated recipe versions.
--
-- processLabel is nullable at the DB level; the application layer enforces it
-- as required only when processCode = 'OTHER'.

ALTER TABLE "recipe_stages"
  ADD COLUMN "stage_type"   TEXT NOT NULL DEFAULT 'PROCESSING',
  ADD COLUMN "process_code" TEXT,
  ADD COLUMN "process_label" TEXT;
