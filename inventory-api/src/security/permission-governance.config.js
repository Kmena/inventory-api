const { ROLE_BUNDLES } = require('./role-bundles.config');

const PERMISSION_METADATA = Object.freeze([
  // ── Landing permissions ────────────────────────────────────────────
  // permissionKind: 'landing' — determina el shell principal del rol.
  // exclusiveGroup: 'primary-landing' — solo uno por rol tenant.
  Object.freeze({ code: 'root.access', category: 'landing', sensitivity: 'operational', scope: 'tenant', uiLabel: 'Acceso al panel administrativo', notes: 'Shell principal: /root/ — panel de empresa', permissionKind: 'landing', landingTarget: 'root', exclusiveGroup: 'primary-landing' }),
  Object.freeze({ code: 'warehouse.access', category: 'landing', sensitivity: 'operational', scope: 'tenant', uiLabel: 'Acceso al espacio operativo de bodega', notes: 'Shell principal: /warehouse/ — SPA operativo de bodega/producción/QA', permissionKind: 'landing', landingTarget: 'warehouse', exclusiveGroup: 'primary-landing' }),
  Object.freeze({ code: 'agent.access', category: 'landing', sensitivity: 'operational', scope: 'tenant', uiLabel: 'Acceso al espacio de agente comercial', notes: 'Shell principal: /agent/ — SPA operativo de ventas', permissionKind: 'landing', landingTarget: 'agent', exclusiveGroup: 'primary-landing' }),

  // ── Platform permissions ───────────────────────────────────────────
  Object.freeze({ code: 'companies.manage', category: 'platform', sensitivity: 'sensitive', scope: 'platform', uiLabel: 'Administrar compañías', notes: 'Solo plataforma' }),

  // ── Administrative permissions ─────────────────────────────────────
  Object.freeze({ code: 'users.manage', category: 'administration', sensitivity: 'sensitive', scope: 'tenant', uiLabel: 'Administrar usuarios', notes: 'Permiso legacy transicional para administracion de usuarios' }),
  Object.freeze({ code: 'users.view', category: 'administration', sensitivity: 'operational', scope: 'tenant', uiLabel: 'Ver usuarios de la empresa', notes: 'Consulta lista y detalle de usuarios de la empresa' }),
  Object.freeze({ code: 'users.create', category: 'administration', sensitivity: 'sensitive', scope: 'tenant', uiLabel: 'Crear usuarios', notes: 'Crear nuevos usuarios en la empresa con un rol inicial' }),
  Object.freeze({ code: 'users.update', category: 'administration', sensitivity: 'sensitive', scope: 'tenant', uiLabel: 'Editar usuarios', notes: 'Editar informacion basica de usuarios existentes' }),
  Object.freeze({ code: 'users.assign-role', category: 'administration', sensitivity: 'sensitive', scope: 'tenant', uiLabel: 'Asignar rol a usuario', notes: 'Cambiar el rol asignado a un usuario existente' }),
  Object.freeze({ code: 'roles.view', category: 'administration', sensitivity: 'operational', scope: 'tenant', uiLabel: 'Ver roles', notes: 'Consultar roles y permisos disponibles de la empresa' }),
  Object.freeze({ code: 'roles.manage', category: 'administration', sensitivity: 'sensitive', scope: 'tenant', uiLabel: 'Gestionar roles', notes: 'Crear y editar roles de la empresa y sus permisos' }),
  Object.freeze({ code: 'settings.manage', category: 'administration', sensitivity: 'sensitive', scope: 'tenant', uiLabel: 'Administrar configuración', notes: 'Capacidad administrativa sensible' }),
  Object.freeze({ code: 'clients.manage', category: 'clients', sensitivity: 'operational', scope: 'tenant', uiLabel: 'Gestionar clientes', notes: 'Permiso legacy transicional para crear, editar y actualizar clientes' }),
  Object.freeze({ code: 'clients.credit.manage', category: 'clients', sensitivity: 'sensitive', scope: 'tenant', uiLabel: 'Aprobar y modificar credito de tiendas', notes: 'Establecer y modificar limite de credito por tienda' }),
  Object.freeze({ code: 'clients.view', category: 'clients', sensitivity: 'operational', scope: 'tenant', uiLabel: 'Ver clientes asignados', notes: 'Ver informacion de clientes dentro del alcance de rutas y tiendas asignadas' }),
  Object.freeze({ code: 'clients.view.all', category: 'clients', sensitivity: 'operational', scope: 'tenant', uiLabel: 'Ver todos los clientes', notes: 'Ver informacion de todos los clientes de la empresa sin editar' }),
  Object.freeze({ code: 'clients.create', category: 'clients', sensitivity: 'operational', scope: 'tenant', uiLabel: 'Crear clientes', notes: 'Crear clientes y tiendas de la empresa' }),
  Object.freeze({ code: 'clients.edit', category: 'clients', sensitivity: 'operational', scope: 'tenant', uiLabel: 'Editar clientes', notes: 'Editar informacion general de clientes existentes' }),
  Object.freeze({ code: 'clients.references.create', category: 'clients', sensitivity: 'operational', scope: 'tenant', uiLabel: 'Agregar referencias', notes: 'Agregar referencias comerciales a clientes' }),
  Object.freeze({ code: 'clients.documents.upload', category: 'clients', sensitivity: 'operational', scope: 'tenant', uiLabel: 'Subir documentos de clientes', notes: 'Subir documentos a clientes y tiendas' }),
  Object.freeze({ code: 'clients.documents.download', category: 'clients', sensitivity: 'sensitive', scope: 'tenant', uiLabel: 'Descargar documentos de clientes', notes: 'Descargar documentos privados de clientes' }),
  Object.freeze({ code: 'clients.delete', category: 'clients', sensitivity: 'sensitive', scope: 'tenant', uiLabel: 'Eliminar clientes', notes: 'Desactivar clientes de la empresa mediante soft delete' }),
  Object.freeze({ code: 'products.manage', category: 'products', sensitivity: 'operational', scope: 'tenant', uiLabel: 'Gestionar artículos', notes: 'Crear y actualizar artículos del catálogo' }),
  Object.freeze({ code: 'products.view', category: 'products', sensitivity: 'operational', scope: 'tenant', uiLabel: 'Ver artículos', notes: 'Ver artículos del catálogo' }),
  Object.freeze({ code: 'products.import', category: 'products', sensitivity: 'operational', scope: 'tenant', uiLabel: 'Importar artículos', notes: 'Importar artículos desde Excel' }),
  Object.freeze({ code: 'inventory.manage', category: 'inventory', sensitivity: 'operational', scope: 'tenant', uiLabel: 'Gestionar inventario', notes: 'Gestionar bodegas, lotes y movimientos' }),
  Object.freeze({ code: 'inventory.view', category: 'inventory', sensitivity: 'operational', scope: 'tenant', uiLabel: 'Ver inventario', notes: 'Ver inventario y movimientos' }),
  Object.freeze({ code: 'sales.manage', category: 'sales', sensitivity: 'operational', scope: 'tenant', uiLabel: 'Gestionar ventas', notes: 'Gestionar pedidos, facturas y pagos' }),
  Object.freeze({ code: 'sales.orders.create', category: 'sales', sensitivity: 'operational', scope: 'tenant', uiLabel: 'Crear pedidos', notes: 'Crear pedidos comerciales' }),
  Object.freeze({ code: 'sales.routes.view.own', category: 'sales', sensitivity: 'operational', scope: 'tenant', uiLabel: 'Ver rutas propias', notes: 'Ver rutas asignadas al agente' }),
  Object.freeze({ code: 'sales.routes.view.all', category: 'sales', sensitivity: 'operational', scope: 'tenant', uiLabel: 'Ver todas las rutas', notes: 'Ver todas las rutas comerciales' }),
  Object.freeze({ code: 'sales.goals.view.own', category: 'sales', sensitivity: 'operational', scope: 'tenant', uiLabel: 'Ver metas propias', notes: 'Ver metas propias del agente' }),
  Object.freeze({ code: 'sales.goals.view.all', category: 'sales', sensitivity: 'operational', scope: 'tenant', uiLabel: 'Ver todas las metas', notes: 'Ver metas de todos los agentes' }),
  Object.freeze({ code: 'customer.activities.manage', category: 'sales', sensitivity: 'operational', scope: 'tenant', uiLabel: 'Registrar actividades comerciales', notes: 'Registrar visitas, gestiones y seguimiento comercial' }),
  Object.freeze({ code: 'customer.activities.view.all', category: 'sales', sensitivity: 'operational', scope: 'tenant', uiLabel: 'Ver actividades del equipo', notes: 'Ver actividades comerciales de todo el equipo' }),
  Object.freeze({ code: 'collections.manage.own', category: 'collections', sensitivity: 'operational', scope: 'tenant', uiLabel: 'Registrar cobros propios', notes: 'Registrar cobros propios del agente' }),
  Object.freeze({ code: 'collections.view.all', category: 'collections', sensitivity: 'operational', scope: 'tenant', uiLabel: 'Ver cobros del equipo', notes: 'Ver cobros del equipo comercial' }),
  Object.freeze({ code: 'inventory.qa.manage', category: 'inventory', sensitivity: 'sensitive', scope: 'tenant', uiLabel: 'Gestionar QA de inventario', notes: 'Capacidad excepcional de inventario' }),
  Object.freeze({ code: 'inventory.approve', category: 'inventory', sensitivity: 'sensitive', scope: 'tenant', uiLabel: 'Aprobar inventario', notes: 'Capacidad excepcional de inventario' }),
  // warehouse.access ya está declarado arriba como landing permission
  Object.freeze({ code: 'warehouse.receive', category: 'warehouse', sensitivity: 'operational', scope: 'tenant', uiLabel: 'Ejecutar recepciones de bodega', notes: 'Habilita las pestañas de Recepciones e Inventario en el SPA operativo de bodega' }),
  Object.freeze({ code: 'products.sourcing.view', category: 'supply', sensitivity: 'operational', scope: 'tenant', uiLabel: 'Ver clasificación de abastecimiento', notes: 'Consulta de sourcing e inventario del producto' }),
  Object.freeze({ code: 'products.sourcing.manage', category: 'supply', sensitivity: 'sensitive', scope: 'tenant', uiLabel: 'Gestionar clasificación de abastecimiento', notes: 'Configura sourcing, costos, bodegas y metadatos físicos del producto' }),
  Object.freeze({ code: 'suppliers.view', category: 'procurement', sensitivity: 'operational', scope: 'tenant', uiLabel: 'Ver proveedores autorizados', notes: 'Consulta catálogo y autorizaciones de proveedores' }),
  Object.freeze({ code: 'suppliers.manage', category: 'procurement', sensitivity: 'sensitive', scope: 'tenant', uiLabel: 'Gestionar proveedores autorizados', notes: 'Administra proveedores y autorizaciones por producto' }),
  Object.freeze({ code: 'recipes.view', category: 'production', sensitivity: 'operational', scope: 'tenant', uiLabel: 'Ver recetas y versiones', notes: 'Consulta administrativa de recetas' }),
  Object.freeze({ code: 'recipes.operations.view', category: 'production', sensitivity: 'operational', scope: 'tenant', uiLabel: 'Consultar fórmulas operativas congeladas', notes: 'Solo consulta operacional de la receta/version congelada en órdenes de producción' }),
  Object.freeze({ code: 'recipes.manage', category: 'production', sensitivity: 'sensitive', scope: 'tenant', uiLabel: 'Gestionar recetas y versiones', notes: 'Crea y edita recetas y borradores de versión' }),
  Object.freeze({ code: 'recipes.approve', category: 'production', sensitivity: 'sensitive', scope: 'tenant', uiLabel: 'Aprobar versiones de receta', notes: 'Aprueba versiones inmutables de receta' }),
  Object.freeze({ code: 'production.view', category: 'production', sensitivity: 'operational', scope: 'tenant', uiLabel: 'Ver órdenes de producción', notes: 'Consulta y seguimiento de órdenes de producción' }),
  Object.freeze({ code: 'production.create', category: 'production', sensitivity: 'sensitive', scope: 'tenant', uiLabel: 'Crear órdenes de producción', notes: 'Crea y envía órdenes de producción' }),
  Object.freeze({ code: 'production.approve', category: 'production', sensitivity: 'sensitive', scope: 'tenant', uiLabel: 'Aprobar órdenes de producción', notes: 'Aprueba órdenes antes de ejecución' }),
  Object.freeze({ code: 'production.execute', category: 'production', sensitivity: 'operational', scope: 'tenant', uiLabel: 'Ejecutar producción', notes: 'Registra etapas, consumos y evidencias de producción' }),
  Object.freeze({ code: 'production.complete', category: 'production', sensitivity: 'sensitive', scope: 'tenant', uiLabel: 'Completar producción', notes: 'Cierra producción y habilita la entrada por producción' }),
  Object.freeze({ code: 'production.cancel', category: 'production', sensitivity: 'sensitive', scope: 'tenant', uiLabel: 'Cancelar producción', notes: 'Cancela órdenes de producción' }),
  Object.freeze({ code: 'production.override', category: 'production', sensitivity: 'sensitive', scope: 'tenant', uiLabel: 'Sobrescribir guardas de producción', notes: 'Permite producir sin receta/sourcing válido solo con justificación', requiresJustification: true }),
  Object.freeze({ code: 'quality.view', category: 'quality', sensitivity: 'operational', scope: 'tenant', uiLabel: 'Ver inspecciones QA', notes: 'Consulta inspecciones QA de producción y recepción' }),
  Object.freeze({ code: 'quality.inspect', category: 'quality', sensitivity: 'operational', scope: 'tenant', uiLabel: 'Registrar inspecciones QA', notes: 'Registra resultados QA y evidencia' }),
  Object.freeze({ code: 'quality.override', category: 'quality', sensitivity: 'sensitive', scope: 'tenant', uiLabel: 'Sobrescribir bloqueo QA', notes: 'Permite acciones excepcionales sobre bloqueos QA con justificación', requiresJustification: true }),
  Object.freeze({ code: 'procurement.view', category: 'procurement', sensitivity: 'operational', scope: 'tenant', uiLabel: 'Ver abastecimiento', notes: 'Consulta solicitudes, cotizaciones y órdenes de compra' }),
  Object.freeze({ code: 'procurement.manage', category: 'procurement', sensitivity: 'sensitive', scope: 'tenant', uiLabel: 'Gestionar abastecimiento', notes: 'Gestiona solicitudes, cotizaciones, comparativos y órdenes de compra' }),
  Object.freeze({ code: 'procurement.approve', category: 'procurement', sensitivity: 'sensitive', scope: 'tenant', uiLabel: 'Aprobar selección de proveedor', notes: 'Aprueba selección/proceso de compra según umbrales' }),
  Object.freeze({ code: 'procurement.override', category: 'procurement', sensitivity: 'sensitive', scope: 'tenant', uiLabel: 'Sobrescribir guardas de compra', notes: 'Permite comprar sin proveedor autorizado solo con justificación', requiresJustification: true }),
  Object.freeze({ code: 'receipts.view', category: 'warehouse', sensitivity: 'operational', scope: 'tenant', uiLabel: 'Ver recepciones', notes: 'Consulta documentos de recepción y su estado' }),
  Object.freeze({ code: 'receipts.inspect', category: 'warehouse', sensitivity: 'operational', scope: 'tenant', uiLabel: 'Inspeccionar recepciones', notes: 'Inspecciona cantidades, calidad y evidencia en recepción' }),
  Object.freeze({ code: 'receipts.confirm', category: 'warehouse', sensitivity: 'sensitive', scope: 'tenant', uiLabel: 'Confirmar recepciones', notes: 'Confirma entradas físicas al inventario' }),
  Object.freeze({ code: 'receipts.reverse', category: 'warehouse', sensitivity: 'sensitive', scope: 'tenant', uiLabel: 'Revertir recepciones', notes: 'Revierte entradas confirmadas con historial controlado' }),
  Object.freeze({ code: 'inventory.intake.override', category: 'inventory', sensitivity: 'sensitive', scope: 'tenant', uiLabel: 'Sobrescribir validaciones de entrada', notes: 'Acción excepcional sobre validaciones de entrada con justificación', requiresJustification: true }),
  Object.freeze({ code: 'billing.handoff.view', category: 'billing-boundary', sensitivity: 'operational', scope: 'tenant', uiLabel: 'Ver handoff fiscal', notes: 'Consulta referencias y estado de handoff a Billing' }),
  Object.freeze({ code: 'billing.handoff.create', category: 'billing-boundary', sensitivity: 'sensitive', scope: 'tenant', uiLabel: 'Crear handoff fiscal', notes: 'Registra referencias pendientes hacia Billing/Hacienda' }),
  Object.freeze({ code: 'sales.routes.assign', category: 'sales', sensitivity: 'sensitive', scope: 'tenant', uiLabel: 'Asignar rutas', notes: 'Capacidad de coordinación operativa' }),
  Object.freeze({ code: 'sales.goals.assign', category: 'sales', sensitivity: 'sensitive', scope: 'tenant', uiLabel: 'Asignar metas', notes: 'Capacidad de coordinación operativa' }),
  Object.freeze({ code: 'collections.assign', category: 'collections', sensitivity: 'sensitive', scope: 'tenant', uiLabel: 'Asignar cobranza', notes: 'Capacidad de coordinación operativa' }),
  Object.freeze({ code: 'collections.payments.approve', category: 'collections', sensitivity: 'sensitive', scope: 'tenant', uiLabel: 'Aprobar pagos', notes: 'Capacidad financiera sensible' }),
  Object.freeze({ code: 'collections.payments.reverse', category: 'collections', sensitivity: 'sensitive', scope: 'tenant', uiLabel: 'Revertir pagos', notes: 'Capacidad financiera sensible' }),
  // MASTER-007 / NPP-TASK-014 — commercial entitlements (subscriptions,
  // memberships, courses). DEC-004 keeps manual activation separate from
  // entitlements.manage: 'entitlements.manage' does NOT include the manual
  // activation capability.
  Object.freeze({ code: 'entitlements.view', category: 'entitlements', sensitivity: 'operational', scope: 'tenant', uiLabel: 'Ver derechos comerciales', notes: 'Consulta suscripciones, memberships y cursos activos por cliente' }),
  Object.freeze({ code: 'entitlements.manage', category: 'entitlements', sensitivity: 'sensitive', scope: 'tenant', uiLabel: 'Gestionar derechos comerciales', notes: 'Crea, edita y cancela derechos comerciales — excluye activación manual' }),
  Object.freeze({ code: 'entitlements.activate.manual', category: 'entitlements', sensitivity: 'sensitive', scope: 'tenant', uiLabel: 'Activar derecho manualmente', notes: 'Activa un derecho sin aprobación de pago/crédito; requiere justificación', requiresJustification: true }),
  // MASTER-006 / INV-TASK-014 — inventory + locations permissions.
  // Stock-changing operations are sensitive; read-only listings are operational.
  Object.freeze({ code: 'inventory.initial-inventory.create', category: 'inventory', sensitivity: 'sensitive', scope: 'tenant', uiLabel: 'Registrar inventario inicial', notes: 'Carga única de existencias iniciales por producto y ubicación' }),
  Object.freeze({ code: 'inventory.transfers.create', category: 'inventory', sensitivity: 'sensitive', scope: 'tenant', uiLabel: 'Registrar traslados', notes: 'Movimiento atómico de stock entre ubicaciones' }),
  Object.freeze({ code: 'inventory.lots.list', category: 'inventory', sensitivity: 'operational', scope: 'tenant', uiLabel: 'Ver listado de lotes', notes: 'Consulta lotes existentes; incluye badges de lote de sistema' }),
  Object.freeze({ code: 'locations.view', category: 'locations', sensitivity: 'operational', scope: 'tenant', uiLabel: 'Ver ubicaciones', notes: 'Consulta ubicaciones activas y su naturaleza' }),
  Object.freeze({ code: 'locations.manage', category: 'locations', sensitivity: 'sensitive', scope: 'tenant', uiLabel: 'Gestionar ubicaciones', notes: 'Crear, editar y desactivar ubicaciones; controla allowedWarehouseIds' }),
  // inventory-requests spec — warehouse operator permission for async movement flow
  Object.freeze({ code: 'inventory.requests.execute', category: 'inventory', sensitivity: 'operational', scope: 'tenant', uiLabel: 'Ejecutar solicitudes de movimiento', notes: 'Permite al operador de bodega ejecutar solicitudes ADJUSTMENT y TRANSFER creadas por el admin' }),
]);

