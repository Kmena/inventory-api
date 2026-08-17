CREATE TYPE "FiscalReferenceStatus" AS ENUM ('PENDING', 'SUBMITTED', 'ACCEPTED', 'REJECTED');

CREATE TABLE "fiscal_document_references" (
  "id"                  BIGSERIAL NOT NULL,
  "company_id"          BIGINT NOT NULL,
  "purchase_receipt_id" BIGINT,
  "purchase_order_id"   BIGINT,
  "created_by_user_id"  BIGINT,
  "document_type"       TEXT NOT NULL,
  "status"              "FiscalReferenceStatus" NOT NULL DEFAULT 'PENDING',
  "external_reference"  TEXT,
  "simplified_regime"   BOOLEAN NOT NULL DEFAULT false,
  "metadata"            JSONB,
  "notes"               TEXT,
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fiscal_document_references_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fiscal_document_references_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "fiscal_document_references_purchase_receipt_id_fkey"
    FOREIGN KEY ("purchase_receipt_id") REFERENCES "purchase_receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "fiscal_document_references_purchase_order_id_fkey"
    FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "fiscal_document_references_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "fiscal_document_references_company_id_status_created_at_idx" ON "fiscal_document_references"("company_id", "status", "created_at");
CREATE INDEX "fiscal_document_references_purchase_receipt_id_idx" ON "fiscal_document_references"("purchase_receipt_id");
CREATE INDEX "fiscal_document_references_purchase_order_id_idx" ON "fiscal_document_references"("purchase_order_id");
