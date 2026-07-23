CREATE TABLE IF NOT EXISTS "throttle_entries" (
  "scope_key" TEXT PRIMARY KEY,
  "payload_json" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "throttle_entries_expires_at_idx"
  ON "throttle_entries" ("expires_at");

CREATE OR REPLACE FUNCTION update_throttle_entries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updated_at" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS throttle_entries_set_updated_at ON "throttle_entries";

CREATE TRIGGER throttle_entries_set_updated_at
BEFORE UPDATE ON "throttle_entries"
FOR EACH ROW
EXECUTE FUNCTION update_throttle_entries_updated_at();