const GOVERNED_OPERATIONS = Object.freeze([
  Object.freeze({ operation: 'company.create', phase: 'first-stable-deny', enforcement: 'deny', status: 'approved' }),
  Object.freeze({ operation: 'role.company.create', phase: 'warning-foundation', enforcement: 'warn', status: 'proposed' }),
  Object.freeze({ operation: 'role.company.update', phase: 'warning-foundation', enforcement: 'warn', status: 'proposed' }),
  Object.freeze({ operation: 'permission-guided-view', phase: 'ui-guidance', enforcement: 'warn', status: 'proposed' }),
  Object.freeze({ operation: 'production.override', phase: 'permission-foundation', enforcement: 'approved', status: 'approved' }),
  Object.freeze({ operation: 'procurement.override', phase: 'permission-foundation', enforcement: 'approved', status: 'approved' }),
  Object.freeze({ operation: 'quality.override', phase: 'permission-foundation', enforcement: 'approved', status: 'approved' }),
  Object.freeze({ operation: 'inventory.intake.override', phase: 'permission-foundation', enforcement: 'approved', status: 'approved' }),
]);

const COMBINATION_RULES = Object.freeze([
  Object.freeze({
    ruleId: 'platform-root-only-company-create',
    description: 'Solo root global puede crear compañías nuevas',
    severity: 'deny',
    appliesTo: Object.freeze(['company.create']),
    status: 'approved',
  }),
  Object.freeze({
    ruleId: 'tenant-role-platform-permission-denied',
    description: 'Los roles de empresa no pueden incluir permisos de alcance plataforma',
    severity: 'deny',
    appliesTo: Object.freeze(['role.company.create', 'role.company.update']),
    status: 'approved',
    restrictedScope: 'platform',
  }),
  Object.freeze({
    ruleId: 'landing-primary-singleton',
    description: 'Un rol tenant solo puede tener un permiso de landing (exclusiveGroup: primary-landing)',
    severity: 'deny',
    appliesTo: Object.freeze(['role.company.create', 'role.company.update']),
    status: 'approved',
    exclusiveGroup: 'primary-landing',
  }),
  Object.freeze({
    ruleId: 'landing-required-for-tenant-role',
    description: 'Todo rol de empresa activo debe tener exactamente un permiso de landing',
    severity: 'deny',
    appliesTo: Object.freeze(['role.company.create', 'role.company.update']),
    status: 'approved',
    exclusiveGroup: 'primary-landing',
  }),
]);

const WARNING_CONTRACT_FIELDS = Object.freeze([
  'code',
  'ruleId',
  'message',
  'severity',
  'affectedPermissions',
  'status',
]);

const PERMISSION_GOVERNANCE_POLICY = Object.freeze({
  version: 1,
  bundles: ROLE_BUNDLES,
  permissionMetadata: PERMISSION_METADATA,
  governedOperations: GOVERNED_OPERATIONS,
  combinationRules: COMBINATION_RULES,
  warningContractFields: WARNING_CONTRACT_FIELDS,
});

module.exports = {
  PERMISSION_GOVERNANCE_POLICY,
  PERMISSION_METADATA,
  GOVERNED_OPERATIONS,
  COMBINATION_RULES,
  WARNING_CONTRACT_FIELDS,
};
