-- Migration: add_inventory_location_permissions (MASTER-006 / INV-TASK-014 part 1)
-- Registers the permission codes required by:
--   * specs/inventory-ux-mvp/security.md §2 (Permissions - Add if missing)
--   * specs/inventori-product-inventory-master-plan/migration-order.md Migration 9
--   * specs/inventori-product-inventory-master-plan/decisions.md
--     (stock-changing permissions remain separate from read-only inventory
--      permissions; DEC-004 pattern)
--
-- Approved permission codes:
--   * inventory.initial-inventory.create → onboarding-only initial stock load
--   * inventory.transfers.create         → warehouse-to-warehouse transfer
--   * inventory.lots.list                → read-only lot listing
--   * locations.view                     → read-only location listing/detail
--   * locations.manage                   → CRUD + lifecycle for locations
--
-- Strategy:
--   * Insert-only. No role gets these permissions from the migration itself.
--     Role assignment happens in Wave 2 rollout when the routes that
--     consume them are enabled (see execution-waves.md).
--   * Idempotent via NOT EXISTS.
--
-- Rollback: DELETE the five permission rows (safe because no role grants
-- them yet).

INSERT INTO "permissions" ("code", "module", "action", "description", "is_active", "created_at", "updated_at")
SELECT 'inventory.initial-inventory.create', 'inventory', 'initial-inventory.create',
       'Registrar inventario inicial (carga única de existencias por producto y ubicación)',
       TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "permissions" WHERE "code" = 'inventory.initial-inventory.create');

INSERT INTO "permissions" ("code", "module", "action", "description", "is_active", "created_at", "updated_at")
SELECT 'inventory.transfers.create', 'inventory', 'transfers.create',
       'Registrar traslados atómicos entre ubicaciones',
       TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "permissions" WHERE "code" = 'inventory.transfers.create');

INSERT INTO "permissions" ("code", "module", "action", "description", "is_active", "created_at", "updated_at")
SELECT 'inventory.lots.list', 'inventory', 'lots.list',
       'Ver listado de lotes (solo lectura)',
       TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "permissions" WHERE "code" = 'inventory.lots.list');

INSERT INTO "permissions" ("code", "module", "action", "description", "is_active", "created_at", "updated_at")
SELECT 'locations.view', 'locations', 'view',
       'Ver ubicaciones (bodegas, almacenes, CEDIs y virtuales)',
       TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "permissions" WHERE "code" = 'locations.view');

INSERT INTO "permissions" ("code", "module", "action", "description", "is_active", "created_at", "updated_at")
SELECT 'locations.manage', 'locations', 'manage',
       'Gestionar ubicaciones (crear, editar, desactivar) y allowedWarehouseIds',
       TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "permissions" WHERE "code" = 'locations.manage');
