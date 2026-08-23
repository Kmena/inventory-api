-- Migration: harden_production_waste_lot_fk
-- Enforces lot-bound production waste detail for raw-material traceability.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "production_wastes"
    WHERE "lot_id" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot harden production_wastes.lot_id because NULL lot_id rows already exist';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "production_wastes" pw
    LEFT JOIN "lots" l ON l."id" = pw."lot_id"
    WHERE l."id" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot harden production_wastes.lot_id because orphan lot references already exist';
  END IF;
END $$;

ALTER TABLE "production_wastes"
  ALTER COLUMN "lot_id" SET NOT NULL;

ALTER TABLE "production_wastes"
  ADD CONSTRAINT "production_wastes_lot_id_fkey"
    FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "production_wastes_production_order_id_stage_execution_id_product_id_lot_id_idx"
  ON "production_wastes"("production_order_id", "stage_execution_id", "product_id", "lot_id");

CREATE INDEX "production_wastes_lot_id_idx"
  ON "production_wastes"("lot_id");
