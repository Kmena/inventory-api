-- Inventori Billing integration foundation.
-- Precondition: do not apply if existing data violates one Order -> one Invoice.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM invoices
    WHERE order_id IS NOT NULL
    GROUP BY order_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add unique invoice order invariant: duplicate invoices.order_id rows exist';
  END IF;
END $$;

CREATE TYPE "BillingEnvironment" AS ENUM ('SANDBOX', 'PRODUCTION');
CREATE TYPE "FiscalIssuanceStatus" AS ENUM ('PENDING', 'PROCESSING', 'ACCEPTED', 'REJECTED', 'ERROR_RETRYABLE', 'ERROR_FINAL');

CREATE TABLE "company_billing_integration_configs" (
  "id" BIGSERIAL NOT NULL,
  "company_id" BIGINT NOT NULL,
  "billing_tenant_id" TEXT NOT NULL,
  "billing_company_id" TEXT NOT NULL,
  "billing_environment" "BillingEnvironment" NOT NULL DEFAULT 'SANDBOX',
  "billing_credential_secret_ref" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "readiness_status" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "readiness_checked_at" TIMESTAMP(3),
  "last_error_code" TEXT,
  "last_error_message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "company_billing_integration_configs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoice_fiscal_snapshots" (
  "id" BIGSERIAL NOT NULL,
  "company_id" BIGINT NOT NULL,
  "order_id" BIGINT NOT NULL,
  "invoice_id" BIGINT NOT NULL,
  "receiver_source_type" TEXT NOT NULL,
  "receiver_source_id" BIGINT,
  "currency" TEXT NOT NULL,
  "sale_condition" TEXT NOT NULL,
  "payment_method" TEXT,
  "credit_term_days" INTEGER,
  "header_snapshot" JSONB NOT NULL,
  "receiver_snapshot" JSONB NOT NULL,
  "lines_snapshot" JSONB NOT NULL,
  "totals_snapshot" JSONB NOT NULL,
  "mapping_version" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invoice_fiscal_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoice_fiscal_intents" (
  "id" BIGSERIAL NOT NULL,
  "company_id" BIGINT NOT NULL,
  "invoice_id" BIGINT NOT NULL,
  "billing_integration_config_id" BIGINT NOT NULL,
  "status" "FiscalIssuanceStatus" NOT NULL DEFAULT 'PENDING',
  "idempotency_key" TEXT NOT NULL,
  "billing_fiscal_document_id" TEXT,
  "clave" TEXT,
  "consecutive" TEXT,
  "billing_status" TEXT,
  "failure_code" TEXT,
  "failure_message" TEXT,
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "last_attempt_at" TIMESTAMP(3),
  "next_attempt_at" TIMESTAMP(3),
  "last_sync_at" TIMESTAMP(3),
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "invoice_fiscal_intents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "company_billing_integration_configs_company_id_key" ON "company_billing_integration_configs"("company_id");
CREATE INDEX "company_billing_integration_configs_company_id_enabled_idx" ON "company_billing_integration_configs"("company_id", "enabled");
CREATE UNIQUE INDEX "invoice_fiscal_snapshots_invoice_id_key" ON "invoice_fiscal_snapshots"("invoice_id");
CREATE INDEX "invoice_fiscal_snapshots_company_id_order_id_idx" ON "invoice_fiscal_snapshots"("company_id", "order_id");
CREATE UNIQUE INDEX "invoice_fiscal_intents_invoice_id_key" ON "invoice_fiscal_intents"("invoice_id");
CREATE UNIQUE INDEX "invoice_fiscal_intents_idempotency_key_key" ON "invoice_fiscal_intents"("idempotency_key");
CREATE INDEX "invoice_fiscal_intents_company_id_status_next_attempt_at_idx" ON "invoice_fiscal_intents"("company_id", "status", "next_attempt_at");

-- PostgreSQL permits multiple NULL values in a unique index, preserving draft/manual invoices without orders.
CREATE UNIQUE INDEX "invoices_order_id_unique" ON "invoices"("order_id");

ALTER TABLE "company_billing_integration_configs" ADD CONSTRAINT "company_billing_integration_configs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoice_fiscal_snapshots" ADD CONSTRAINT "invoice_fiscal_snapshots_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoice_fiscal_snapshots" ADD CONSTRAINT "invoice_fiscal_snapshots_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoice_fiscal_intents" ADD CONSTRAINT "invoice_fiscal_intents_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoice_fiscal_intents" ADD CONSTRAINT "invoice_fiscal_intents_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoice_fiscal_intents" ADD CONSTRAINT "invoice_fiscal_intents_billing_integration_config_id_fkey" FOREIGN KEY ("billing_integration_config_id") REFERENCES "company_billing_integration_configs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
