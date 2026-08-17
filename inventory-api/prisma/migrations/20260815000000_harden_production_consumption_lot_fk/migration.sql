-- Migration: harden_production_consumption_lot_fk
-- Enforces lot-bound production consumption detail for raw-material traceability.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "production_consumptions"
    WHERE "lot_id" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot harden production_consumptions.lot_id because NULL lot_id rows already exist';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "production_consumptions" pc
    LEFT JOIN "lots" l ON l."id" = pc."lot_id"
    WHERE l."id" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot harden production_consumptions.lot_id because orphan lot references already exist';
  END IF;
END $$;

ALTER TABLE "production_consumptions"
  ALTER COLUMN "lot_id" SET NOT NULL;

ALTER TABLE "production_consumptions"
  ADD CONSTRAINT "production_consumptions_lot_id_fkey"
    FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "production_consumptions_production_order_id_stage_execution_id_product_id_lot_id_idx"
  ON "production_consumptions"("production_order_id", "stage_execution_id", "product_id", "lot_id");

CREATE INDEX "production_consumptions_lot_id_idx"
  ON "production_consumptions"("lot_id");
