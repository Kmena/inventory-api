const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  isLandingPermission,
  listLandingPermissionCodes,
  getAllLandingPermissionCodes,
  resolveLanding,
  validateLandingCardinalityForTenantRole,
  getPermissionMetadata,
  evaluateGovernanceOperation,
  LANDING_TARGETS,
} = require('../src/security/permission-governance.service');

const { ROLE_BUNDLES } = require('../src/security/role-bundles.config');

// ── Landing metadata ────────────────────────────────────────────────

test('root.access, warehouse.access and agent.access are landing permissions', () => {
  assert.ok(isLandingPermission('root.access'));
  assert.ok(isLandingPermission('warehouse.access'));
  assert.ok(isLandingPermission('agent.access'));
});

test('operational permissions are not landing permissions', () => {
  assert.equal(isLandingPermission('production.execute'), false);
  assert.equal(isLandingPermission('procurement.manage'), false);
  assert.equal(isLandingPermission('sales.orders.create'), false);
  assert.equal(isLandingPermission('users.manage'), false);
  assert.equal(isLandingPermission('companies.manage'), false);
});

test('landing permissions have correct metadata fields', () => {
  for (const code of ['root.access', 'warehouse.access', 'agent.access']) {
    const meta = getPermissionMetadata(code);
    assert.ok(meta, `metadata missing for ${code}`);
    assert.equal(meta.permissionKind, 'landing');
    assert.equal(meta.exclusiveGroup, 'primary-landing');
    assert.equal(meta.scope, 'tenant');
    assert.equal(meta.category, 'landing');
    assert.ok(meta.landingTarget, `landingTarget missing for ${code}`);
  }
});

test('landing targets map to correct paths', () => {
  assert.equal(LANDING_TARGETS.root, '/root/');
  assert.equal(LANDING_TARGETS.warehouse, '/warehouse/');
  assert.equal(LANDING_TARGETS.agent, '/agent/');
});

test('getAllLandingPermissionCodes returns exactly 3 landing codes', () => {
  const codes = getAllLandingPermissionCodes();
  assert.equal(codes.length, 3);
  assert.ok(codes.includes('root.access'));
  assert.ok(codes.includes('warehouse.access'));
  assert.ok(codes.includes('agent.access'));
});

test('listLandingPermissionCodes filters only landing from mixed set', () => {
  const result = listLandingPermissionCodes([
    'production.execute', 'warehouse.access', 'users.manage',
  ]);
  assert.deepEqual(result, ['warehouse.access']);
});

// ── Landing resolution ──────────────────────────────────────────────

test('resolveLanding returns root for global root actor', () => {
  const landing = resolveLanding([], { role: 'root', companyId: null });
  assert.equal(landing.target, 'root');
  assert.equal(landing.path, '/root/');
  assert.equal(landing.source, 'platform-root-rule');
});

test('resolveLanding returns root for root.access permission', () => {
  const landing = resolveLanding(['root.access', 'users.manage'], { role: 'admin', companyId: '1' });
  assert.equal(landing.target, 'root');
  assert.equal(landing.path, '/root/');
  assert.equal(landing.source, 'permission');
  assert.equal(landing.permissionCode, 'root.access');
});

test('resolveLanding returns warehouse for warehouse.access permission', () => {
  const landing = resolveLanding(['warehouse.access', 'production.execute'], { companyId: '1' });
  assert.equal(landing.target, 'warehouse');
  assert.equal(landing.path, '/warehouse/');
  assert.equal(landing.source, 'permission');
  assert.equal(landing.permissionCode, 'warehouse.access');
});

test('resolveLanding returns agent for agent.access permission', () => {
  const landing = resolveLanding(['agent.access', 'sales.orders.create'], { companyId: '1' });
  assert.equal(landing.target, 'agent');
  assert.equal(landing.path, '/agent/');
  assert.equal(landing.source, 'permission');
  assert.equal(landing.permissionCode, 'agent.access');
});

