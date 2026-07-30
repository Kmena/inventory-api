# Permission Governance Decisions

## 1. Purpose
Este documento resume las decisiones de gobierno de permisos derivadas del análisis `p10-permission-governance`.

Su objetivo es explicar, en lenguaje operativo, cómo deberían evolucionar los roles personalizados antes de ampliar más la navegación por módulos o endurecer la UI de administración de roles.

Después de `p28-flexible-permission-governance-foundation`, este documento ya no describe solo una idea futura: ahora acompaña una base técnica implementada en `src/security/permission-governance.config.js`, `src/security/role-bundles.config.js` y `src/security/permission-governance.service.js`. Aun así, la mayor parte de las reglas aquí descritas siguen siendo guía o postura de warning, no bloqueos amplios ya aplicados en producción.

## 2. Estado actual y conclusión
El repositorio ya tiene una base útil de permisos, y desde `p28` también tiene una base central reusable de gobierno, pero el modelo runtime sigue siendo híbrido:
- mezcla reglas por rol legacy y permisos finos;
- permite crear roles de empresa con combinaciones amplias de permisos activos;
- no separa todavía de forma enforceada los permisos operativos de los sensibles.

### Conclusión principal
No se recomienda seguir ampliando navegación o administración de roles como si el modelo ya estuviera totalmente gobernado.

La recomendación es:
1. preservar la flexibilidad de roles mixtos;
2. dejar de tratar todos los permisos como checkboxes equivalentes;
3. introducir bundles base y reglas explícitas para permisos sensibles;
4. endurecer primero el backend de creación de roles antes de construir una UI más ambiciosa alrededor de esos permisos.

## 3. Qué es un bundle
Un bundle es un perfil base preaprobado de negocio.

No elimina el uso de permisos finos, pero cambia el punto de partida:
- antes: un rol nace desde una selección libre de permisos;
- después: un rol nace desde un bundle base;
- luego: se agregan extensiones operativas permitidas;
- y los permisos sensibles quedan sujetos a advertencia, revisión o prohibición.

## 4. Estructura recomendada de un bundle
Cada bundle debería definir al menos:
- `id`
- `label`
- `basePermissionCodes`
- `allowedAdditions`
- `sensitiveAdditions`
- `forbiddenPermissions`
- `notes`

### Ejemplo conceptual
```json
{
  "id": "sales_agent",
  "label": "Agente comercial",
  "basePermissionCodes": [
    "clients.view",
    "sales.orders.create",
    "sales.routes.view.own",
    "sales.goals.view.own",
    "customer.activities.manage"
  ],
  "allowedAdditions": [
    "collections.manage.own",
    "clients.manage"
  ],
  "sensitiveAdditions": [],
  "forbiddenPermissions": [
    "companies.manage",
    "users.manage",
    "settings.manage",
    "collections.payments.approve",
    "collections.payments.reverse",
    "inventory.approve",
    "inventory.qa.manage"
  ]
}
```

## 5. Bundles base recomendados
Estos bundles son una recomendación inicial de gobierno. No equivalen todavía a comportamiento implementado en producción.

### 5.1 `warehouse_operator`
**Base sugerida**
- `warehouse.access`
- `products.view`
- `products.import`
- `products.manage`
- `inventory.view`
- `inventory.manage`
- `procurement.manage`

**Extensiones permitidas**
- `clients.view` cuando exista operación cruzada real

**Permisos sensibles o restringidos**
- `inventory.qa.manage`
- `inventory.approve`

**Intención**
Operar bodega, productos e inventario sin concentrar aprobaciones excepcionales.

### 5.2 `sales_agent`
**Base sugerida**
- `clients.view`
- `sales.orders.create`
- `sales.routes.view.own`
- `sales.goals.view.own`
- `customer.activities.manage`

**Extensiones permitidas**
- `collections.manage.own`
- `clients.manage` si la operación lo justifica

**Permisos sensibles o restringidos**
- `collections.payments.approve`
- `collections.payments.reverse`
- `sales.routes.assign`
- `sales.goals.assign`

