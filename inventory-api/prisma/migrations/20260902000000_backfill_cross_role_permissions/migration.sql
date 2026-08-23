-- Cross-role permissions backfill (warehouse-receive-production spec)
--
-- production_operator: add warehouse.access, receipts.view, receipts.inspect
--   (receipts.confirm remains as a sensitiveAddition — not backfilled here)
-- warehouse_operator: add production.view, production.execute as allowedAdditions
--   (production.complete remains as sensitiveAddition — not backfilled here)
--
-- These permissions are stored in the DB (confirmed from authenticate.js).
-- Changing role-bundles.config.js only affects NEWLY created roles.
-- Existing roles require this data migration.

-- 1. production_operator ← warehouse.access
INSERT INTO "role_permissions" ("role_id", "permission_id", "is_enabled", "created_at", "updated_at")
SELECT r."id", p."id", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Role" AS r
CROSS JOIN "permissions" AS p
WHERE r."code" = 'production_operator'
  AND p."code" = 'warehouse.access'
ON CONFLICT ("role_id", "permission_id") DO UPDATE
SET "is_enabled" = true, "updated_at" = CURRENT_TIMESTAMP;

-- 2. production_operator ← receipts.view
INSERT INTO "role_permissions" ("role_id", "permission_id", "is_enabled", "created_at", "updated_at")
SELECT r."id", p."id", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Role" AS r
CROSS JOIN "permissions" AS p
WHERE r."code" = 'production_operator'
  AND p."code" = 'receipts.view'
ON CONFLICT ("role_id", "permission_id") DO UPDATE
SET "is_enabled" = true, "updated_at" = CURRENT_TIMESTAMP;

-- 3. production_operator ← receipts.inspect
INSERT INTO "role_permissions" ("role_id", "permission_id", "is_enabled", "created_at", "updated_at")
SELECT r."id", p."id", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Role" AS r
CROSS JOIN "permissions" AS p
WHERE r."code" = 'production_operator'
  AND p."code" = 'receipts.inspect'
ON CONFLICT ("role_id", "permission_id") DO UPDATE
SET "is_enabled" = true, "updated_at" = CURRENT_TIMESTAMP;

-- Note: warehouse_operator production permissions (production.view, production.execute)
-- are allowedAdditions — they must be explicitly enabled by the company admin per user.
-- They are NOT backfilled here to preserve the intended access control model.
