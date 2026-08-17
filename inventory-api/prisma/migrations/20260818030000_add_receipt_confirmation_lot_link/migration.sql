ALTER TABLE "purchase_receipt_items" ADD COLUMN "confirmed_lot_id" BIGINT;

ALTER TABLE "purchase_receipt_items"
  ADD CONSTRAINT "purchase_receipt_items_confirmed_lot_id_fkey"
  FOREIGN KEY ("confirmed_lot_id") REFERENCES "lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "purchase_receipt_items_confirmed_lot_id_idx" ON "purchase_receipt_items"("confirmed_lot_id");