**Intención**
Vender, visitar y registrar actividad, con posible cobranza propia, pero sin aprobar ni coordinar capacidades sensibles.

### 5.3 `sales_supervisor`
**Base sugerida**
- `clients.view`
- `clients.view.all`
- `clients.manage`
- `sales.manage`
- `sales.orders.create`
- `sales.routes.view.own`
- `sales.routes.view.all`
- `sales.routes.assign`
- `sales.goals.view.own`
- `sales.goals.view.all`
- `sales.goals.assign`
- `customer.activities.manage`
- `customer.activities.view.all`
- `collections.view.all`
- `collections.assign`

**Permisos sensibles adicionales**
- `collections.payments.approve`
- `collections.payments.reverse`

**Intención**
Supervisión comercial real, manteniendo la aprobación financiera como capacidad especialmente sensible.

### 5.4 `company_admin`
**Base sugerida**
- `users.manage`
- `settings.manage`
- permisos operativos amplios del tenant según necesidad real

**No debe incluir**
- `companies.manage`

**Advertencia**
Si además combina operación diaria amplia, se acerca a una concentración de privilegios que debe quedar al menos advertida y auditada.

### 5.5 `platform_root`
**Base sugerida**
- permisos globales de plataforma

**Regla**
No debe ser un bundle asignable por administradores de empresa.

### 5.6 `production_future`
Estado recomendado:
- `in_process`

La razón es que el catálogo actual todavía no describe un módulo de Producción suficientemente gobernable como bundle operativo estable.

## 6. Permisos sensibles iniciales recomendados
La siguiente lista es una propuesta inicial de permisos que deben tratarse como sensibles hasta nueva validación:

### 6.1 Plataforma y administración
- `companies.manage`
- `users.manage`
- `settings.manage`

### 6.2 Inventario excepcional
- `inventory.qa.manage`
- `inventory.approve`

### 6.3 Supervisión con impacto operativo alto
- `sales.routes.assign`
- `sales.goals.assign`
- `collections.assign`

### 6.4 Financiero y cobranza
- `collections.payments.approve`
- `collections.payments.reverse`

## 6.5 Tabla explicativa de permisos sensibles
| Permiso | Qué habilita | Ámbito esperado | Por qué es sensible |
|---|---|---|---|
| `companies.manage` | Administrar compañías a nivel de plataforma o alta administración global | Plataforma | Puede alterar entidades de compañía y no corresponde a admins tenant comunes |
| `users.manage` | Crear, editar, activar, desactivar o administrar usuarios | Empresa / tenant | Permite controlar quién entra al sistema y con qué capacidades |
| `settings.manage` | Cambiar configuraciones relevantes de operación | Empresa / tenant | Puede modificar comportamiento general del tenant y afectar múltiples módulos |
| `inventory.qa.manage` | Gestionar controles o decisiones excepcionales de calidad en inventario | Empresa / tenant | Introduce poder sobre validaciones excepcionales o flujo de calidad |
| `inventory.approve` | Aprobar movimientos o decisiones sensibles de inventario | Empresa / tenant | Otorga capacidad de autorización material sobre inventario |
| `sales.routes.assign` | Asignar rutas comerciales a usuarios o equipos | Empresa / tenant | Cambia coordinación operativa y distribución de trabajo comercial |
| `sales.goals.assign` | Asignar metas comerciales | Empresa / tenant | Influye en objetivos, seguimiento y presión operativa del equipo |
| `collections.assign` | Asignar gestión de cobranza | Empresa / tenant | Controla distribución de trabajo sobre cuentas por cobrar |
| `collections.payments.approve` | Aprobar pagos o registros de cobranza sujetos a validación | Empresa / tenant | Tiene impacto financiero directo en el reconocimiento/aprobación de cobros |
| `collections.payments.reverse` | Revertir pagos o decisiones financieras previamente aceptadas | Empresa / tenant | Tiene impacto financiero alto y riesgo de fraude/error si se combina sin control |

## 7. Clasificación práctica de sensibilidad
### 7.1 Permisos básicos
Permiten operar o ver sin aprobar, revertir ni configurar.

