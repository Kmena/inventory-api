-- Add dispatch/shipping tracking fields to orders table.
-- These are filled by warehouse staff at dispatch time.

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "transport_method"      TEXT,
  ADD COLUMN IF NOT EXISTS "tracking_number"       TEXT,
  ADD COLUMN IF NOT EXISTS "transport_responsible" TEXT,
  ADD COLUMN IF NOT EXISTS "dispatched_at"         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "dispatched_by_id"      BIGINT REFERENCES "users"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "orders_dispatched_by_id_idx" ON "orders"("dispatched_by_id");