test('resolveLanding uses legacy fallback for admin without landing permission', () => {
  const landing = resolveLanding(['users.manage'], { role: 'admin', companyId: '1' });
  assert.equal(landing.target, 'root');
  assert.equal(landing.source, 'legacy-fallback');
});

test('resolveLanding uses legacy fallback for sales_agent without agent.access', () => {
  const landing = resolveLanding(['sales.orders.create'], { role: 'sales_agent', companyId: '1' });
  assert.equal(landing.target, 'agent');
  assert.equal(landing.source, 'legacy-fallback');
});

test('resolveLanding uses legacy fallback for procurement.manage without root.access', () => {
  const landing = resolveLanding(['procurement.manage'], { role: 'procurement_op', companyId: '1' });
  assert.equal(landing.target, 'root');
  assert.equal(landing.source, 'legacy-fallback');
});

test('resolveLanding returns no-access when no landing and no legacy match', () => {
  const landing = resolveLanding(['production.execute'], { role: 'unknown', companyId: '1' });
  assert.equal(landing.target, 'no-access');
  assert.equal(landing.path, '/no-access.html');
  assert.equal(landing.source, 'none');
});

// ── Regression: admin user with both root.access and warehouse.access ──
// The seed admin role has ALL permissions (includes warehouse.access).
// The backfill migration 20260917001000 adds root.access to admin too.
// Without priority ordering, warehouse.access (inserted first) was returned → bug.
test('resolveLanding picks root.access over warehouse.access when admin has both (regression)', () => {
  // Simulate admin role permissions: all permissions including both landing codes.
  // warehouse.access appears BEFORE root.access (seed order vs migration order).
  const adminPermissions = [
    'users.manage', 'warehouse.access', 'production.execute', 'inventory.manage',
    'root.access', // added later by backfill migration
  ];
  const landing = resolveLanding(adminPermissions, { role: 'admin', companyId: '7' });

  assert.equal(landing.target, 'root',
    'admin with both landing permissions must resolve to root, not warehouse');
  assert.equal(landing.path, '/root/');
  assert.equal(landing.permissionCode, 'root.access');
  assert.match(landing.trace.join(','), /multiple-landings-resolved:root\.access/);
});

test('resolveLanding picks root.access over warehouse.access regardless of array order', () => {
  // Even if root.access comes first in the array, should still be deterministic
  const permissionsRootFirst = ['root.access', 'warehouse.access', 'production.execute'];
  const permissionsWarehouseFirst = ['warehouse.access', 'root.access', 'production.execute'];

  const l1 = resolveLanding(permissionsRootFirst, { role: 'admin', companyId: '7' });
  const l2 = resolveLanding(permissionsWarehouseFirst, { role: 'admin', companyId: '7' });

  assert.equal(l1.target, 'root', 'root-first order: must resolve to root');
  assert.equal(l2.target, 'root', 'warehouse-first order: must still resolve to root');
  assert.equal(l1.permissionCode, 'root.access');
  assert.equal(l2.permissionCode, 'root.access');
});

// ── Landing cardinality validation ──────────────────────────────────

test('validateLandingCardinalityForTenantRole accepts exactly 1 landing', () => {
  const result = validateLandingCardinalityForTenantRole(['warehouse.access', 'production.execute']);
  assert.equal(result.valid, true);
});

test('validateLandingCardinalityForTenantRole rejects 0 landings', () => {
  const result = validateLandingCardinalityForTenantRole(['production.execute', 'users.manage']);
  assert.equal(result.valid, false);
  assert.equal(result.code, 'landing_required');
});

test('validateLandingCardinalityForTenantRole rejects 2+ landings', () => {
  const result = validateLandingCardinalityForTenantRole([
    'root.access', 'warehouse.access', 'production.execute',
  ]);
  assert.equal(result.valid, false);
  assert.equal(result.code, 'landing_conflict');
  assert.deepEqual(result.landingCodes, ['root.access', 'warehouse.access']);
});