Ejemplos:
- `clients.view`
- `products.view`
- `inventory.view`
- `sales.routes.view.own`
- `sales.goals.view.own`

### 7.2 Permisos de supervisión
Aumentan visibilidad, coordinación o alcance organizacional.

Ejemplos:
- `clients.view.all`
- `customer.activities.view.all`
- `sales.routes.view.all`
- `sales.goals.view.all`
- `procurement.manage`
- `sales.manage`

### 7.3 Permisos sensibles
Cambian configuración, autorizan, revierten o concentran poder operativo.

Ejemplos:
- `users.manage`
- `settings.manage`
- `companies.manage`
- `inventory.approve`
- `inventory.qa.manage`
- `collections.payments.approve`
- `collections.payments.reverse`

## 8. Reglas recomendadas de combinación
### 8.1 Permitidas
Ejemplos razonables:
- `sales_agent` + `collections.manage.own`
- `sales_supervisor` + `collections.view.all`
- `warehouse_operator` + extensiones operativas no sensibles

### 8.2 Permitidas con advertencia
Ejemplos de alto alcance, pero no necesariamente prohibidos:
- `company_admin` + operación comercial amplia
- `users.manage` + capacidades operativas extensas
- `settings.manage` + varios módulos operativos

Estas combinaciones deberían generar al menos:
- warning explícito;
- auditoría reforzada;
- y, si el producto lo permite después, revisión manual recomendada.

### 8.3 Restringidas o prohibidas
Ejemplos de combinaciones que no deberían quedar libres:
- `companies.manage` dentro de roles de empresa
- `collections.payments.reverse` + `inventory.approve` + `inventory.qa.manage`
- aprobaciones financieras sensibles combinadas libremente con aprobaciones excepcionales de inventario
- privilegios de plataforma mezclados con creación ordinaria de roles tenant

### 8.4 Primera regla estable recomendada
Mientras negocio termina de aprobar la política completa, la primera regla dura recomendada es:
- **solo un `root` global puede crear compañías nuevas**.
- un `admin` de empresa o cualquier otro rol tenant **no** debe poder crear compañías.

Todo lo demás puede empezar como:
- clasificación visual de sensibilidad;
- warning estructurado;
- auditoría reforzada;
- revisión futura para decidir si luego pasa a `deny`.

## 9. Qué debería hacer el hardening futuro
La siguiente implementación recomendada no es reescribir todo RBAC. El objetivo es endurecer la creación de roles nuevos.

### 9.1 Backend
Endurecer `POST /api/roles/company` para:
- validar combinaciones sensibles;
- impedir permisos fuera del ámbito empresa;
- rechazar permisos no activos o desconocidos;
- introducir bundles base y extensiones gobernadas;
- separar reglas de permitidos, advertidos y prohibidos;
- reforzar auditoría de intentos exitosos y fallidos.

### 9.2 UI
Después del hardening backend:
- reemplazar la selección plana por un constructor guiado;
- separar visualmente permisos operativos y sensibles;
- partir de bundle base en vez de una grilla vacía.

## 10. Qué no debe asumirse
Este documento no significa que:
- los bundles ya estén implementados;
- los permisos sensibles ya estén bloqueados en producción;
- la UI actual ya impida combinaciones inseguras;
- el sidebar nuevo ya pueda asumir autorización fina consistente en todos los módulos.

## 11. Siguiente paso recomendado
El siguiente paso recomendado es un spec de implementación para hardening de creación de roles de empresa, con foco en:
1. validación backend de combinaciones sensibles;
2. prohibición de capacidades de plataforma en roles tenant;
3. bundles base y extensiones compatibles;
4. pruebas de creación permitida, advertida y rechazada;
5. preservación del comportamiento actual no relacionado.

## 12. Relación con la navegación por módulos
La navegación futura debería apoyarse solo en módulos:
- ya mapeables con permisos actuales, o
- parcialmente mapeables con deuda explícita documentada.

Módulos como Producción, Reportes transversales o Aprobaciones transversales no deberían presentarse como gobernados de forma madura hasta que exista soporte real de permisos.
