-- Migration: add_production_return_foundation
-- Adds explicit production return/devolucion detail by stage/product/lot.

CREATE TABLE "production_returns" (
  "id" BIGSERIAL NOT NULL,
  "stage_execution_id" BIGINT NOT NULL,
  "production_order_id" BIGINT NOT NULL,
  "warehouse_id" BIGINT NOT NULL,
  "product_id" BIGINT NOT NULL,
  "lot_id" BIGINT NOT NULL,
  "responsible_user_id" BIGINT,
  "quantity" DECIMAL(14,3) NOT NULL,
  "reason_code" TEXT NOT NULL,
  "note" TEXT,
  "movement_group_id" TEXT,
  "returned_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "production_returns_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "production_returns_stage_execution_id_fkey"
    FOREIGN KEY ("stage_execution_id") REFERENCES "production_stage_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "production_returns_production_order_id_fkey"
    FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "production_returns_lot_id_fkey"
    FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "production_returns_production_order_id_warehouse_id_product_id_created_at_idx"
  ON "production_returns"("production_order_id", "warehouse_id", "product_id", "created_at");

CREATE INDEX "production_returns_production_order_id_stage_execution_id_product_id_lot_id_idx"
  ON "production_returns"("production_order_id", "stage_execution_id", "product_id", "lot_id");

CREATE INDEX "production_returns_lot_id_idx"
  ON "production_returns"("lot_id");
