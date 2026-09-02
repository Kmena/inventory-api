-- Backfill: asignar settings.manage a los roles globales root y admin.
--
-- settings.manage fue definido desde el inicio en permissionDefinitions del seed.
-- Sin embargo, bases de datos inicializadas solo con migraciones (sin seed completo),
-- o donde los role_permissions fueron parcialmente actualizados, pueden no tener
-- esta asignacion en la tabla role_permissions.
--
-- Este permiso es requerido por la politica de acceso role.company.update:
--   mode: 'permission', permissions: ['settings.manage']
--
-- Sin esta asignacion, el boton "Editar" en #roles_permissions no aparece
-- para el administrador de empresa aunque la API lo permitiria.

INSERT INTO "role_permissions" ("role_id", "permission_id", "is_enabled", "created_at", "updated_at")
SELECT r."id", p."id", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Role" AS r
CROSS JOIN "permissions" AS p
WHERE r."code" IN ('root', 'admin')
  AND p."code" = 'settings.manage'
ON CONFLICT ("role_id", "permission_id") DO UPDATE
SET
  "is_enabled" = true,
  "updated_at" = CURRENT_TIMESTAMP;
