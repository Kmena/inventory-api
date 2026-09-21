-- Migration: add_entitlement_permissions (MASTER-007 / NPP-TASK-014 part 1)
-- Registers the entitlement permission codes required by:
--   * specs/non-physical-products-mvp/security.md §1 (Permission additions)
--   * specs/non-physical-products-mvp/api-contracts.md (POST/PATCH endpoints
--     under /entitlements)
--   * specs/inventori-product-inventory-master-plan/migration-order.md Migration 8
--   * specs/inventori-product-inventory-master-plan/decisions.md DEC-004
--     (manual activation stays SEPARATE from general entitlement management)
--
-- Approved permission codes (from non-physical-products-mvp/security.md):
--   * entitlements.view          → read-only listing/detail
--   * entitlements.manage        → CRUD (excluding manual activation)
--   * entitlements.activate.manual → dedicated manual activation permission
--     (DEC-004 keeps this separate from entitlements.manage).
--
-- Strategy:
--   * Insert-only. No role gets these permissions from the migration itself.
--     Role assignment is a Wave 2 concern (activated as part of feature
--     rollout) so this migration is safe to deploy alongside the schema.
--   * Idempotent via NOT EXISTS.
--
-- Rollback: DELETE the three permission rows (safe because no role grants
-- them yet). No cross-cutting side-effects.

INSERT INTO "permissions" ("code", "module", "action", "description", "is_active", "created_at", "updated_at")
SELECT 'entitlements.view', 'entitlements', 'view',
       'Visualizar derechos comerciales (suscripciones, memberships, cursos)',
       TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "permissions" WHERE "code" = 'entitlements.view');

INSERT INTO "permissions" ("code", "module", "action", "description", "is_active", "created_at", "updated_at")
SELECT 'entitlements.manage', 'entitlements', 'manage',
       'Gestionar derechos comerciales (crear, editar, cancelar) — excluye activación manual',
       TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "permissions" WHERE "code" = 'entitlements.manage');

INSERT INTO "permissions" ("code", "module", "action", "description", "is_active", "created_at", "updated_at")
SELECT 'entitlements.activate.manual', 'entitlements', 'activate.manual',
       'Activar manualmente un derecho comercial sin pago/aprobación de crédito',
       TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "permissions" WHERE "code" = 'entitlements.activate.manual');
