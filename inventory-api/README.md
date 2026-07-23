# inventory-api backend

Backend de la plataforma de inventario interno definida por el PRD. Expone una API REST para operar catalogos, clientes, productos, pedidos, facturas, pagos e inventario, usando una arquitectura por capas sobre PostgreSQL.

## Stack

- Node.js
- Express
- Prisma
- PostgreSQL
- Docker
- JWT
- bcrypt
- Zod

## Alcance del producto

El PRD plantea una plataforma web responsive para centralizar:

- inventario por bodega
- bodegas de cuarentena, proceso y producto terminado con disponibilidad configurable para venta
- ficha de cuarentena/aprobación para ingresos con lote interno y lote del manufacturador
- productos, categorias, subclasificaciones, proveedores y lotes
- proveeduria con proveedores, productos ofrecidos, materias primas sustitutas, ordenes de compra e ingreso a inventario
- flujo de compra por minimo, cotizaciones diarias, aprobacion gerencial, cuenta por pagar, COA, AQL, cuarentena y etiquetas de lote
- categorias para materia prima, envases, tapas, etiquetas, producto terminado y miscelaneos
- facturacion con pedidos, aprobacion administrativa, credito/cobro, proforma, factura, XML a Hacienda y pagos parciales
- pagos de contado, contra entrega y credito con comprobantes, abonos a facturas, recibos de dinero, tesoreria y conciliacion de efectivo de agentes
- notas de credito/debito ligadas a factura, Hacienda, saldo a favor/deuda, devoluciones por lote y decision de QA
- historial completo de pedidos y estados, incluyendo rechazado, aceptado, cancelado, facturado, entregado con firma, pagado y vencido
- clientes, credito comercial y aprobaciones
- productos vendibles no fisicos: cursos con cupos y afiliaciones recurrentes usando lotes en bodegas virtuales separadas
- zonas, subzonas, rutas y agentes comerciales para ventas y seguimiento
- jerarquia de ventas con gerente, supervisor y agente
- hojas de cobro, inventario, conozca a sus clientes y ruta para agentes
- tiendas con latitud, longitud, referencia, horario, representantes y razon social
- referencias, documentos, limite de credito y deuda inicial en alta de cliente
- metas comerciales por agente, incluyendo clientes nuevos creados
- analitica historica de ventas por zona, subzona y formato
- permisos configurables por rol para aprobaciones y operaciones criticas
- produccion con formulas, BOM, costos por etapa, precio minimo con margen, dispensado, QA por etapa, llenado, loteo, etiquetado, rendimiento, producto terminado y merma
- versiones historicas de formulas cuando se aceptan materias primas sustitutas
- catalogo para activar/desactivar productos terminados
- precio general por producto terminado y ajustes por promocion, bonificacion o regalia
- reportes, dashboards y exportaciones
- auditoria e historial de acciones criticas

Los ERD de `docs/` aterrizan ese alcance en dos niveles:

- `docs/er_mvp_prd.md` define el modelo minimo viable
- `docs/er_propuesto_prd.md` define el modelo ampliado recomendado

## Estado implementado

Esta base ya incluye:

- configuracion por variables de entorno
- autenticacion con JWT
- contrasenas con bcrypt
- validacion de payloads con Zod
- manejo centralizado de errores
- Prisma como capa de acceso a datos
- migracion inicial versionada
- seed de datos demo
- separacion por `routes`, `services`, `repositories`, `schemas`, `middlewares` y `lib`
- CRUD base de empresas, usuarios, clientes, productos, pedidos, facturas y pagos
- movimientos de inventario para entradas, ajustes, reservas, liberaciones y salidas
- flujo dedicado de facturacion: crear pedido, aprobar condiciones, revisar credito, generar proforma, facturar y registrar XML/respuesta de Hacienda
- UI demo de bodega para importar productos desde Excel por bloques
- dashboard root para crear, listar, activar y deshabilitar empresas globales
- dashboard ejecutivo para administradores de empresa dentro de su tenant, expuesto en el alias semántico `/api/companies/company/dashboard` y conservando compatibilidad con el path legacy `/api/companies/root/dashboard`
- sidebar de administracion con acceso a dashboard, usuarios y roles de empresa
- creacion de usuarios dentro de la empresa del administrador
- roles personalizados por empresa con seleccion de permisos
- autorizacion por permisos finos para bodega, productos e inventario

## Dominios cubiertos en el schema actual

> Importante: esta sección describe lo que está **modelado en Prisma**. No debe interpretarse automáticamente como un módulo runtime completo ni como una API operable ya soportada.

El schema Prisma actual ya modela:

