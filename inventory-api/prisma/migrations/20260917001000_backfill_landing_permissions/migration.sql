-- Backfill: assign explicit landing permissions to existing roles.
--
-- Mapping (per DEC-008 and spec):
--   root                                → root.access (platform exception; harmless to assign)
--   admin                               → root.access
--   company_admin / procurement_operator → root.access
--   warehouse_operator / production_operator / qa_inspector → warehouse.access (already has it)
--   sales_agent                         → agent.access
--   sales_supervisor                    → root.access (DEC-008)
--
-- This migration is idempotent: ON CONFLICT DO UPDATE SET is_enabled=true.
-- Only applies to roles that match by code pattern — safe for multi-tenant.

-- ─── root.access to root and admin global roles ─────────────────────
INSERT INTO "role_permissions" ("role_id", "permission_id", "is_enabled", "created_at", "updated_at")
SELECT r."id", p."id", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Role" AS r
CROSS JOIN "permissions" AS p
WHERE r."code" IN ('root', 'admin')
  AND p."code" = 'root.access'
ON CONFLICT ("role_id", "permission_id") DO UPDATE
SET "is_enabled" = true, "updated_at" = CURRENT_TIMESTAMP;

-- ─── root.access to company-scoped roles that need root landing ─────
-- Matches company_*_admin*, company_*_procurement*, and company_*_sales_supervisor* patterns
-- plus any role with code containing 'admin' or 'procurement' that has a companyId
INSERT INTO "role_permissions" ("role_id", "permission_id", "is_enabled", "created_at", "updated_at")
SELECT r."id", p."id", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Role" AS r
CROSS JOIN "permissions" AS p
WHERE r."company_id" IS NOT NULL
  AND p."code" = 'root.access'
  AND (
    -- Company admin roles
    r."code" LIKE 'company_%_admin%'
    -- Procurement operator roles
    OR r."code" LIKE 'company_%_procurement%'
    -- Sales supervisor roles (DEC-008: lands on /root/)
    OR r."code" LIKE 'company_%_sales_supervisor%'
    OR r."code" LIKE 'company_%_supervisor%'
  )
ON CONFLICT ("role_id", "permission_id") DO UPDATE
SET "is_enabled" = true, "updated_at" = CURRENT_TIMESTAMP;

-- ─── agent.access to company-scoped sales agent roles ───────────────
INSERT INTO "role_permissions" ("role_id", "permission_id", "is_enabled", "created_at", "updated_at")
SELECT r."id", p."id", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Role" AS r
CROSS JOIN "permissions" AS p
WHERE r."company_id" IS NOT NULL
  AND p."code" = 'agent.access'
  AND (
    r."code" LIKE 'company_%_sales_agent%'
    OR r."code" LIKE 'company_%_agent%'
  )
ON CONFLICT ("role_id", "permission_id") DO UPDATE
SET "is_enabled" = true, "updated_at" = CURRENT_TIMESTAMP;

-- ─── warehouse.access already assigned to warehouse/production/qa roles ───
-- No action needed — warehouse.access was already in seed and prior migrations.
-- This is a safety net for any warehouse-pattern roles that somehow lack it.
INSERT INTO "role_permissions" ("role_id", "permission_id", "is_enabled", "created_at", "updated_at")
SELECT r."id", p."id", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Role" AS r
CROSS JOIN "permissions" AS p
WHERE r."company_id" IS NOT NULL
  AND p."code" = 'warehouse.access'
  AND (
    r."code" LIKE 'company_%_warehouse%'
    OR r."code" LIKE 'company_%_production%'
    OR r."code" LIKE 'company_%_qa%'
    OR r."code" LIKE 'company_%_inspector%'
  )
ON CONFLICT ("role_id", "permission_id") DO UPDATE
SET "is_enabled" = true, "updated_at" = CURRENT_TIMESTAMP;
