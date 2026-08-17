-- Backfill: receipts, procurement (view/approve/override), quality and billing handoff permissions
-- These permissions were added to seed.js after the initial database seeding and required
-- a dedicated migration to ensure they exist on existing databases and are assigned to
-- the root and admin roles.
--
-- Permissions covered:
--   procurement.view, procurement.approve, procurement.override
--   quality.view, quality.inspect, quality.override
--   receipts.view, receipts.inspect, receipts.confirm, receipts.reverse
--   inventory.intake.override
--   billing.handoff.view, billing.handoff.create

INSERT INTO "permissions" ("code", "module", "action", "description", "is_active", "created_at", "updated_at")
VALUES
  ('procurement.view',        'procurement', 'view',            'Ver solicitudes y ordenes de compra',                true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('procurement.approve',     'procurement', 'approve',         'Aprobar seleccion de proveedor',                     true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('procurement.override',    'procurement', 'override',        'Sobrescribir guardas de compra',                     true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('quality.view',            'quality',     'view',            'Ver inspecciones QA',                                true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('quality.inspect',         'quality',     'inspect',         'Registrar inspecciones QA',                          true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('quality.override',        'quality',     'override',        'Sobrescribir bloqueo QA',                            true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('receipts.view',           'warehouse',   'view_receipts',   'Ver documentos de recepcion',                        true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('receipts.inspect',        'warehouse',   'inspect_receipts','Inspeccionar recepciones',                           true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('receipts.confirm',        'warehouse',   'confirm_receipts','Confirmar entradas fisicas al inventario',            true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('receipts.reverse',        'warehouse',   'reverse_receipts','Revertir entradas confirmadas',                      true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('inventory.intake.override','inventory',  'intake_override', 'Sobrescribir validaciones de entrada',               true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('billing.handoff.view',    'billing',     'view_handoff',    'Ver referencias y estado de handoff fiscal',         true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('billing.handoff.create',  'billing',     'create_handoff',  'Crear referencias de handoff fiscal',                true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE
SET
  "module"      = EXCLUDED."module",
  "action"      = EXCLUDED."action",
  "description" = EXCLUDED."description",
  "is_active"   = true,
  "updated_at"  = CURRENT_TIMESTAMP;

INSERT INTO "role_permissions" ("role_id", "permission_id", "is_enabled", "created_at", "updated_at")
SELECT r."id", p."id", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Role" AS r
CROSS JOIN "permissions" AS p
WHERE r."code" IN ('root', 'admin')
  AND p."code" IN (
    'procurement.view',
    'procurement.approve',
    'procurement.override',
    'quality.view',
    'quality.inspect',
    'quality.override',
    'receipts.view',
    'receipts.inspect',
    'receipts.confirm',
    'receipts.reverse',
    'inventory.intake.override',
    'billing.handoff.view',
    'billing.handoff.create'
  )
ON CONFLICT ("role_id", "permission_id") DO UPDATE
SET
  "is_enabled" = true,
  "updated_at" = CURRENT_TIMESTAMP;
