-- Procurement foundation: purchase requests, supplier quotations, supplier selections, purchase orders.

CREATE TYPE "PurchaseRequestStatus" AS ENUM ('OPEN', 'CLOSED', 'CANCELLED');
CREATE TYPE "SupplierQuotationStatus" AS ENUM ('SUBMITTED', 'SELECTED', 'REJECTED');
CREATE TYPE "ProcurementApprovalStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'ISSUED', 'CANCELLED');

CREATE TABLE "purchase_requests" (
  "id" BIGSERIAL NOT NULL,
  "company_id" BIGINT NOT NULL,
  "requested_by_user_id" BIGINT,
  "title" TEXT NOT NULL,
  "notes" TEXT,
  "status" "PurchaseRequestStatus" NOT NULL DEFAULT 'OPEN',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "purchase_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_requests_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "purchase_requests_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "purchase_request_items" (
  "id" BIGSERIAL NOT NULL,
  "purchase_request_id" BIGINT NOT NULL,
  "product_id" BIGINT NOT NULL,
  "quantity" DECIMAL(14,3) NOT NULL,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "purchase_request_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_request_items_purchase_request_id_fkey" FOREIGN KEY ("purchase_request_id") REFERENCES "purchase_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "purchase_request_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "supplier_quotations" (
  "id" BIGSERIAL NOT NULL,
  "company_id" BIGINT NOT NULL,
  "purchase_request_id" BIGINT NOT NULL,
  "supplier_id" BIGINT NOT NULL,
  "created_by_user_id" BIGINT,
  "reference" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'CRC',
  "notes" TEXT,
  "evidence" JSONB,
  "status" "SupplierQuotationStatus" NOT NULL DEFAULT 'SUBMITTED',
  "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "supplier_quotations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "supplier_quotations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "supplier_quotations_purchase_request_id_fkey" FOREIGN KEY ("purchase_request_id") REFERENCES "purchase_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "supplier_quotations_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "supplier_quotations_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "supplier_quotation_items" (
  "id" BIGSERIAL NOT NULL,
  "quotation_id" BIGINT NOT NULL,
  "product_id" BIGINT NOT NULL,
  "quantity" DECIMAL(14,3) NOT NULL,
  "unit_price" DECIMAL(14,2) NOT NULL,
  "lead_time_days" INTEGER,
  "availability_notes" TEXT,
  "notes" TEXT,
  CONSTRAINT "supplier_quotation_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "supplier_quotation_items_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "supplier_quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "supplier_quotation_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "supplier_selections" (
  "id" BIGSERIAL NOT NULL,
  "company_id" BIGINT NOT NULL,
  "purchase_request_id" BIGINT NOT NULL,
  "quotation_id" BIGINT NOT NULL,
  "selected_by_user_id" BIGINT,
  "approved_by_user_id" BIGINT,
  "approval_status" "ProcurementApprovalStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
  "approval_required" BOOLEAN NOT NULL DEFAULT false,
  "total_amount" DECIMAL(14,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'CRC',
  "justification" TEXT,
  "approved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "supplier_selections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "supplier_selections_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "supplier_selections_purchase_request_id_fkey" FOREIGN KEY ("purchase_request_id") REFERENCES "purchase_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "supplier_selections_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "supplier_quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "supplier_selections_selected_by_user_id_fkey" FOREIGN KEY ("selected_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "supplier_selections_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "purchase_orders" (
  "id" BIGSERIAL NOT NULL,
  "company_id" BIGINT NOT NULL,
  "purchase_request_id" BIGINT,
  "quotation_id" BIGINT,
  "selection_id" BIGINT,
  "supplier_id" BIGINT NOT NULL,
  "created_by_user_id" BIGINT,
  "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_orders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "purchase_orders_purchase_request_id_fkey" FOREIGN KEY ("purchase_request_id") REFERENCES "purchase_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "purchase_orders_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "supplier_quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "purchase_orders_selection_id_fkey" FOREIGN KEY ("selection_id") REFERENCES "supplier_selections"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "purchase_orders_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "purchase_order_items" (
  "id" BIGSERIAL NOT NULL,
  "purchase_order_id" BIGINT NOT NULL,
  "product_id" BIGINT NOT NULL,
  "quantity" DECIMAL(14,3) NOT NULL,
  "unit_price" DECIMAL(14,2) NOT NULL,
  "notes" TEXT,
  CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_order_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "purchase_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "purchase_requests_company_id_status_created_at_idx" ON "purchase_requests"("company_id", "status", "created_at");
CREATE INDEX "purchase_request_items_purchase_request_id_product_id_idx" ON "purchase_request_items"("purchase_request_id", "product_id");
CREATE INDEX "supplier_quotations_company_id_purchase_request_id_created_at_idx" ON "supplier_quotations"("company_id", "purchase_request_id", "created_at");
CREATE INDEX "supplier_quotation_items_quotation_id_product_id_idx" ON "supplier_quotation_items"("quotation_id", "product_id");
CREATE INDEX "supplier_selections_company_id_purchase_request_id_created_at_idx" ON "supplier_selections"("company_id", "purchase_request_id", "created_at");
CREATE INDEX "purchase_orders_company_id_supplier_id_created_at_idx" ON "purchase_orders"("company_id", "supplier_id", "created_at");
CREATE INDEX "purchase_order_items_purchase_order_id_product_id_idx" ON "purchase_order_items"("purchase_order_id", "product_id");
