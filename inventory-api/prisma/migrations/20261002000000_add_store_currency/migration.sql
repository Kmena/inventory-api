-- Add per-store currency for credit display and future invoicing.
-- Additive nullable column per approved specification.
ALTER TABLE "client_stores"
  ADD COLUMN IF NOT EXISTS "currency" VARCHAR(10) NULL;
