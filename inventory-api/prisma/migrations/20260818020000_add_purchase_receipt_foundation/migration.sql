CREATE TYPE "PurchaseReceiptStatus" AS ENUM ('DRAFT', 'PENDING_INSPECTION', 'PARTIALLY_ACCEPTED', 'ACCEPTED', 'REJECTED', 'CONFIRMED', 'REVERSED');
CREATE TYPE "ReceiptInspectionResult" AS ENUM ('ACCEPTED', 'PARTIALLY_ACCEPTED', 'REJECTED');

CREATE TABLE "purchase_receipts" (
  "id" BIGSERIAL NOT NULL,
  "company_id" BIGINT NOT NULL,
  "purchase_order_id" BIGINT,
  "supplier_id" BIGINT NOT NULL,
  "warehouse_id" BIGINT NOT NULL,
  "status" "PurchaseReceiptStatus" NOT NULL DEFAULT 'DRAFT',
  "received_at" TIMESTAMP(3),
  "notes" TEXT,
  "evidence" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "purchase_receipts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_receipts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "purchase_receipts_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "purchase_receipts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "purchase_receipts_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "purchase_receipt_items" (
  "id" BIGSERIAL NOT NULL,
  "receipt_id" BIGINT NOT NULL,
  "purchase_order_item_id" BIGINT,
  "product_id" BIGINT NOT NULL,
  "substitute_product_id" BIGINT,
  "requested_quantity" DECIMAL(14,3) NOT NULL,
  "received_quantity" DECIMAL(14,3) NOT NULL,
  "rejected_quantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "lot_number" TEXT,
  "expiration_date" TIMESTAMP(3),
  "unit_cost" DECIMAL(14,2),
  "observations" TEXT,
  CONSTRAINT "purchase_receipt_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_receipt_items_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "purchase_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "purchase_receipt_items_purchase_order_item_id_fkey" FOREIGN KEY ("purchase_order_item_id") REFERENCES "purchase_order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "purchase_receipt_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "purchase_receipt_items_substitute_product_id_fkey" FOREIGN KEY ("substitute_product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "receipt_inspections" (
  "id" BIGSERIAL NOT NULL,
  "receipt_id" BIGINT NOT NULL,
  "receipt_item_id" BIGINT NOT NULL,
  "product_id" BIGINT NOT NULL,
  "inspector_user_id" BIGINT,
  "result" "ReceiptInspectionResult" NOT NULL,
  "quantity_accepted" DECIMAL(14,3) NOT NULL,
  "quantity_rejected" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "observations" TEXT,
  "evidence" JSONB,
  "inspected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "receipt_inspections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "receipt_inspections_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "purchase_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "receipt_inspections_receipt_item_id_fkey" FOREIGN KEY ("receipt_item_id") REFERENCES "purchase_receipt_items"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "receipt_inspections_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "receipt_inspections_inspector_user_id_fkey" FOREIGN KEY ("inspector_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "purchase_receipts_company_id_status_created_at_idx" ON "purchase_receipts"("company_id", "status", "created_at");
CREATE INDEX "purchase_receipt_items_receipt_id_product_id_idx" ON "purchase_receipt_items"("receipt_id", "product_id");
CREATE INDEX "receipt_inspections_receipt_id_receipt_item_id_created_at_idx" ON "receipt_inspections"("receipt_id", "receipt_item_id", "created_at");
