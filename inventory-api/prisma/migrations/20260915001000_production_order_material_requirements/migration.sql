-- Migration: production_order_material_requirements
-- Adds persisted production-order material requirements for planning/audit.

CREATE TABLE "production_order_material_requirements" (
  "id" BIGSERIAL NOT NULL,
  "company_id" BIGINT NOT NULL,
  "production_order_id" BIGINT NOT NULL,
  "product_id" BIGINT NOT NULL,
  "required_quantity" DECIMAL(14,3) NOT NULL,
  "unit" TEXT NOT NULL,
  "available_at_creation" DECIMAL(14,3),
  "shortage_at_creation" DECIMAL(14,3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "production_order_material_requirements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "production_order_material_requirements_production_order_id_product_id_key"
  ON "production_order_material_requirements" ("production_order_id", "product_id");

CREATE INDEX "production_order_material_requirements_company_id_production_order_id_idx"
  ON "production_order_material_requirements" ("company_id", "production_order_id");

CREATE INDEX "production_order_material_requirements_product_id_idx"
  ON "production_order_material_requirements" ("product_id");

ALTER TABLE "production_order_material_requirements"
  ADD CONSTRAINT "production_order_material_requirements_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "production_order_material_requirements"
  ADD CONSTRAINT "production_order_material_requirements_production_order_id_fkey"
  FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "production_order_material_requirements"
  ADD CONSTRAINT "production_order_material_requirements_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
