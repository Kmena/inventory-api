-- Add credit_limit and credit_balance to the clients table.
-- These fields track aggregate credit exposure at the client level,
-- complementing the per-store credit fields on client_stores.

ALTER TABLE "clients"
  ADD COLUMN IF NOT EXISTS "credit_limit"   DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "credit_balance" DECIMAL(14,2) NOT NULL DEFAULT 0;
