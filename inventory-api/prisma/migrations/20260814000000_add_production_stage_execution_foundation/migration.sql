-- Migration: add_production_stage_execution_foundation
-- Adds stage execution persistence plus traceable production consumption and waste records.

CREATE TABLE "production_stage_executions" (
  "id" BIGSERIAL NOT NULL,
  "production_order_id" BIGINT NOT NULL,
  "recipe_stage_id" BIGINT NOT NULL,
  "stage_order" INTEGER NOT NULL,
  "stage_name" TEXT NOT NULL,
  "responsible_user_id" BIGINT,
  "started_at" TIMESTAMP(3) NOT NULL,
  "ended_at" TIMESTAMP(3) NOT NULL,
  "actual_parameters" JSONB,
  "evidence" JSONB,
  "notes" TEXT,
  "movement_group_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "production_stage_executions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "production_consumptions" (
  "id" BIGSERIAL NOT NULL,
  "stage_execution_id" BIGINT NOT NULL,
  "production_order_id" BIGINT NOT NULL,
  "warehouse_id" BIGINT NOT NULL,
  "product_id" BIGINT NOT NULL,
  "lot_id" BIGINT,
  "quantity" DECIMAL(14,3) NOT NULL,
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "production_consumptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "production_wastes" (
  "id" BIGSERIAL NOT NULL,
  "stage_execution_id" BIGINT NOT NULL,
  "production_order_id" BIGINT NOT NULL,
  "warehouse_id" BIGINT NOT NULL,
  "product_id" BIGINT NOT NULL,
  "lot_id" BIGINT,
  "quantity" DECIMAL(14,3) NOT NULL,
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "production_wastes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "production_stage_executions_production_order_id_stage_order_created_at_idx"
  ON "production_stage_executions"("production_order_id", "stage_order", "created_at");
CREATE INDEX "production_stage_executions_recipe_stage_id_idx"
  ON "production_stage_executions"("recipe_stage_id");
CREATE INDEX "production_consumptions_production_order_id_warehouse_id_product_id_created_at_idx"
  ON "production_consumptions"("production_order_id", "warehouse_id", "product_id", "created_at");
CREATE INDEX "production_wastes_production_order_id_warehouse_id_product_id_created_at_idx"
  ON "production_wastes"("production_order_id", "warehouse_id", "product_id", "created_at");

ALTER TABLE "production_stage_executions"
  ADD CONSTRAINT "production_stage_executions_production_order_id_fkey"
    FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "production_stage_executions_recipe_stage_id_fkey"
    FOREIGN KEY ("recipe_stage_id") REFERENCES "recipe_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "production_stage_executions_responsible_user_id_fkey"
    FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "production_consumptions"
  ADD CONSTRAINT "production_consumptions_stage_execution_id_fkey"
    FOREIGN KEY ("stage_execution_id") REFERENCES "production_stage_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "production_consumptions_production_order_id_fkey"
    FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "production_wastes"
  ADD CONSTRAINT "production_wastes_stage_execution_id_fkey"
    FOREIGN KEY ("stage_execution_id") REFERENCES "production_stage_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "production_wastes_production_order_id_fkey"
    FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