- empresas y configuracion
- roles globales, roles por empresa y usuarios
- permisos configurables por rol
- zonas, subzonas y rutas comerciales
- clientes, contactos y referencias
- zonas, subzonas, rutas comerciales y actividades de seguimiento
- inventario, categorias y subclasificaciones
- productos, proveedores y lotes
- movimientos de stock
- formulas, componentes y BOM
- costos de materia prima, mano de obra, energia y agua por etapa para calcular precio minimo con margen
- flujo de produccion con orden administrativa, aprobacion de gerente, dispensado, QA, transformacion, llenado, loteo, etiquetado y almacenamiento
- rendimiento teorico vs recibido por bodega y merma de proceso con datos fuente persistidos
- pedidos y detalle
- facturas y pagos
- ordenes e items de produccion

## Baseline de alcance runtime

Para congelar el alcance real del repositorio, use como referencia principal:

- `docs/current-state.md`
- `docs/architecture.md`
- `docs/runtime-endpoint-catalog.md`
- `docs/runtime-contract-manifest.json`
- `docs/ui-guidelines.md`

Ese baseline separa explícitamente:

- capacidades implementadas y verificables en runtime
- capacidades documentadas pero no soportadas todavía como módulo operable
- capacidades parciales o condicionadas
- endpoints legacy o rutas preservadas por compatibilidad
- contratos observables entre la UI embebida y la API

## Frontera real backend/frontend

La separación real actual del repositorio es la siguiente:

- `src/routes/`, `src/services/`, `src/repositories/`, `src/lib/` y `src/middlewares/` forman el backend ejecutable
- `src/public/` forma parte del runtime real porque `src/app.js` lo sirve con `express.static(...)`
- no existe en este repositorio un proyecto frontend separado, con build independiente o pipeline autónomo verificable
- por lo tanto, la UI embebida no debe tratarse como demo descartable: es una superficie soportada del backend y sus contratos deben mantenerse gobernados junto con la API

Use estos documentos como referencia contractual:

- `docs/runtime-endpoint-catalog.md`
- `docs/runtime-contract-manifest.json`
- `docs/ui-guidelines.md`
- `docs/production-baseline.md`
- `docs/p7-risk-closure-evidence.md`

## Evidencia P7 de cierre de riesgos

Para revisar el cierre incremental de riesgos P7 sin reinterpretar el alcance, use como punto de entrada:

- `docs/p7-risk-closure-evidence.md`

Ese artefacto resume:

- endurecimiento runtime de `RawUnsafe`;
- caracterización de fallos parciales DB/filesystem;
- baseline y drift governance de endpoints pesados priorizados;
- formalización contractual entre runtime montado y OpenAPI parcial;
- riesgos residuales aceptados y comandos de validación reproducible.

## Quality gates versionados

El repositorio versiona los siguientes workflows de baseline y gobernanza en GitHub Actions:

- `.github/workflows/static-checks.yml`
- `.github/workflows/contract-validations.yml`
- `.github/workflows/repository-tests.yml`
- `.github/workflows/windows-prisma-build.yml`
- `.github/workflows/browser-e2e.yml`
- `.github/workflows/operational-smoke.yml`
- `.github/workflows/build-and-publish.yml`

En conjunto cubren instalación, generación de Prisma, validaciones de contratos, test suite, browser E2E, smoke operativo y el gate dedicado de Prisma/Windows en `push`, `pull_request` y `workflow_dispatch` según corresponda.

Para el estado auditable del riesgo Prisma/Windows y la evidencia CI consolidada, use como fuente primaria:

- `docs/prisma-windows-stability-evidence.md`

## CD parcial versionado sin deploy

El repositorio incluye además un workflow controlado de build/publicación en:

- `.github/workflows/build-and-publish.yml`

Características del flujo:

- se activa solo por tag `v*` o por `workflow_dispatch`
- ejecuta `npm ci`, `npm run build` y `npm run verify` antes de empaquetar
- el riesgo Prisma/Windows queda gobernado además por `windows-prisma-build.yml`, que ejecuta `npm ci` + `npm run build` en `windows-latest`
- construye una imagen Docker versionada
- publica artefactos reproducibles en GitHub Actions mediante `upload-artifact`
- no realiza despliegue automático a ningún ambiente
- no requiere secretos de registry para el baseline actual

Artefactos publicados por corrida:

- imagen Docker comprimida (`.docker-image.tar.gz`)
- checksum SHA-256
- metadata JSON de release

## Gaps frente al PRD/ERD

Aunque el backend ya es funcional, todavia no cubre completo el alcance del PRD. Los puntos principales pendientes son:

- motor transversal completo de `ApprovalRequest` y aprobaciones críticas del PRD más allá del baseline mínimo ya integrado
- producción real operable con estados propios, doble aprobación, consumo, salida y merma expuesta como módulo usable
- reportes y exportaciones como superficie runtime completa
- cualquier otra capacidad descrita solo por PRD/ERD sin ruta, servicio y flujo runtime verificable

