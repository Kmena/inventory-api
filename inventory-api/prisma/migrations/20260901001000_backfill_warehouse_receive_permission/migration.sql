-- Backfill: warehouse.receive permission + receipt/recipe permissions for warehouse role
--
-- warehouse.receive gates the Recepciones and Inventario tabs in the Warehouse SPA.
-- It was referenced in app.js but never registered in the permission catalog or
-- assigned to any role.
--
-- The warehouse role also lacked receipts.view/inspect/confirm and
-- recipes.operations.view, which are required to actually use the
-- Recepciones workflow in the Warehouse SPA.

-- 1. Upsert warehouse.receive permission
INSERT INTO "permissions" ("code", "module", "action", "description", "is_active", "created_at", "updated_at")
VALUES
  ('warehouse.receive', 'warehouse', 'receive', 'Ejecutar recepciones y confirmar stock entrante', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE
SET
  "module"      = EXCLUDED."module",
  "action"      = EXCLUDED."action",
  "description" = EXCLUDED."description",
  "is_active"   = true,
  "updated_at"  = CURRENT_TIMESTAMP;

-- 2. Assign warehouse.receive to warehouse role
INSERT INTO "role_permissions" ("role_id", "permission_id", "is_enabled", "created_at", "updated_at")
SELECT r."id", p."id", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Role" AS r
CROSS JOIN "permissions" AS p
WHERE r."code" = 'warehouse'
  AND p."code" = 'warehouse.receive'
ON CONFLICT ("role_id", "permission_id") DO UPDATE
SET
  "is_enabled" = true,
  "updated_at" = CURRENT_TIMESTAMP;

-- 3. Assign receipts.view, receipts.inspect, receipts.confirm and
--    recipes.operations.view to warehouse role.
--    These permissions already exist (inserted by the previous backfill migration)
--    but were only assigned to root and admin.
INSERT INTO "role_permissions" ("role_id", "permission_id", "is_enabled", "created_at", "updated_at")
SELECT r."id", p."id", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Role" AS r
CROSS JOIN "permissions" AS p
WHERE r."code" = 'warehouse'
  AND p."code" IN (
    'receipts.view',
    'receipts.inspect',
    'receipts.confirm',
    'recipes.operations.view'
  )
ON CONFLICT ("role_id", "permission_id") DO UPDATE
SET
  "is_enabled" = true,
  "updated_at" = CURRENT_TIMESTAMP;
