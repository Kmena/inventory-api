const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PERMISSION_GOVERNANCE_POLICY,
  WARNING_CONTRACT_FIELDS,
  isGlobalRootActor,
  createGovernanceWarning,
  getGovernedOperation,
  getPermissionMetadata,
  listPlatformScopedPermissionCodes,
  permissionRequiresJustification,
  listJustificationRequiredPermissionCodes,
  evaluateGovernanceOperation,
} = require('../src/security/permission-governance.service');

const PRODUCTION_PERMISSION_CODES = [
  'recipes.view',
  'recipes.operations.view',
  'recipes.manage',
  'recipes.approve',
  'production.view',
  'production.create',
  'production.approve',
  'production.execute',
  'production.complete',
  'production.cancel',
  'production.override',
];

test('permission governance foundation exposes centralized policy structure', () => {
  assert.equal(PERMISSION_GOVERNANCE_POLICY.version, 1);
  assert.ok(Array.isArray(PERMISSION_GOVERNANCE_POLICY.bundles));
  assert.ok(PERMISSION_GOVERNANCE_POLICY.bundles.some((bundle) => bundle.id === 'company_admin'));
  assert.ok(PERMISSION_GOVERNANCE_POLICY.bundles.some((bundle) => bundle.id === 'warehouse_operator'));
  assert.ok(PERMISSION_GOVERNANCE_POLICY.bundles.some((bundle) => bundle.id === 'production_operator'));
  assert.ok(PERMISSION_GOVERNANCE_POLICY.bundles.some((bundle) => bundle.id === 'qa_inspector'));
  assert.ok(PERMISSION_GOVERNANCE_POLICY.bundles.some((bundle) => bundle.id === 'procurement_operator'));
  assert.ok(PERMISSION_GOVERNANCE_POLICY.permissionMetadata.some((permission) => permission.code === 'companies.manage'));
  assert.ok(PERMISSION_GOVERNANCE_POLICY.permissionMetadata.some((permission) => permission.code === 'products.sourcing.manage'));
  assert.ok(PERMISSION_GOVERNANCE_POLICY.permissionMetadata.some((permission) => permission.code === 'production.override'));
  assert.ok(PERMISSION_GOVERNANCE_POLICY.permissionMetadata.some((permission) => permission.code === 'billing.handoff.view'));
  assert.ok(PERMISSION_GOVERNANCE_POLICY.combinationRules.some((rule) => rule.ruleId === 'platform-root-only-company-create'));
  assert.ok(PERMISSION_GOVERNANCE_POLICY.combinationRules.some((rule) => rule.ruleId === 'tenant-role-platform-permission-denied'));
});

test('warning contract fields remain explicit and reusable', () => {
  assert.deepEqual(WARNING_CONTRACT_FIELDS, ['code', 'ruleId', 'message', 'severity', 'affectedPermissions', 'status']);

  const warning = createGovernanceWarning({
    code: 'role.company.create.policy_pending',
    ruleId: 'role.company.create.policy_pending',
    message: 'Policy pending',
    affectedPermissions: ['users.manage'],
  });

  assert.equal(warning.code, 'role.company.create.policy_pending');
  assert.equal(warning.severity, 'warn');
  assert.deepEqual(warning.affectedPermissions, ['users.manage']);
  assert.equal(warning.status, 'proposed');
});

test('global root detection requires root role and no company assignment', () => {
  assert.equal(isGlobalRootActor({ role: 'root', companyId: null }), true);
  assert.equal(isGlobalRootActor({ role: 'root', companyId: '1' }), false);
  assert.equal(isGlobalRootActor({ role: 'admin', companyId: null }), false);
});

test('governed operations inventory identifies first stable company create rule', () => {
  const companyCreateOperation = getGovernedOperation('company.create');
  const roleCreateOperation = getGovernedOperation('role.company.create');

  assert.equal(companyCreateOperation.enforcement, 'deny');
  assert.equal(companyCreateOperation.status, 'approved');
  assert.equal(roleCreateOperation.enforcement, 'warn');
});