## Bootstrap privado de seeds

Las credenciales bootstrap/demo ya no viven en el repositorio.

Antes de ejecutar `npm run prisma:seed`, configure de forma privada y fuera de Git estas variables de entorno:

- `SEED_ROOT_PASSWORD`
- `SEED_ADMIN_PASSWORD`
- `SEED_SALES_PASSWORD`
- `SEED_SALES_AGENT_PASSWORD`
- `SEED_SALES_SUPERVISOR_PASSWORD`
- `SEED_WAREHOUSE_PASSWORD`

Use valores reales solo en archivos privados locales o en su gestor de secretos. No agregue estas credenciales a `README`, `docs/`, `prisma/seed.js` ni ningún archivo versionado.

## Estructura

- `src/` -> aplicacion HTTP
- `src/routes/` -> definicion de endpoints
- `src/services/` -> reglas de negocio
- `src/repositories/` -> acceso a datos
- `src/schemas/` -> validaciones Zod
- `src/middlewares/` -> autenticacion, autorizacion y validacion
- `src/lib/` -> utilidades compartidas
- `src/public/` -> UI estática embebida servida por el mismo backend; forma parte del runtime soportado
- `prisma/` -> schema, migraciones y seed
- `docs/` -> PRD, ERD y documentacion tecnica
- `Dockerfile` -> imagen base
- `docker-compose.dev.yml` -> stack canónico de desarrollo local
- `docker-compose.yml` -> alias transicional dev-only hacia el flujo canónico

## Runtime soportado

Contrato explícito actual del repositorio:

- Node.js `20.x`
- `package.json` declara `"engines": { "node": ">=20 <21" }`
- la evidencia soportada del repositorio se valida localmente con los scripts versionados en `package.json` sobre Node 20
- `Dockerfile` base usa `node:20-bullseye-slim`

Fuera de este rango no se considera entorno soportado para la evidencia obligatoria de cierre P0. En esta implementación se observó drift local con Node 24, por lo que las validaciones canónicas deben ejecutarse con Node 20.

## Baseline productivo verificable

El repositorio incluye ahora un baseline productivo mínimo y versionado en:

- `Dockerfile`
- `docker-compose.prod.yml`
- `.env.production.example`
- `scripts/validate-production-baseline.js`
- `docs/production-baseline.md`

Flujo resumido:

1. copiar `.env.production.example` a `.env.production`
2. ejecutar `npm run validate:production-baseline`
3. ejecutar `docker compose -f docker-compose.prod.yml build`
4. ejecutar `docker compose -f docker-compose.prod.yml up -d db`
5. ejecutar `docker compose -f docker-compose.prod.yml run --rm migrate`
6. ejecutar `docker compose -f docker-compose.prod.yml up -d app`
7. verificar `/health` y `/health/ready`

Límites explícitos del baseline:

- no sustituye una estrategia cloud específica
- no incluye TLS, reverse proxy ni backups automatizados
- no debe interpretarse como production-ready total fuera de lo versionado

## Baseline mínimo de hardening para autenticación, payloads, browser runtime y OpenAPI factual

El runtime actual aplica un endurecimiento incremental verificable en backend y UI embebida:

- throttling proxy-aware/shared-store-ready en `POST /api/auth/login`
- ventana de observación para login: 15 minutos
- bloqueo temporal tras 5 fallos autenticables por combinación `IP + username`
- throttling adicional segmentado para lookups autenticados costosos:
  - `GET /api/geocoding/search`
  - `GET /api/taxpayers/lookup`
- política explícita de `trust proxy` configurable por entorno en `src/config.js` / `src/app.js`
- abstracción `ThrottleStore` con implementación actual `InMemoryThrottleStore`, preparada para un backend compartido futuro sin introducir Redis todavía
- política de payload por clases con excepciones finas por endpoint:
  - payload pequeño por defecto: `256kb`
  - payload medio para superficies CRUD estructuradas: `1mb`
  - payload alto `25mb` solo para excepciones justificadas:
    - `POST /api/clients/:clientId/documents`
    - `POST /api/products/import`
    - `POST /api/payments`
    - `PUT /api/payments/:id`
- quality gates browser-first sobre `src/public`:
  - `npm run lint:public-runtime`
  - `npm run validate:public-runtime`
  - contratos críticos de login, sesión protegida, navegación y fetch autenticado para pantallas priorizadas
- OpenAPI factual parcial ampliado en `docs/openapi/runtime-baseline.openapi.json`, con validación automática contra rutas montadas

Límites explícitos de este hardening:

