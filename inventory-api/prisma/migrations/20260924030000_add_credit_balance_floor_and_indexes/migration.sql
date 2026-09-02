-- AUD-DB-001: Add CHECK constraint to prevent credit_balance from going negative.
-- Applied to both clients and client_stores to guard both credit tracking levels.
ALTER TABLE "clients"
  ADD CONSTRAINT "clients_credit_balance_floor" CHECK ("credit_balance" >= 0);

ALTER TABLE "client_stores"
  ADD CONSTRAINT "client_stores_credit_balance_floor" CHECK ("credit_balance" >= 0);

-- AUD-DB-003: Indexes on credit fields to support ledger filtering and reporting queries.
CREATE INDEX IF NOT EXISTS "clients_credit_balance_idx" ON "clients"("credit_balance");
CREATE INDEX IF NOT EXISTS "clients_credit_limit_idx"   ON "clients"("credit_limit");
CREATE INDEX IF NOT EXISTS "client_stores_credit_balance_idx" ON "client_stores"("credit_balance");
