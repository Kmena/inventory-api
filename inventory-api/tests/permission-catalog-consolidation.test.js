const test = require('node:test');
const assert = require('node:assert/strict');

const { PERMISSION_METADATA } = require('../src/security/permission-governance.config');

const REQUIRED_METADATA_FIELDS = ['code', 'category', 'sensitivity', 'scope', 'uiLabel', 'notes'];

test('every permission in metadata has all required presentation fields', () => {
  for (const entry of PERMISSION_METADATA) {
    for (const field of REQUIRED_METADATA_FIELDS) {
      assert.ok(
        entry[field] !== undefined && entry[field] !== null && String(entry[field]).trim().length > 0,
        `Permission ${entry.code} is missing required field: ${field}`,
      );
    }
  }
});

test('permission metadata codes are unique', () => {
  const codes = PERMISSION_METADATA.map((entry) => entry.code);
  const uniqueCodes = new Set(codes);
  assert.equal(codes.length, uniqueCodes.size, `Duplicate codes found: ${codes.filter((c, i) => codes.indexOf(c) !== i).join(', ')}`);
});

test('all seed permission definitions have corresponding governance metadata', () => {
  const seedPermissionCodes = [
    'companies.manage', 'users.manage', 'settings.manage', 'clients.manage', 'clients.view', 'clients.view.all',
    'products.manage', 'products.view', 'products.import', 'inventory.manage', 'inventory.view', 'inventory.qa.manage',
    'inventory.approve', 'warehouse.access', 'warehouse.receive', 'procurement.manage', 'sales.manage', 'sales.orders.create',
    'sales.routes.view.own', 'sales.routes.view.all', 'sales.routes.assign', 'sales.goals.view.own', 'sales.goals.view.all',
    'sales.goals.assign', 'customer.activities.manage', 'customer.activities.view.all',
    'collections.manage.own', 'collections.view.all', 'collections.assign', 'collections.payments.approve', 'collections.payments.reverse',
    'products.sourcing.view', 'products.sourcing.manage', 'suppliers.view', 'suppliers.manage',
    'recipes.view', 'recipes.operations.view', 'recipes.manage', 'recipes.approve',
    'production.view', 'production.create', 'production.approve', 'production.execute', 'production.complete', 'production.cancel', 'production.override',
    'quality.view', 'quality.inspect', 'quality.override',
    'procurement.view', 'procurement.approve', 'procurement.override',
    'receipts.view', 'receipts.inspect', 'receipts.confirm', 'receipts.reverse',
    'inventory.intake.override', 'billing.handoff.view', 'billing.handoff.create',
  ];

  const metadataCodes = new Set(PERMISSION_METADATA.map((entry) => entry.code));
  const missingMetadata = seedPermissionCodes.filter((code) => !metadataCodes.has(code));
  assert.equal(missingMetadata.length, 0, `Seed permissions missing governance metadata: ${missingMetadata.join(', ')}`);
});

test('every permission metadata entry has a valid scope value', () => {
  const validScopes = ['platform', 'tenant'];
  for (const entry of PERMISSION_METADATA) {
    assert.ok(validScopes.includes(entry.scope), `Permission ${entry.code} has invalid scope: ${entry.scope}`);
  }
});

test('every permission metadata entry has a valid sensitivity value', () => {
  const validSensitivities = ['operational', 'sensitive'];
  for (const entry of PERMISSION_METADATA) {
    assert.ok(validSensitivities.includes(entry.sensitivity), `Permission ${entry.code} has invalid sensitivity: ${entry.sensitivity}`);
  }
});

test('platform-scoped permissions are all marked sensitive', () => {
  const platformPermissions = PERMISSION_METADATA.filter((entry) => entry.scope === 'platform');
  for (const entry of platformPermissions) {
    assert.equal(entry.sensitivity, 'sensitive', `Platform permission ${entry.code} should be sensitive`);
  }
});

test('role.company.update governance denies platform-scoped permissions the same as role.company.create', () => {
  const { evaluateGovernanceOperation } = require('../src/security/permission-governance.service');

  const updateDenied = evaluateGovernanceOperation('role.company.update', {
    auth: { role: 'admin', companyId: '7' },
    permissionCodes: ['inventory.manage', 'companies.manage'],
  });
  assert.equal(updateDenied.decision, 'deny');
  assert.equal(updateDenied.denial.code, 'platform_permission_not_assignable');
  assert.deepEqual(updateDenied.denial.affectedPermissions, ['companies.manage']);

  const updateAllowed = evaluateGovernanceOperation('role.company.update', {
    auth: { role: 'admin', companyId: '7' },
    permissionCodes: ['inventory.manage'],
  });
  assert.equal(updateAllowed.decision, 'allow');
});