- la implementación activa del throttling sigue siendo local mientras no se apruebe un store compartido real para multiinstancia
- las excepciones de payload alto se mantienen por compatibilidad con documentos, importaciones y comprobantes base64 actualmente soportados
- los checks de `src/public` siguen siendo estáticos/browser-first; no ejecutan un navegador real
- el OpenAPI sigue siendo parcial y factual; no documenta todo el monolito
- sigue siendo recomendable endurecer también en infraestructura externa cuando exista

## Arranque local

1. Copiar `.env.example` a `.env`
2. Ejecutar `npm install`
3. Ejecutar `npm run prisma:generate`
4. Ejecutar `npx prisma migrate dev --name init`
5. Ejecutar `npm run prisma:seed`
6. Ejecutar `npm run dev`

### Nota para Windows

Si PowerShell bloquea `npm` o `npx` por politicas de ejecucion, use:

```powershell
npm.cmd install
npm.cmd run prisma:generate
npx.cmd prisma migrate dev --name init
```

Si Prisma falla de forma intermitente en Windows con errores tipo `EPERM`, locks sobre `query_engine-windows.dll.node` o problemas al regenerar el client, use el wrapper soportado del repositorio y esta mitigación local:

Resumen corto de mitigación local:

1. cierre procesos Node/Prisma que puedan tener abierto el engine (`npm run dev`, `node --test`, shells duplicados, watchers, IDEs con terminal activa)
2. prefiera `npm.cmd` / `npx.cmd` en vez de `npm` / `npx` cuando el shell lo requiera
3. regenere Prisma Client con:

```powershell
npm.cmd run prisma:generate
```

4. si persiste el lock, elimine el contenido temporal de `node_modules/.prisma/client` y vuelva a ejecutar `npm.cmd run prisma:generate`
5. revise antivirus/Windows Defender/exclusiones si el DLL vuelve a quedar bloqueado
6. solo despues reintente `npm run build`, migraciones o tests dependientes de Prisma

Importante:

- esta guia reduce friccion local, pero no garantiza eliminar todas las causas ambientales del file-lock
- el repositorio ahora versiona un gate dedicado en GitHub Actions: `.github/workflows/windows-prisma-build.yml`, enfocado en `npm ci` + `npm run build` sobre `windows-latest`
- si el problema reaparece durante validaciones, documentelo como falla ambiental y no lo atribuya automaticamente al cambio funcional en curso

## Quality gates

## Contract summary

Los scripts soportados del repositorio para validación del backend son:

| Script | Tipo | Propósito | Obligatorio en baseline P1 |
|---|---|---|---|
| `npm run lint` | gate individual | validación estática del backend, scripts, tests y `src/public/**/*.js` | Sí |
| `npm run lint:public-runtime` | gate individual | lint browser-first explícito para `src/public/**/*.js` | Sí |
| `npm run typecheck` | gate individual | verificación de tipos JS con `tsc --noEmit` sobre alcance aprobado | Sí |
| `npm run validate:public-runtime` | gate individual | validación de sintaxis JS + referencias locales HTML en `src/public/` | Sí |
| `npm run build` | gate individual | generación de Prisma Client requerida por runtime | Sí |
| `npm run test` | gate individual | suites automatizadas obligatorias del backend | Sí |
| `npm run verify` | gate agregado | ejecución fail-fast de `lint + typecheck + lint:public-runtime + validate:public-runtime + validate:workflow-baseline + validate:operational-readiness + build + test` | Sí |
| `npm run validate:agent-workspace` | diagnóstico | validación adicional de workspace/agente fuera del gate obligatorio | No |

Reglas de uso del contrato actual:

- `verify` reutiliza exactamente los mismos scripts obligatorios definidos de forma individual, incluyendo `validate:workflow-baseline` y `validate:operational-readiness`.
- `src/public` ya no depende solo del gate sintáctico: queda cubierto además por `lint:public-runtime` y por validación de referencias HTML locales.
- `validate:agent-workspace` permanece como diagnóstico opcional mientras no forme parte del gate obligatorio aprobado.
- La evidencia canónica del repositorio debe seguir ejecutándose con Node 20, aunque localmente puedan observarse otros runtimes.

### Lint

El gate inicial de lint se ejecuta con:

```bash
npm run lint
```

Alcance obligatorio actual:

- `src/**/*.js`
- `scripts/**/*.js`
- `tests/**/*.js`
- `src/public/**/*.js`

Exclusiones explícitas del lint general:

- `node_modules/**`
- `storage/**`
- `back_end/**`
- `front_end/**`
- `prisma/migrations/**`
- archivos `*.log`

La UI embebida deja de ser una excepción muda: `src/public/**` participa del lint general con configuración browser-first y además conserva su gate explícito `npm run lint:public-runtime`.