test('permission metadata exposes platform scope and helper identifies platform-scoped permissions', () => {
  assert.equal(getPermissionMetadata('companies.manage')?.scope, 'platform');
  assert.equal(getPermissionMetadata('warehouse.access')?.scope, 'tenant');
  assert.deepEqual(listPlatformScopedPermissionCodes(['inventory.manage', 'companies.manage', 'companies.manage']), ['companies.manage']);
});

test('override permissions explicitly require justification for future service enforcement', () => {
  assert.equal(permissionRequiresJustification('production.override'), true);
  assert.equal(permissionRequiresJustification('procurement.override'), true);
  assert.equal(permissionRequiresJustification('quality.override'), true);
  assert.equal(permissionRequiresJustification('inventory.intake.override'), true);
  assert.equal(permissionRequiresJustification('production.execute'), false);
  assert.deepEqual(
    listJustificationRequiredPermissionCodes([
      'production.override',
      'production.execute',
      'procurement.override',
      'inventory.intake.override',
      'production.override',
    ]),
    ['production.override', 'procurement.override', 'inventory.intake.override'],
  );
});

test('production permission catalog remains metadata-backed and company_admin includes the approved production families without QA drift', () => {
  const companyAdminBundle = PERMISSION_GOVERNANCE_POLICY.bundles.find((bundle) => bundle.id === 'company_admin');
  assert.ok(companyAdminBundle, 'company_admin bundle must exist');

  const missingCatalogCodes = PRODUCTION_PERMISSION_CODES.filter((code) => !PERMISSION_GOVERNANCE_POLICY.permissionMetadata.some((permission) => permission.code === code));
  assert.deepEqual(missingCatalogCodes, []);

  const productionCategoryCodes = PERMISSION_GOVERNANCE_POLICY.permissionMetadata
    .filter((permission) => permission.category === 'production')
    .map((permission) => permission.code)
    .sort();

  assert.deepEqual(productionCategoryCodes, [...PRODUCTION_PERMISSION_CODES].sort());

  const missingBundleCodes = PRODUCTION_PERMISSION_CODES.filter((code) => !companyAdminBundle.basePermissionCodes.includes(code));
  assert.deepEqual(missingBundleCodes, []);
  assert.equal(companyAdminBundle.basePermissionCodes.includes('quality.inspect'), false);
  assert.equal(companyAdminBundle.basePermissionCodes.includes('quality.override'), false);
});

test('company creation governance allows only global root and company-role creation denies platform-scoped permissions', () => {
  const allowed = evaluateGovernanceOperation('company.create', { auth: { role: 'root', companyId: null } });
  const denied = evaluateGovernanceOperation('company.create', { auth: { role: 'admin', companyId: '7' } });
  const roleDenied = evaluateGovernanceOperation('role.company.create', {
    auth: { role: 'admin', companyId: '7' },
    permissionCodes: ['inventory.manage', 'companies.manage'],
  });
  const warned = evaluateGovernanceOperation('role.company.create', {
    auth: { role: 'admin', companyId: '7' },
    permissionCodes: ['root.access', 'inventory.manage'],
  });

  assert.equal(allowed.decision, 'allow');
  assert.equal(allowed.warnings.length, 0);

  assert.equal(denied.decision, 'deny');
  assert.equal(denied.denial.code, 'platform_global_required');
  assert.equal(denied.denial.ruleId, 'platform-root-only-company-create');

  assert.equal(roleDenied.decision, 'deny');
  assert.equal(roleDenied.denial.code, 'platform_permission_not_assignable');
  assert.equal(roleDenied.denial.ruleId, 'tenant-role-platform-permission-denied');
  assert.deepEqual(roleDenied.denial.affectedPermissions, ['companies.manage']);

  assert.equal(warned.decision, 'allow');
  assert.equal(warned.warnings.length, 1);
  assert.equal(warned.warnings[0].severity, 'warn');
});
