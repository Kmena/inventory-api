-- Move credit_limit and credit_balance from clients to client_stores.
-- Business rule: credit is per store, not per client.
-- Each store independently tracks its own credit exposure.

-- ─── Add columns to client_stores ──────────────────────────────────────────
ALTER TABLE "client_stores"
  ADD COLUMN IF NOT EXISTS "credit_limit"   DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "credit_balance" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- ─── Remove columns from clients ────────────────────────────────────────────
-- credit_balance may have accumulated value; it is intentionally dropped
-- because per-store balances are now tracked independently and the old
-- aggregate value is not distributable without business input.
ALTER TABLE "clients"
  DROP COLUMN IF EXISTS "credit_limit",
  DROP COLUMN IF EXISTS "credit_balance";