### Typecheck

El gate inicial de typecheck se ejecuta con:

```bash
npm run typecheck
```

Configuración:

- `tsconfig.typecheck.json`
- `typescript` en modo `noEmit`
- `allowJs` + `checkJs`

Alcance inicial obligatorio para P0:

- `src/app.js`
- `src/server.js`
- `src/config.js`
- `src/lib/**/*.js`
- `src/middlewares/**/*.js`
- `src/routes/**/*.js`
- `src/services/**/*.js`
- `scripts/generate-local-project-map.js`
- `scripts/migrate-client-documents-to-private-storage.js`

Exclusiones explícitas en esta iteración del typecheck general:

- `src/public/**`
- `src/repositories/**`
- `src/schemas/**`
- `tests/**`
- `prisma/**`
- `scripts/validate-agent-workspace.js`
- `node_modules/**`
- `storage/**`
- `back_end/**`
- `front_end/**`

La postura aprobada para `src/public/` sigue siendo incremental: se mantiene fuera del typecheck general orientado a backend/Node, pero deja de estar subgobernada porque `npm run lint:public-runtime` valida JS browser-first, `npm run validate:public-runtime` cubre sintaxis y referencias HTML locales, y `tests/public-surface-characterization.test.js` preserva sus contratos runtime críticos.

Además, algunos hotspots con tipado Prisma/Zod quedaron marcados con `// @ts-nocheck` de forma localizada y documentada para mantener un gate real sin rediseñar los repositorios en esta iteración P0.

### Automated tests

El gate obligatorio de pruebas para el cierre P0 se ejecuta con:

```bash
npm test
```

Suites obligatorias actuales:

- `tests/logging.test.js`
- `tests/client-tenant-scope.test.js`
- `tests/invoice-tenant-scope.test.js`
- `tests/payment-tenant-scope.test.js`
- `tests/client-document-security.test.js`

Validación diagnóstica opcional separada del cierre P0 actual:

```bash
npm run validate:agent-workspace
```

Esta validación adicional permanece fuera del gate obligatorio porque hoy falla en baseline y no forma parte del paquete mínimo de estabilización ya aceptado para P0/P1.

### Verify

El gate agregado fail-fast se ejecuta con:

```bash
npm run verify
```

Orden actual de ejecución:

1. `npm run lint`
2. `npm run typecheck`
3. `npm run build`
4. `npm run test`

El comando falla en el primer gate obligatorio que falle y reutiliza exactamente los mismos scripts definidos para ejecución individual.

### Build

El gate inicial de build se ejecuta con:

```bash
npm run build
```

Definición actual de build para este backend:

- ejecuta el wrapper versionado `node scripts/prisma-generate-safe.js` para generar Prisma Client
- valida que el Prisma Client requerido por el runtime quede generado sin crear artefactos de compilación adicionales
- corresponde al paso de preparación de runtime usado también por el `Dockerfile`

Salida esperada:

- Prisma Client generado/actualizado en `node_modules/@prisma/client`

Prerequisitos:

- dependencias instaladas
- `prisma/schema.prisma` disponible
- variables de entorno mínimas legibles por Prisma (`.env` o entorno equivalente)

## Arranque con Docker

Para la clasificación oficial dev/local vs productivo, use también:

- `docs/runtime-deployment-reality.md`

El flujo oficial de Docker Compose comprometido en este repositorio es **solo para desarrollo local**.

Archivo canónico:

- `docker-compose.dev.yml`

Comando oficial desde `inventory-api/`:

```bash
docker compose -f docker-compose.dev.yml up --build
```

El archivo `docker-compose.yml` se conserva solo como alias transicional dev-only. No debe tratarse como manifiesto productivo ni como ruta canónica nueva.

Antes de levantar Compose:

1. copie `.env.example` a `.env`
2. reemplace los placeholders locales de `POSTGRES_PASSWORD`, `DATABASE_URL` y `JWT_SECRET`
3. aplique las migraciones Prisma requeridas para su entorno

El contenedor de la app no ejecuta migraciones automaticamente al arrancar. Primero aplique migraciones con Prisma y luego levante Docker.

Importante para validacion de replay P2:

- el Compose canónico usa variables externas desde `.env`; no quedan secretos operativos inline en el manifiesto versionado
- la imagen Docker publica un `HEALTHCHECK` que consulta `GET /health/ready`
- `GET /health` se mantiene como liveness backward compatible
- `GET /health/ready` valida disponibilidad mínima de base de datos para readiness
- la secuencia canónica de replay, constraints y auditoría se documenta en `prisma/migration-instructions.md`
- para evidencia reproducible use `docker compose --env-file .env.example -f docker-compose.dev.yml ...` y no mezcle comandos paralelos sobre la misma base disposable

