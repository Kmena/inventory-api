-- Part 2 of 2: rejection metadata columns and index.
-- Runs after 20260925000000 which committed the REJECTED enum value.

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "rejection_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "rejected_by_id"   BIGINT REFERENCES "users"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "rejected_at"      TIMESTAMPTZ;

-- Fast lookup: agent's rejected orders surface first on the dashboard.
CREATE INDEX IF NOT EXISTS "orders_rejected_user_idx"
  ON "orders"("user_id", "status")
  WHERE "status" = 'REJECTED';
