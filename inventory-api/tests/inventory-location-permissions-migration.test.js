const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// MASTER-006 / INV-TASK-014 (foundation) — inventory + locations permission
// registration.
//
// Wave 1 scope (per specs/inventori-product-inventory-master-plan/tasks.md
// §MASTER-006):
//   * Permission migration is insert-only and idempotent (no role grants).
//   * Access policy registry exposes stock-changing and read-only policies
//     that map to the approved permission codes.
//   * Stock-changing operations (initial inventory, transfers) require
//     dedicated permissions, NOT inventory.manage alone.
//   * Read-only listing policies (inventory.lots.list, locations.view)
//     accept the manage counterparts as broader substitutes but never
//     rely on stock-changing permissions as the acceptance criterion.
//
// No live database required.

const MIGRATION_FILE = path.join(
  __dirname,
  '../prisma/migrations/20261028000000_add_inventory_location_permissions/migration.sql',
);
const ACCESS_POLICY_REGISTRY = path.join(
  __dirname,
  '../src/security/access-policy-registry.js',
);
const GOVERNANCE_CONFIG = path.join(
  __dirname,
  '../src/security/permission-governance.config.js',
);

const read = (file) => fs.readFileSync(file, 'utf8');

const APPROVED_CODES = [
  'inventory.initial-inventory.create',
  'inventory.transfers.create',
  'inventory.lots.list',
  'locations.view',
  'locations.manage',
];

test('permission migration registers every approved code idempotently', () => {
  const sql = read(MIGRATION_FILE);
  for (const code of APPROVED_CODES) {
    const escaped = code.replace(/[.-]/g, (ch) => `\\${ch}`);
    assert.match(
      sql,
      new RegExp(
        `INSERT INTO "permissions"[\\s\\S]*'${escaped}'[\\s\\S]*NOT EXISTS[\\s\\S]*WHERE "code" = '${escaped}'`,
      ),
      `migration must insert ${code} idempotently`,
    );
  }
});

test('permission migration does NOT grant any role_permissions from Wave 1', () => {
  const sql = read(MIGRATION_FILE);
  assert.doesNotMatch(sql, /INSERT INTO "role_permissions"/i);
});

test('permission migration does NOT touch existing inventory permissions', () => {
  const sql = read(MIGRATION_FILE);
  assert.doesNotMatch(sql, /UPDATE\s+"?permissions"?/i);
  assert.doesNotMatch(sql, /DELETE\s+FROM\s+"?permissions"?/i);
});

test('every approved permission has a documented Spanish uiLabel + notes in governance config', () => {
  const src = read(GOVERNANCE_CONFIG);
  for (const code of APPROVED_CODES) {
    const escaped = code.replace(/[.-]/g, (ch) => `\\${ch}`);
    const match = src.match(new RegExp(`code:\\s*'${escaped}'[\\s\\S]*?}\\)`));
    assert.ok(match, `${code} must be registered in governance config`);
    assert.match(match[0], /uiLabel:\s*'[^']+'/, `${code} must define a Spanish uiLabel`);
    assert.match(match[0], /notes:\s*'[^']+'/, `${code} must define notes`);
  }
});

test('stock-changing permissions are classified as sensitive; read-only permissions as operational', () => {
  const src = read(GOVERNANCE_CONFIG);
  const sensitive = ['inventory.initial-inventory.create', 'inventory.transfers.create', 'locations.manage'];
  const operational = ['inventory.lots.list', 'locations.view'];

  for (const code of sensitive) {
    const escaped = code.replace(/[.-]/g, (ch) => `\\${ch}`);
    const match = src.match(new RegExp(`code:\\s*'${escaped}'[\\s\\S]*?}\\)`))[0];
    assert.match(match, /sensitivity:\s*'sensitive'/, `${code} must be sensitive`);
  }
  for (const code of operational) {
    const escaped = code.replace(/[.-]/g, (ch) => `\\${ch}`);
    const match = src.match(new RegExp(`code:\\s*'${escaped}'[\\s\\S]*?}\\)`))[0];
    assert.match(match, /sensitivity:\s*'operational'/, `${code} must be operational`);
  }
});

test("Access policy 'inventory.initial-inventory.create' requires the dedicated permission ONLY", () => {
  const src = read(ACCESS_POLICY_REGISTRY);
  const block = src.match(
    /'inventory\.initial-inventory\.create':\s*{[\s\S]*?permissions:\s*\[([^\]]+)\]/,
  );
  assert.ok(block, 'policy must be registered');
  const perms = block[1];
  assert.match(perms, /inventory\.initial-inventory\.create/);
  // Stock-changing operations must NOT accept the generic inventory.manage
  // permission as a substitute. This preserves the "stock-changing separate
  // from read-only" invariant.
  assert.doesNotMatch(perms, /'inventory\.manage'/);
});

test("Access policy 'inventory.transfers.create' requires the dedicated permission ONLY", () => {
  const src = read(ACCESS_POLICY_REGISTRY);
  const block = src.match(
    /'inventory\.transfers\.create':\s*{[\s\S]*?permissions:\s*\[([^\]]+)\]/,
  );
  assert.ok(block, 'policy must be registered');
  const perms = block[1];
  assert.match(perms, /inventory\.transfers\.create/);
  assert.doesNotMatch(perms, /'inventory\.manage'/);
});

test("Access policy 'inventory.lots.list' accepts the read-only path AND allows inventory.view/manage as broader substitutes", () => {
  const src = read(ACCESS_POLICY_REGISTRY);
  const block = src.match(
    /'inventory\.lots\.list':\s*{[\s\S]*?permissions:\s*\[([^\]]+)\]/,
  );
  assert.ok(block, 'policy must be registered');
  const perms = block[1];
  assert.match(perms, /inventory\.lots\.list/);
  assert.match(perms, /inventory\.view/);
  assert.match(perms, /inventory\.manage/);
});

test("Access policy 'locations.view' is read-only and does NOT require stock mutation permissions", () => {
  const src = read(ACCESS_POLICY_REGISTRY);
  const block = src.match(
    /'locations\.view':\s*{[\s\S]*?permissions:\s*\[([^\]]+)\]/,
  );
  assert.ok(block, 'policy must be registered');
  const perms = block[1];
  assert.match(perms, /locations\.view/);
  assert.match(perms, /locations\.manage/);
  assert.doesNotMatch(perms, /transfers\.create/);
  assert.doesNotMatch(perms, /initial-inventory\.create/);
});

test("Access policy 'locations.manage' requires the manage permission ONLY", () => {
  const src = read(ACCESS_POLICY_REGISTRY);
  const block = src.match(
    /'locations\.manage':\s*{[\s\S]*?permissions:\s*\[([^\]]+)\]/,
  );
  assert.ok(block, 'policy must be registered');
  const perms = block[1];
  assert.match(perms, /locations\.manage/);
  // locations.view must not be enough to manage locations.
  const asArray = perms
    .split(',')
    .map((s) => s.trim().replace(/['"]/g, ''))
    .filter(Boolean);
  assert.deepEqual(asArray, ['locations.manage']);
});