Si cambia la imagen base, Prisma o dependencias del contenedor, use reconstruccion completa sobre el archivo canónico:

```bash
docker compose -f docker-compose.dev.yml down
docker compose -f docker-compose.dev.yml build --no-cache
docker compose -f docker-compose.dev.yml up
```

## Validación operativa P2

Checklist mínimo recomendado desde `inventory-api/`:

```bash
docker compose --env-file .env.example -f docker-compose.dev.yml config
npm run lint
npm run typecheck
npm run build
npm test
```

Guía detallada de replay y migraciones:
- `prisma/migration-instructions.md`

Resumen operativo:
- desarrollo local canónico: `docker compose -f docker-compose.dev.yml up --build`
- liveness HTTP: `GET /health`
- readiness / healthcheck de contenedor: `GET /health/ready`
- replay de constraints: base disposable + `npm run prisma:apply-committed-migrations` + `tests/p2-hardening-constraints.test.js`
- auditoría transversal: eventos persistidos en `audit_events` para login, denegaciones de seguridad/autorización, pedidos, pagos, facturas, inventario sensible y cambios administrativos priorizados
- estrategia productiva: no debe considerarse cerrada solo por estos artefactos; revise `docs/runtime-deployment-reality.md`

## Auditoría transversal P2

Cobertura inicial implementada:

- `auth.login` para login exitoso y rechazado
- `security.authentication`, `security.authorization.role` y `security.authorization.permission` para denegaciones de seguridad
- `orders.create`, `orders.update`, `orders.approve`, `orders.cancel`, `orders.dispatch`, `orders.delete`
- `payments.create`, `payments.update`, `payments.reverse`
- `invoices.create`, `invoices.update`, `invoices.cancel`
- `companies.create`, `companies.root.create`, `companies.root.status.update`
- `users.create`, `users.company.create`
- `roles.company.create`
- `inventory.stock_entry.register`, `inventory.lot.qa.update`, `inventory.stock.adjust`

Garantías de esta iteración:

- se registra `requestId`, actor, recurso, acción y resultado cuando el contexto existe
- no se persisten contraseñas, hashes, tokens ni secretos en `metadata`, `before_state` o `after_state`
- las denegaciones de seguridad operan con estrategia fail-open defensiva si la persistencia de auditoría no está disponible

## Matriz operativa de actores administrativos

La siguiente tabla refleja el comportamiento **verificado en runtime** para las acciones administrativas sensibles. Distingue hechos actuales del código y notas de compatibilidad.

| Actor | Endpoint / acción | Alcance actual | Observaciones |
|---|---|---|---|
| Root global (`role = root`, `companyId = null`) | `GET /api/companies` | Global | Endpoint legacy preservado por compatibilidad. Solo root puede listar empresas. |
| Root global (`role = root`, `companyId = null`) | `POST /api/companies` | Global | Endpoint legacy preservado por compatibilidad. Solo root puede crear empresas. |
| Root global (`role = root`, `companyId = null`) | `GET /api/companies/root/companies` | Global | Flujo explícito root-only para listado ampliado de empresas. |
| Root global (`role = root`, `companyId = null`) | `POST /api/companies/root/companies` | Global | Flujo explícito root-only para registrar empresa, config fiscal y admin inicial. |
| Root global (`role = root`, `companyId = null`) | `PATCH /api/companies/root/companies/:companyId/status` | Global | Activación/desactivación global de empresas. |
| Admin de empresa (`role = admin`, `companyId != null`) | `GET /api/companies/company/dashboard` | Tenant propio | Ruta semántica recomendada para el dashboard ejecutivo del admin de empresa. |
| Admin de empresa (`role = admin`, `companyId != null`) | `GET /api/companies/root/dashboard` | Tenant propio | Alias legacy conservado por compatibilidad durante la migración. |
| Root global (`role = root`, `companyId = null`) | `GET /api/users` / `POST /api/users` | Global | Administración global de usuarios. |
| Admin de empresa (`role = admin`, `companyId != null`) | `GET /api/users/company` / `POST /api/users/company` | Tenant propio | Gestión de usuarios de su empresa autenticada. |
| Admin de empresa (`role = admin`, `companyId != null`) | `GET /api/roles/permissions` | Tenant propio | Consulta catálogo de permisos para armar roles internos. |
| Admin de empresa (`role = admin`, `companyId != null`) | `GET /api/roles/company` / `POST /api/roles/company` | Tenant propio | Gestión de roles personalizados dentro de la empresa autenticada. |

Notas de compatibilidad:

