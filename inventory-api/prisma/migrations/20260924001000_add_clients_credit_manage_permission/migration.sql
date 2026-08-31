-- Add permission: clients.credit.manage
-- Allows a role to set and modify the credit limit per store.
-- Assigned to: admin (global) and company-scoped admin roles.

-- ─── Insert permission (idempotent) ─────────────────────────────────────────
INSERT INTO "permissions" ("code", "module", "action", "description", "is_active", "created_at", "updated_at")
SELECT
  'clients.credit.manage',
  'clients',
  'credit.manage',
  'Aprobar y modificar límite de crédito de tiendas',
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "permissions" WHERE "code" = 'clients.credit.manage'
);

-- ─── Assign to global admin and root roles ───────────────────────────────────
INSERT INTO "role_permissions" ("role_id", "permission_id", "is_enabled", "created_at", "updated_at")
SELECT r."id", p."id", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Role" AS r
CROSS JOIN "permissions" AS p
WHERE r."code" IN ('root', 'admin')
  AND p."code" = 'clients.credit.manage'
ON CONFLICT ("role_id", "permission_id") DO UPDATE
SET "is_enabled" = true, "updated_at" = CURRENT_TIMESTAMP;

-- ─── Assign to company-scoped admin roles ────────────────────────────────────
INSERT INTO "role_permissions" ("role_id", "permission_id", "is_enabled", "created_at", "updated_at")
SELECT r."id", p."id", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Role" AS r
CROSS JOIN "permissions" AS p
WHERE r."company_id" IS NOT NULL
  AND r."code" LIKE 'company_%_admin%'
  AND p."code" = 'clients.credit.manage'
ON CONFLICT ("role_id", "permission_id") DO UPDATE
SET "is_enabled" = true, "updated_at" = CURRENT_TIMESTAMP;