// ── Governance integration ──────────────────────────────────────────

test('evaluateGovernanceOperation denies role.company.create with 0 landings', () => {
  const result = evaluateGovernanceOperation('role.company.create', {
    auth: { companyId: '1' },
    permissionCodes: ['production.execute'],
  });
  assert.equal(result.decision, 'deny');
  assert.equal(result.denial.code, 'landing_required');
  assert.equal(result.denial.ruleId, 'landing-required-for-tenant-role');
});

test('evaluateGovernanceOperation denies role.company.create with 2 landings', () => {
  const result = evaluateGovernanceOperation('role.company.create', {
    auth: { companyId: '1' },
    permissionCodes: ['root.access', 'warehouse.access', 'production.execute'],
  });
  assert.equal(result.decision, 'deny');
  assert.equal(result.denial.code, 'landing_conflict');
  assert.equal(result.denial.ruleId, 'landing-primary-singleton');
});

test('evaluateGovernanceOperation allows role.company.create with exactly 1 landing', () => {
  const result = evaluateGovernanceOperation('role.company.create', {
    auth: { companyId: '1' },
    permissionCodes: ['warehouse.access', 'production.execute'],
  });
  assert.equal(result.decision, 'allow');
});

test('evaluateGovernanceOperation denies role.company.update with 0 landings', () => {
  const result = evaluateGovernanceOperation('role.company.update', {
    auth: { companyId: '1' },
    permissionCodes: ['users.manage'],
  });
  assert.equal(result.decision, 'deny');
  assert.equal(result.denial.code, 'landing_required');
});

// ── Bundles alignment ───────────────────────────────────────────────

test('every tenant bundle has exactly one landing in basePermissionCodes', () => {
  const tenantBundles = ROLE_BUNDLES.filter((b) => b.id !== 'platform_root');
  for (const bundle of tenantBundles) {
    const landings = listLandingPermissionCodes([...bundle.basePermissionCodes]);
    assert.equal(landings.length, 1, `Bundle ${bundle.id} should have exactly 1 landing, found ${landings.length}: ${landings.join(', ')}`);
    assert.equal(bundle.landing, landings[0], `Bundle ${bundle.id} landing field should match basePermissionCodes`);
  }
});

test('platform_root bundle has landing=null (governed exception)', () => {
  const platformRoot = ROLE_BUNDLES.find((b) => b.id === 'platform_root');
  assert.ok(platformRoot);
  assert.equal(platformRoot.landing, null);
});

test('bundles have correct landing assignments per DEC-008 and spec mapping', () => {
  const expected = {
    warehouse_operator: 'warehouse.access',
    production_operator: 'warehouse.access',
    qa_inspector: 'warehouse.access',
    procurement_operator: 'root.access',
    sales_agent: 'agent.access',
    sales_supervisor: 'root.access',
    company_admin: 'root.access',
  };
  for (const [bundleId, expectedLanding] of Object.entries(expected)) {
    const bundle = ROLE_BUNDLES.find((b) => b.id === bundleId);
    assert.ok(bundle, `Bundle ${bundleId} not found`);
    assert.equal(bundle.landing, expectedLanding, `Bundle ${bundleId} should have landing=${expectedLanding}`);
  }
});

// ── Seed migration exists ───────────────────────────────────────────

test('landing permissions seed migration SQL file exists', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const migrationPath = path.join(__dirname, '..', 'prisma', 'migrations', '20260917000000_add_landing_permissions', 'migration.sql');
  assert.ok(fs.existsSync(migrationPath), 'migration.sql for landing permissions should exist');
  const content = fs.readFileSync(migrationPath, 'utf8');
  assert.match(content, /root\.access/);
  assert.match(content, /agent\.access/);
  assert.match(content, /INSERT INTO permissions/);
});