- `GET /api/companies` y `POST /api/companies` se mantienen como endpoints legacy, pero ya no aceptan admins de empresa.
- `GET /api/companies/company/dashboard` es el path semántico recomendado para la administración interna de empresa.
- `GET /api/companies/root/dashboard` se conserva como alias legacy engañoso para no romper clientes o bookmarks existentes; no representa un dashboard root global.
- La separación entre root global y admin de empresa no depende solo del nombre del rol; también depende de si el actor autenticado tiene `companyId`.

## Validación documental y contractual relevante

Para revalidar la evidencia operativa y contractual relacionada con P7 desde `inventory-api/`:

```bash
node --test tests/heavy-endpoint-governance.test.js tests/logging.test.js
node --test tests/openapi-contract-consistency.test.js tests/runtime-contract-governance.test.js
npm run test -- --silent
```

Notas:
- la suite completa puede mostrar `2 skipped` esperados cuando faltan `P2_CONSTRAINTS_DATABASE_URL` y `P2_AUDIT_DATABASE_URL`;
- esos skips corresponden a pruebas de integración environment-gated y no invalidan la evidencia P7 cerrada en esta fase.

## Endpoints

### Publicos

- `GET /health`
- `GET /health/ready`
- `POST /api/auth/login`

### Protegidos con JWT

- `GET /api/auth/me`
- `GET /api/companies` (root global; endpoint legacy compatible)
- `POST /api/companies` (root global; endpoint legacy compatible)
- `GET /api/companies/root/companies` (root global)
- `POST /api/companies/root/companies` (root global)
- `PATCH /api/companies/root/companies/:companyId/status` (root global)
- `GET /api/companies/company/dashboard` (admin de empresa sobre su propio tenant; path semántico recomendado)
- `GET /api/companies/root/dashboard` (admin de empresa sobre su propio tenant; alias legacy)
- `GET /api/roles/permissions`
- `GET /api/roles/company`
- `POST /api/roles/company`
- `GET /api/users`
- `POST /api/users`
- `GET /api/users/company`
- `POST /api/users/company`
- `GET /api/clients`
- `GET /api/clients/:id`
  - compatibilidad P1: `GET /api/clients` y `GET /api/clients/company` aceptan `page` y `pageSize`; cuando se envían, responden `{ items, pagination }`; sin esos query params preservan la respuesta legacy basada en arreglos
- `POST /api/clients`
- `PUT /api/clients/:id`
- `DELETE /api/clients/:id`
- `GET /api/products`
- `GET /api/products/:id`
  - compatibilidad P1: `GET /api/products` acepta `page` y `pageSize`; con paginación responde `{ items, pagination }`; sin esos query params preserva la respuesta legacy basada en arreglos
- `POST /api/products`
- `POST /api/products/import`
- `PUT /api/products/:id`
- `DELETE /api/products/:id`
- `GET /api/orders`
- `GET /api/orders/:id`
- `POST /api/orders`
- `PUT /api/orders/:id`
- `POST /api/orders/:id/approve`
- `POST /api/orders/:id/cancel`
- `POST /api/orders/:id/dispatch`
- `DELETE /api/orders/:id`
- `GET /api/invoices`
- `GET /api/invoices/:id`
  - compatibilidad P1: `GET /api/invoices` acepta `page` y `pageSize`; con paginación responde `{ items, pagination }`; sin esos query params preserva la respuesta legacy basada en arreglos
- `POST /api/invoices`
- `PUT /api/invoices/:id`
- `DELETE /api/invoices/:id`
- `GET /api/payments`
- `GET /api/payments/:id`
  - compatibilidad P1: `GET /api/payments` acepta `page` y `pageSize`; con paginación responde `{ items, pagination }`; sin esos query params preserva la respuesta legacy basada en arreglos
- `POST /api/payments`
- `PUT /api/payments/:id`
- `DELETE /api/payments/:id`
- `GET /api/inventory/movements`
  - compatibilidad P1: `GET /api/inventory/movements` acepta `page` y `pageSize`; con paginación responde `{ items, pagination }`; sin esos query params preserva la respuesta legacy basada en arreglos
- `POST /api/inventory/entries`
- `POST /api/inventory/adjustments`

## Reglas actuales de inventario y pedidos

