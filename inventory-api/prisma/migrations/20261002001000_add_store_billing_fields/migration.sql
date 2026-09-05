-- Add optional store-level fiscal override fields.
-- Null values preserve inherit-from-client semantics.
ALTER TABLE "client_stores"
  ADD COLUMN IF NOT EXISTS "legal_name" VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS "commercial_name" VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS "legal_id" VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS "document_type" VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS "email_billing" VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS "economic_activity_code" VARCHAR(20) NULL,
  ADD COLUMN IF NOT EXISTS "economic_activity_name" VARCHAR(255) NULL;
