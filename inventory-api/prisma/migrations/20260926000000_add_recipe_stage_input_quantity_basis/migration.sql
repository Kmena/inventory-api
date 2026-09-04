-- AlterTable: add nullable inputQuantityBasis to recipe_stage_inputs.
-- NULL means "inherit from RecipeVersion.quantityBasis" (backward-compatible default).
-- Reuses existing enum RecipeQuantityBasis — no new type created.
ALTER TABLE "recipe_stage_inputs"
  ADD COLUMN "input_quantity_basis" "RecipeQuantityBasis";
