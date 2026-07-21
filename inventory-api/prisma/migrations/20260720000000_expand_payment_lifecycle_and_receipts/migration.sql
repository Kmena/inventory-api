ALTER TABLE "payments"
  DROP CONSTRAINT IF EXISTS "payments_reversal_metadata_consistency_chk";

ALTER TYPE "PaymentLifecycleStatus" RENAME TO "PaymentLifecycleStatus_old";

CREATE TYPE "PaymentLifecycleStatus" AS ENUM (
  'DRAFT',
  'PENDING_APPROVAL',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'REVERSED',
  'CANCELLED'
);

ALTER TABLE "payments"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "PaymentLifecycleStatus"
  USING (
    CASE "status"::text
      WHEN 'ACTIVE' THEN 'APPROVED'
      WHEN 'REVERSED' THEN 'REVERSED'
      ELSE 'APPROVED'
    END
  )::"PaymentLifecycleStatus";

DROP TYPE "PaymentLifecycleStatus_old";

ALTER TABLE "payments"
  ADD COLUMN "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "submitted_by_user_id" BIGINT,
  ADD COLUMN "under_review_at" TIMESTAMP(3),
  ADD COLUMN "under_review_by_user_id" BIGINT,
  ADD COLUMN "review_reason" TEXT,
  ADD COLUMN "approved_at" TIMESTAMP(3),
  ADD COLUMN "approved_by_user_id" BIGINT,
  ADD COLUMN "rejected_at" TIMESTAMP(3),
  ADD COLUMN "rejected_by_user_id" BIGINT,
  ADD COLUMN "rejection_reason" TEXT,
  ADD COLUMN "cancelled_at" TIMESTAMP(3),
  ADD COLUMN "cancelled_by_user_id" BIGINT,
  ADD COLUMN "cancellation_reason" TEXT;

UPDATE "payments"
SET
  "submitted_at" = COALESCE("created_at", CURRENT_TIMESTAMP),
  "approved_at" = CASE
    WHEN "status" = 'APPROVED' AND "approved_at" IS NULL THEN COALESCE("updated_at", "created_at", CURRENT_TIMESTAMP)
    ELSE "approved_at"
  END
WHERE "status" = 'APPROVED';

UPDATE "payments"
SET
  "submitted_at" = COALESCE("created_at", CURRENT_TIMESTAMP),
  "approved_at" = COALESCE("approved_at", "created_at", CURRENT_TIMESTAMP)
WHERE "status" = 'REVERSED';

ALTER TABLE "payments"
  ALTER COLUMN "status" SET DEFAULT 'APPROVED';

CREATE TABLE "payment_receipts" (
  "id" BIGSERIAL NOT NULL,
  "payment_id" BIGINT NOT NULL,
  "storage_ref" TEXT NOT NULL,
  "original_file_name" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "file_size_bytes" BIGINT NOT NULL,
  "is_current" BOOLEAN NOT NULL DEFAULT true,
  "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "uploaded_by_user_id" BIGINT,
  "replaced_at" TIMESTAMP(3),
  "note" TEXT,
  CONSTRAINT "payment_receipts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payment_receipts_payment_id_is_current_idx" ON "payment_receipts"("payment_id", "is_current");
CREATE UNIQUE INDEX "payment_receipts_one_current_per_payment_idx" ON "payment_receipts"("payment_id") WHERE "is_current" = true;

ALTER TABLE "payment_receipts"
  ADD CONSTRAINT "payment_receipts_file_size_positive_chk" CHECK ("file_size_bytes" > 0),
  ADD CONSTRAINT "payment_receipts_replaced_metadata_consistency_chk" CHECK (
    ("is_current" = true AND "replaced_at" IS NULL)
    OR ("is_current" = false AND "replaced_at" IS NOT NULL)
  );

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_lifecycle_metadata_consistency_chk" CHECK (
    ("status" <> 'UNDER_REVIEW' OR "under_review_at" IS NOT NULL)
    AND ("status" <> 'APPROVED' OR "approved_at" IS NOT NULL)
    AND ("status" <> 'REJECTED' OR ("rejected_at" IS NOT NULL AND "rejection_reason" IS NOT NULL))
    AND ("status" <> 'REVERSED' OR ("reversed_at" IS NOT NULL AND "reversal_reason" IS NOT NULL))
    AND ("status" <> 'CANCELLED' OR ("cancelled_at" IS NOT NULL AND "cancellation_reason" IS NOT NULL))
  );

ALTER TABLE "payment_receipts"
  ADD CONSTRAINT "payment_receipts_payment_id_fkey"
  FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
