-- Backfill: allow tenant admins to configure Hacienda credentials from Fiscal Settings.
-- This is a permission-catalog/data migration only; no Prisma schema changes.

INSERT INTO "permissions" ("code", "module", "action", "description", "is_active", "created_at", "updated_at")
VALUES (
  'fiscal.credentials.manage',
  'fiscal_settings',
  'manage_credentials',
  'Configurar y validar credenciales de Hacienda',
  TRUE,
  NOW(),
  NOW()
)
ON CONFLICT ("code") DO UPDATE
SET
  "module" = EXCLUDED."module",
  "action" = EXCLUDED."action",
  "description" = EXCLUDED."description",
  "is_active" = TRUE,
  "updated_at" = NOW();

INSERT INTO "role_permissions" ("role_id", "permission_id", "is_enabled", "created_at", "updated_at")
SELECT r."id", p."id", TRUE, NOW(), NOW()
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."code" IN ('root', 'admin')
  AND p."code" = 'fiscal.credentials.manage'
ON CONFLICT ("role_id", "permission_id") DO UPDATE
SET
  "is_enabled" = TRUE,
  "updated_at" = NOW();
