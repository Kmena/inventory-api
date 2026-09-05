-- Backfill: integration.taxpayer.lookup and integration.economic-activities.list permissions
-- These permissions were defined in access-policy-registry.js and used by the Hacienda
-- taxpayer lookup and economic activities endpoints, but were missing from seed.js and
-- therefore absent from existing databases. This migration ensures they exist and are
-- assigned to root, admin and sales roles on all environments.
--
-- Permissions covered:
--   integration.taxpayer.lookup
--   integration.economic-activities.list

INSERT INTO "permissions" ("code", "module", "action", "description", "is_active", "created_at", "updated_at")
VALUES
  ('integration.taxpayer.lookup',           'integration', 'taxpayer_lookup',          'Consultar datos fiscales de contribuyentes en Hacienda',        true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('integration.economic-activities.list',  'integration', 'economic_activities_list', 'Listar actividades economicas del catalogo de Hacienda',         true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE
SET
  "module"      = EXCLUDED."module",
  "action"      = EXCLUDED."action",
  "description" = EXCLUDED."description",
  "is_active"   = true,
  "updated_at"  = CURRENT_TIMESTAMP;

-- Assign to root and admin (full-permission roles)
INSERT INTO "role_permissions" ("role_id", "permission_id", "is_enabled", "created_at", "updated_at")
SELECT r."id", p."id", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Role" AS r
CROSS JOIN "permissions" AS p
WHERE r."code" IN ('root', 'admin')
  AND p."code" IN ('integration.taxpayer.lookup', 'integration.economic-activities.list')
ON CONFLICT ("role_id", "permission_id") DO UPDATE
SET "is_enabled" = true, "updated_at" = CURRENT_TIMESTAMP;

-- Assign to sales role (as defined in access-policy-registry.js)
INSERT INTO "role_permissions" ("role_id", "permission_id", "is_enabled", "created_at", "updated_at")
SELECT r."id", p."id", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Role" AS r
CROSS JOIN "permissions" AS p
WHERE r."code" = 'sales'
  AND p."code" IN ('integration.taxpayer.lookup', 'integration.economic-activities.list')
ON CONFLICT ("role_id", "permission_id") DO UPDATE
SET "is_enabled" = true, "updated_at" = CURRENT_TIMESTAMP;
