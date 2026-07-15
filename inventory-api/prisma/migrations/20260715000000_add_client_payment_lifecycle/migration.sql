ALTER TABLE "clients"
ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "deleted_at" TIMESTAMP(3);

CREATE INDEX "clients_company_id_is_active_idx" ON "clients"("company_id", "is_active");
CREATE INDEX "clients_company_id_deleted_at_idx" ON "clients"("company_id", "deleted_at");

CREATE TYPE "PaymentLifecycleStatus" AS ENUM ('ACTIVE', 'REVERSED');

ALTER TABLE "payments"
ADD COLUMN "status" "PaymentLifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "reversal_reason" TEXT,
ADD COLUMN "reversed_at" TIMESTAMP(3),
ADD COLUMN "reversed_by_user_id" BIGINT,
ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "payments_invoice_id_status_idx" ON "payments"("invoice_id", "status");
CREATE INDEX "payments_status_idx" ON "payments"("status");