- Los pedidos se crean en `DRAFT`
- Solo pedidos en `DRAFT` se pueden editar
- Todo producto debe tener categoria principal y subclasificacion
- El catalogo debe cubrir materia prima, envases, tapas, etiquetas, producto terminado y miscelaneos
- Solo proveeduria crea articulos nuevos; administracion/proveeduria gestionan categorias, descripciones y precios segun permisos
- Proveeduria registra proveedores, productos que venden, sustitutos y ordenes de compra
- El regente de produccion mantiene unidad, densidad y conversion tecnica para formulas
- Una materia prima sustituta aceptada puede generar una nueva version historica de formula
- Miscelaneos cubre productos de limpieza, material de oficina y otros insumos de soporte
- Los permisos se configuran por rol o tipo de usuario desde administracion
- Cada tipo de aprobacion valida el permiso requerido antes de permitir aprobar
- Salidas, entradas y transferencias entre bodegas pueden requerir permisos diferentes
- Todo cliente debe estar asignado a una subzona, y cada subzona pertenece a una zona
- Las rutas agrupan subzonas y se asignan a agentes comerciales
- Las actividades de venta y seguimiento registran cliente, agente, ruta, estado y fecha
- Gerente de ventas, supervisor y agente operan con permisos configurables por alcance
- El agente registra cobros, inventario de ruta, conozca a sus clientes y bitacora de visita
- La alta de cliente propuesta por agente distingue cliente de contado y cliente con solicitud de credito
- La solicitud de credito se envia a credito y cobro; si se apertura, se crea o confirma el codigo del cliente
- Las clasificaciones de cliente son configurables por root
- Una razon social puede tener varias tiendas; cada tienda conserva ubicacion con latitud/longitud, referencia, horario y representantes
- El alta de cliente contempla referencias, documentos, limite solicitado/aprobado y deuda inicial cuando aplique
- El agente creador del cliente queda registrado y puede alimentar metas comerciales
- El status activo del cliente depende de compras en los ultimos `n` meses configurables
- La frecuencia de pago alimenta una metrica de confianza configurable por root
- Las ventas pueden graficarse historicamente por zona, subzona y formato con ponderados mensuales
- Solo bodegas habilitadas como fuente de venta pueden facturar y descontar inventario
- Productos de ingreso deben registrar lote interno, lote del manufacturador y ficha de cuarentena/QA
- Cada etapa de movimiento entre bodegas requiere autorización de usuario encargado con permiso activo
- Lotes vencidos, en cuarentena o con QA rechazado/fallido no pueden venderse
- Lotes cercanos a vencimiento deben generar alerta
- Salidas extraordinarias por vencimiento, falla QA u otro motivo deben registrar motivo y generar alerta cuando aplique
- Los productos terminados se desactivan desde el catalogo, sin borrar historial
- Un producto terminado inactivo no se puede agregar a pedidos nuevos
- Todo producto terminado vendible debe tener precio general activo
- Las formulas maestras solo pueden usar materias primas existentes y deben sumar 100%
- El BOM se genera automaticamente desde la formula maestra y la cantidad solicitada
- La promocion, bonificacion o regalia modifica el precio final desde el precio general
- El detalle del pedido conserva precio general usado, ajuste aplicado y precio final historico
- Cualquier usuario autorizado puede registrar pedidos en facturacion
- Administrativo aprueba condiciones comerciales del pedido
- Credito y cobro aprueba pedidos a credito revisando saldo, historico y facturas abiertas
- Bodega genera proforma y factura, envia XML a Hacienda y registra la respuesta
- El inventario se descuenta hasta facturar, generando movimiento `OUT` ligado a la factura
- El transportista confirma la entrega con firma de recibido y datos de quien recibe
- Todo cambio de estado del pedido queda en historial auditable
- Todo pago requiere comprobante adjunto
- Los pagos parciales se registran como abonos a facturas y generan recibo de dinero
- El efectivo recibido por agentes se coteja contra sistema y administrativo firma recibido
- La factura conserva lote por item; devoluciones con nota de credito requieren cotejo administrativo del lote y decision de QA
- La nota de debito aumenta deuda sobre factura y tambien se registra ante Hacienda
- Entradas manuales registran movimiento `IN`
- Ajustes manuales registran movimiento `ADJUSTMENT`
- Todo cambio de inventario debe generar `StockMovement`

## Credenciales demo

Las credenciales de bootstrap/demo ya no se versionan en el repositorio.

Para entornos controlados, configure valores privados fuera de Git mediante las variables `SEED_*_PASSWORD` antes de ejecutar `npm run prisma:seed`.

## Documentacion util

- `docs/Proyecto Inventario Interno - Prd V1.pdf`
- `docs/prd_actualizacion_catalogo_precios.md`
- `docs/facturacion_hacienda_costa_rica.md`
- `docs/mvp_1_prd.md`
- `docs/erd_mvp_1.mmd`
- `docs/er_mvp_prd.md`
- `docs/er_propuesto_prd.md`

## Nota de alcance

El backend actual es una base operativa del producto, no el cierre completo del MVP. Antes de ampliar pantallas o CRUDs aislados, conviene alinear el modelo con multi-bodega, lotes obligatorios, aprobaciones, auditoria, credito y produccion real.
