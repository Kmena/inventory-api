# Changelog

## 2025-08-11
- Creado paquete de especificación `p11-node24-runtime-migration`.
- Trazado el finding P0-003 reconciliado por P11 hacia un slice implementable de migración real a Node.js 24 LTS.
- Delimitada la evidencia de incompatibilidad Prisma/runtime bajo Node 24 y la separación respecto del baseline Windows Prisma rename-lock.
- Resueltas las open questions con prioridad explícita de no dañar tests, código actual, CI ni comportamiento externo durante la migración.
- Aprobado por el usuario para implementación como substream dedicado del P0-003 reconciliado por P11.

## 2025-08-11
- Migrado el baseline declarado del repositorio a Node.js 24 LTS en `package.json`, `Dockerfile` y workflows GitHub Actions.
- Actualizados los validadores y tests de gobernanza de workflows para exigir Node 24.
- Confirmado que el error histórico `PrismaClient is not a constructor` no se reproduce en un baseline limpio Node 24 (`npm ci` + `npm run build` + reruns de tests focalizados).
- Conservada la separación del baseline Windows Prisma `EPERM rename-lock`, con evidencia local de retry exitoso.
- Registrada validación local Node 24 para build, lint, typecheck, tests y validadores.
- Completadas con éxito las validaciones adicionales `npm run test:e2e:browser` y `docker build -t inventory-api:node24-smoke .`.
- Revisados los runs y artifacts públicos de `windows-prisma-build`; la evidencia hospedada disponible sigue siendo del baseline histórico Node 20, por lo que el cierre total continúa bloqueado hasta un run hospedado Node 24 del workflow actualizado.
