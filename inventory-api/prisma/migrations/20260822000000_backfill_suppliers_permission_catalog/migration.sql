INSERT INTO "permissions" ("code", "module", "action", "description", "is_active", "created_at", "updated_at")
VALUES
  ('suppliers.view', 'procurement', 'view_suppliers', 'Ver proveedores autorizados', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('suppliers.manage', 'procurement', 'manage_suppliers', 'Gestionar proveedores y autorizaciones por producto', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE
SET
  "module" = EXCLUDED."module",
  "action" = EXCLUDED."action",
  "description" = EXCLUDED."description",
  "is_active" = true,
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "role_permissions" ("role_id", "permission_id", "is_enabled", "created_at", "updated_at")
SELECT r."id", p."id", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Role" AS r
CROSS JOIN "permissions" AS p
WHERE r."code" IN ('root', 'admin')
  AND p."code" IN ('suppliers.view', 'suppliers.manage')
ON CONFLICT ("role_id", "permission_id") DO UPDATE
SET
  "is_enabled" = true,
  "updated_at" = CURRENT_TIMESTAMP;
