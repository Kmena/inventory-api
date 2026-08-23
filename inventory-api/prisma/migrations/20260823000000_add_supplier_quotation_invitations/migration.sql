-- Migration: add_supplier_quotation_invitations
-- Adds RFQ invitation lifecycle entity for external supplier quotation requests.
-- Additive only — no existing tables or data are modified.

CREATE TYPE "SupplierQuotationInvitationStatus" AS ENUM (
  'PENDING',
  'PREPARED',
  'RESPONDED',
  'EXPIRED',
  'CANCELLED'
);

CREATE TABLE "supplier_quotation_invitations" (
  "id"                          BIGSERIAL NOT NULL,
  "company_id"                  BIGINT NOT NULL,
  "purchase_request_id"         BIGINT NOT NULL,
  "supplier_id"                 BIGINT NOT NULL,
  "quotation_id"                BIGINT,
  "created_by_user_id"          BIGINT,
  "email_to"                    TEXT,
  "token_hash"                  TEXT NOT NULL,
  "status"                      "SupplierQuotationInvitationStatus" NOT NULL DEFAULT 'PENDING',
  "expires_at"                  TIMESTAMP(3) NOT NULL,
  "prepared_at"                 TIMESTAMP(3),
  "responded_at"                TIMESTAMP(3),
  "cancelled_at"                TIMESTAMP(3),
  "email_subject"               TEXT,
  "email_body"                  TEXT,
  "response_source"             TEXT,
  "manual_response_by_user_id"  BIGINT,
  "manual_response_notes"       TEXT,
  "created_at"                  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                  TIMESTAMP(3) NOT NULL,

  CONSTRAINT "supplier_quotation_invitations_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on token_hash for lookup by token
CREATE UNIQUE INDEX "supplier_quotation_invitations_token_hash_key"
  ON "supplier_quotation_invitations" ("token_hash");

-- Composite index for tenant + request scoping
CREATE INDEX "supplier_quotation_invitations_company_id_purchase_request_id_idx"
  ON "supplier_quotation_invitations" ("company_id", "purchase_request_id");

-- Index for supplier-scoped queries
CREATE INDEX "supplier_quotation_invitations_supplier_id_idx"
  ON "supplier_quotation_invitations" ("supplier_id");

-- Index for status + expiration queries (e.g. expired cleanup)
CREATE INDEX "supplier_quotation_invitations_status_expires_at_idx"
  ON "supplier_quotation_invitations" ("status", "expires_at");

-- Foreign keys
ALTER TABLE "supplier_quotation_invitations"
  ADD CONSTRAINT "supplier_quotation_invitations_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supplier_quotation_invitations"
  ADD CONSTRAINT "supplier_quotation_invitations_purchase_request_id_fkey"
  FOREIGN KEY ("purchase_request_id") REFERENCES "purchase_requests"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supplier_quotation_invitations"
  ADD CONSTRAINT "supplier_quotation_invitations_supplier_id_fkey"
  FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supplier_quotation_invitations"
  ADD CONSTRAINT "supplier_quotation_invitations_quotation_id_fkey"
  FOREIGN KEY ("quotation_id") REFERENCES "supplier_quotations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "supplier_quotation_invitations"
  ADD CONSTRAINT "supplier_quotation_invitations_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "supplier_quotation_invitations"
  ADD CONSTRAINT "supplier_quotation_invitations_manual_response_by_user_id_fkey"
  FOREIGN KEY ("manual_response_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
