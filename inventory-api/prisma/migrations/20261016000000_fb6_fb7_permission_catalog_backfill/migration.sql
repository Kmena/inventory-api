-- FB6/FB7 permission catalog and custom-role backfill
-- Additive and backward-compatible: legacy users.manage and clients.manage remain.

-- 1. Permission records required before permission-based policies are activated.
INSERT INTO "permissions" ("code", "module", "action", "description", "is_active", "created_at", "updated_at")
VALUES
  ('users.view', 'users', 'view', 'Ver usuarios de la empresa', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('users.create', 'users', 'create', 'Crear usuarios en la empresa', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('users.update', 'users', 'update', 'Editar informacion de usuarios', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('users.assign-role', 'users', 'assign_role', 'Asignar rol a usuario', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('roles.view', 'roles', 'view', 'Consultar roles y permisos disponibles', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('roles.manage', 'roles', 'manage', 'Crear y editar roles de la empresa', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('clients.create', 'clients', 'create', 'Crear clientes y tiendas', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('clients.edit', 'clients', 'edit', 'Editar informacion de clientes', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('clients.references.create', 'clients', 'references_create', 'Agregar referencias a clientes', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('clients.documents.upload', 'clients', 'documents_upload', 'Subir documentos de clientes', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('clients.documents.download', 'clients', 'documents_download', 'Descargar documentos de clientes', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('clients.delete', 'clients', 'delete', 'Eliminar clientes mediante soft delete', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE
SET "module" = EXCLUDED."module",
    "action" = EXCLUDED."action",
    "description" = EXCLUDED."description",
    "is_active" = true,
    "updated_at" = CURRENT_TIMESTAMP;

-- 2. Global role bundle updates. root/admin get all new permissions. sales and
-- sales_supervisor keep historical company-wide client access via explicit clients.view.all.
INSERT INTO "role_permissions" ("role_id", "permission_id", "is_enabled", "created_at", "updated_at")
SELECT r."id", p."id", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Role" AS r
CROSS JOIN "permissions" AS p
WHERE r."code" IN ('root', 'admin')
  AND p."code" IN (
    'users.view', 'users.create', 'users.update', 'users.assign-role', 'roles.view', 'roles.manage',
    'clients.create', 'clients.edit', 'clients.references.create', 'clients.documents.upload',
    'clients.documents.download', 'clients.delete'
  )
ON CONFLICT ("role_id", "permission_id") DO UPDATE
SET "is_enabled" = true, "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "role_permissions" ("role_id", "permission_id", "is_enabled", "created_at", "updated_at")
SELECT r."id", p."id", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Role" AS r
CROSS JOIN "permissions" AS p
WHERE r."code" IN ('sales', 'sales_supervisor')
  AND p."code" IN (
    'clients.view.all', 'clients.create', 'clients.edit', 'clients.references.create',
    'clients.documents.upload', 'clients.documents.download'
  )
ON CONFLICT ("role_id", "permission_id") DO UPDATE
SET "is_enabled" = true, "updated_at" = CURRENT_TIMESTAMP;

-- 3. Custom-role legacy backfill. users.manage decomposes into all FB6 permissions.
INSERT INTO "role_permissions" ("role_id", "permission_id", "is_enabled", "created_at", "updated_at")
SELECT DISTINCT legacy_rp."role_id", new_permission."id", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "role_permissions" AS legacy_rp
JOIN "Role" AS role_row ON role_row."id" = legacy_rp."role_id"
JOIN "permissions" AS legacy_permission ON legacy_permission."id" = legacy_rp."permission_id"
JOIN "permissions" AS new_permission ON new_permission."code" IN (
  'users.view', 'users.create', 'users.update', 'users.assign-role', 'roles.view', 'roles.manage'
)
WHERE role_row."company_id" IS NOT NULL
  AND legacy_permission."code" = 'users.manage'
  AND legacy_rp."is_enabled" = true
ON CONFLICT ("role_id", "permission_id") DO UPDATE
SET "is_enabled" = true, "updated_at" = CURRENT_TIMESTAMP;

-- clients.manage decomposes into scoped read + granular FB7 write/document permissions only.
-- It intentionally does NOT grant clients.view.all, clients.delete, or clients.credit.manage.
INSERT INTO "role_permissions" ("role_id", "permission_id", "is_enabled", "created_at", "updated_at")
SELECT DISTINCT legacy_rp."role_id", new_permission."id", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "role_permissions" AS legacy_rp
JOIN "Role" AS role_row ON role_row."id" = legacy_rp."role_id"
JOIN "permissions" AS legacy_permission ON legacy_permission."id" = legacy_rp."permission_id"
JOIN "permissions" AS new_permission ON new_permission."code" IN (
  'clients.view', 'clients.create', 'clients.edit', 'clients.references.create',
  'clients.documents.upload', 'clients.documents.download'
)
WHERE role_row."company_id" IS NOT NULL
  AND legacy_permission."code" = 'clients.manage'
  AND legacy_rp."is_enabled" = true
ON CONFLICT ("role_id", "permission_id") DO UPDATE
SET "is_enabled" = true, "updated_at" = CURRENT_TIMESTAMP;
