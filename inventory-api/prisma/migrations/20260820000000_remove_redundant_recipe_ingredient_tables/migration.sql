-- Remove redundant ingredient tables.
-- Ingredients are now derived exclusively from recipe_stage_inputs,
-- eliminating DRY violation between version-level BOM and per-stage inputs.

DROP TABLE IF EXISTS "recipe_version_ingredients";
DROP TABLE IF EXISTS "recipe_ingredients";
