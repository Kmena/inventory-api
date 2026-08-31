CREATE TYPE "ProductPresentationType" AS ENUM ('VOLUME', 'MASS', 'LENGTH', 'COUNT');

CREATE TYPE "ProductNetContentUnit" AS ENUM ('ML', 'L', 'G', 'KG', 'M', 'UN');

CREATE TYPE "RecipeQuantityBasis" AS ENUM ('PER_OUTPUT_KG', 'PER_FINISHED_UNIT');

ALTER TABLE "products"
  ADD COLUMN "presentation_type" "ProductPresentationType",
  ADD COLUMN "net_content_unit" "ProductNetContentUnit";

ALTER TABLE "recipe_versions"
  ADD COLUMN "quantity_basis" "RecipeQuantityBasis" NOT NULL DEFAULT 'PER_OUTPUT_KG';

ALTER TABLE "production_orders"
  ADD COLUMN "planned_output_kg" DECIMAL(14,3);
