-- Migration: add_recipe_versioning_foundation
-- Adds immutable recipe-version foundations without removing legacy recipe tables.

CREATE TYPE "RecipeVersionStatus" AS ENUM (
  'DRAFT',
  'APPROVED'
);

CREATE TABLE "recipe_versions" (
  "id" BIGSERIAL NOT NULL,
  "company_id" BIGINT NOT NULL,
  "recipe_id" BIGINT NOT NULL,
  "version_number" INTEGER NOT NULL,
  "status" "RecipeVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "effective_from" TIMESTAMP(3),
  "effective_to" TIMESTAMP(3),
  "expected_yield" DECIMAL(14, 3),
  "expected_waste" DECIMAL(14, 3),
  "yield_tolerance_percent" DECIMAL(5, 2),
  "waste_tolerance_percent" DECIMAL(5, 2),
  "instructions" TEXT,
  "notes" TEXT,
  "created_by_user_id" BIGINT,
  "approved_by_user_id" BIGINT,
  "approved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "recipe_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "recipe_versions_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "recipe_versions_recipe_id_fkey"
    FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "recipe_versions_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "recipe_versions_approved_by_user_id_fkey"
    FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "recipe_version_ingredients" (
  "id" BIGSERIAL NOT NULL,
  "recipe_version_id" BIGINT NOT NULL,
  "product_id" BIGINT NOT NULL,
  "quantity" DECIMAL(14, 3) NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "recipe_version_ingredients_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "recipe_version_ingredients_recipe_version_id_fkey"
    FOREIGN KEY ("recipe_version_id") REFERENCES "recipe_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "recipe_version_ingredients_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "recipe_stages" (
  "id" BIGSERIAL NOT NULL,
  "recipe_version_id" BIGINT NOT NULL,
  "stage_order" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "instructions" TEXT,
  "responsible_role_code" TEXT,
  "responsible_user_id" BIGINT,
  "expected_parameters" JSONB,
  "parameter_tolerances" JSONB,
  "required_evidence" JSONB,
  "qa_mandatory" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "recipe_stages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "recipe_stages_recipe_version_id_fkey"
    FOREIGN KEY ("recipe_version_id") REFERENCES "recipe_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "recipe_stage_inputs" (
  "id" BIGSERIAL NOT NULL,
  "recipe_stage_id" BIGINT NOT NULL,
  "product_id" BIGINT,
  "name" TEXT NOT NULL,
  "quantity" DECIMAL(14, 3),
  "unit" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "recipe_stage_inputs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "recipe_stage_inputs_recipe_stage_id_fkey"
    FOREIGN KEY ("recipe_stage_id") REFERENCES "recipe_stages"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "recipe_stage_inputs_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "recipe_versions_recipe_id_version_number_key" ON "recipe_versions"("recipe_id", "version_number");
CREATE INDEX "recipe_versions_company_id_recipe_id_status_idx" ON "recipe_versions"("company_id", "recipe_id", "status");
CREATE UNIQUE INDEX "recipe_version_ingredients_recipe_version_id_product_id_sort_order_key" ON "recipe_version_ingredients"("recipe_version_id", "product_id", "sort_order");
CREATE INDEX "recipe_version_ingredients_product_id_idx" ON "recipe_version_ingredients"("product_id");
CREATE UNIQUE INDEX "recipe_stages_recipe_version_id_stage_order_key" ON "recipe_stages"("recipe_version_id", "stage_order");
CREATE UNIQUE INDEX "recipe_stage_inputs_recipe_stage_id_sort_order_key" ON "recipe_stage_inputs"("recipe_stage_id", "sort_order");
CREATE INDEX "recipe_stage_inputs_product_id_idx" ON "recipe_stage_inputs"("product_id");
