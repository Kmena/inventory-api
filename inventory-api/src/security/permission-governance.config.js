const { ROLE_BUNDLES } = require('./role-bundles.config');

const PERMISSION_METADATA = Object.freeze([
  Object.freeze({ code: 'companies.manage', category: 'platform', sensitivity: 'sensitive', scope: 'platform', uiLabel: 'Administrar compañías', notes: 'Solo plataforma' }),
  Object.freeze({ code: 'users.manage', category: 'administration', sensitivity: 'sensitive', scope: 'tenant', uiLabel: 'Administrar usuarios', notes: 'Capacidad administrativa sensible' }),
  Object.freeze({ code: 'settings.manage', category: 'administration', sensitivity: 'sensitive', scope: 'tenant', uiLabel: 'Administrar configuración', notes: 'Capacidad administrativa sensible' }),
  Object.freeze({ code: 'inventory.qa.manage', category: 'inventory', sensitivity: 'sensitive', scope: 'tenant', uiLabel: 'Gestionar QA de inventario', notes: 'Capacidad excepcional de inventario' }),
  Object.freeze({ code: 'inventory.approve', category: 'inventory', sensitivity: 'sensitive', scope: 'tenant', uiLabel: 'Aprobar inventario', notes: 'Capacidad excepcional de inventario' }),
  Object.freeze({ code: 'sales.routes.assign', category: 'sales', sensitivity: 'sensitive', scope: 'tenant', uiLabel: 'Asignar rutas', notes: 'Capacidad de coordinación operativa' }),
  Object.freeze({ code: 'sales.goals.assign', category: 'sales', sensitivity: 'sensitive', scope: 'tenant', uiLabel: 'Asignar metas', notes: 'Capacidad de coordinación operativa' }),
  Object.freeze({ code: 'collections.assign', category: 'collections', sensitivity: 'sensitive', scope: 'tenant', uiLabel: 'Asignar cobranza', notes: 'Capacidad de coordinación operativa' }),
  Object.freeze({ code: 'collections.payments.approve', category: 'collections', sensitivity: 'sensitive', scope: 'tenant', uiLabel: 'Aprobar pagos', notes: 'Capacidad financiera sensible' }),
  Object.freeze({ code: 'collections.payments.reverse', category: 'collections', sensitivity: 'sensitive', scope: 'tenant', uiLabel: 'Revertir pagos', notes: 'Capacidad financiera sensible' }),
]);

const GOVERNED_OPERATIONS = Object.freeze([
  Object.freeze({ operation: 'company.create', phase: 'first-stable-deny', enforcement: 'deny', status: 'approved' }),
  Object.freeze({ operation: 'role.company.create', phase: 'warning-foundation', enforcement: 'warn', status: 'proposed' }),
  Object.freeze({ operation: 'role.company.update', phase: 'warning-foundation', enforcement: 'warn', status: 'proposed' }),
  Object.freeze({ operation: 'permission-guided-view', phase: 'ui-guidance', enforcement: 'warn', status: 'proposed' }),
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
    appliesTo: Object.freeze(['role.company.create']),
    status: 'approved',
    restrictedScope: 'platform',
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
