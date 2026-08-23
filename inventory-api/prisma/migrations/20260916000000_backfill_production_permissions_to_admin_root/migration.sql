-- Backfill: assign all production + recipe permissions to root and admin roles.
--
-- The migration 20260819000000_backfill_production_permission_catalog inserted the
-- permission rows into the "permissions" table but did NOT assign them to existing
-- roles via "role_permissions". The seed.js does this automatically, but existing
-- databases that were seeded before this permission set existed and only received
-- migrations do not have these assignments.
--
-- Permissions covered:
--   recipes.view, recipes.operations.view, recipes.manage, recipes.approve
--   production.view, production.create, production.approve, production.execute
--   production.complete, production.cancel, production.override

INSERT INTO "role_permissions" ("role_id", "permission_id", "is_enabled", "created_at", "updated_at")
SELECT r."id", p."id", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Role" AS r
CROSS JOIN "permissions" AS p
WHERE r."code" IN ('root', 'admin')
  AND p."code" IN (
    'recipes.view',
    'recipes.operations.view',
    'recipes.manage',
    'recipes.approve',
    'production.view',
    'production.create',
    'production.approve',
    'production.execute',
    'production.complete',
    'production.cancel',
    'production.override'
  )
ON CONFLICT ("role_id", "permission_id") DO UPDATE
SET
  "is_enabled" = true,
  "updated_at" = CURRENT_TIMESTAMP;
