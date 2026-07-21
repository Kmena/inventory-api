ALTER TABLE "client_stores" DROP CONSTRAINT IF EXISTS "client_stores_region_id_fkey";
DROP INDEX IF EXISTS "client_stores_region_id_idx";
ALTER TABLE "client_stores" DROP COLUMN IF EXISTS "region_id";

ALTER TABLE "clients" DROP CONSTRAINT IF EXISTS "clients_region_id_fkey";
ALTER TABLE "clients" DROP COLUMN IF EXISTS "region_id";
