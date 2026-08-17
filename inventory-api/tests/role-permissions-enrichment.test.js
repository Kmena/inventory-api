const test = require('node:test');
const assert = require('node:assert/strict');

const roleService = require('../src/services/role.service');
const roleRepository = require('../src/repositories/role.repository');

function withStubs(stubsByModule, run) {
  const originals = [];

  for (const [moduleRef, stubs] of stubsByModule) {
    for (const [key, value] of Object.entries(stubs)) {
      originals.push([moduleRef, key, moduleRef[key]]);
      moduleRef[key] = value;
    }
  }

  return Promise.resolve()
    .then(run)
    .finally(() => {
      for (const [moduleRef, key, value] of originals) {
        moduleRef[key] = value;
      }
    });
}

test('listPermissions enriches each permission with governance metadata fields', async () => {
  await withStubs(
    [[roleRepository, {
      findActivePermissions: async () => [
        { id: 1n, code: 'inventory.manage', module: 'inventory', action: 'manage', description: 'Gestionar bodegas', isActive: true },
        { id: 2n, code: 'users.manage', module: 'admin', action: 'manage', description: 'Gestionar usuarios', isActive: true },
      ],
    }]],
    async () => {
      const result = await roleService.listPermissions({ companyId: '1' });

      assert.equal(result.length, 2);

      const inventoryPerm = result.find((p) => p.code === 'inventory.manage');
      assert.equal(inventoryPerm.displayLabel, 'Gestionar inventario');
      assert.equal(inventoryPerm.moduleCategory, 'inventory');
      assert.equal(inventoryPerm.scope, 'tenant');
      assert.equal(inventoryPerm.sensitivity, 'operational');
      assert.equal(inventoryPerm.metadataStatus, 'complete');
      assert.ok(inventoryPerm.businessDescription.length > 0);

      const usersPerm = result.find((p) => p.code === 'users.manage');
      assert.equal(usersPerm.displayLabel, 'Administrar usuarios');
      assert.equal(usersPerm.scope, 'tenant');
      assert.equal(usersPerm.sensitivity, 'sensitive');
      assert.equal(usersPerm.metadataStatus, 'complete');
    },
  );
});

test('listPermissions marks permissions without metadata as missing', async () => {
  await withStubs(
    [[roleRepository, {
      findActivePermissions: async () => [
        { id: 99n, code: 'unknown.custom.perm', module: 'custom', action: 'do', description: 'Custom', isActive: true },
      ],
    }]],
    async () => {
      const result = await roleService.listPermissions({ companyId: '1' });

      assert.equal(result.length, 1);
      assert.equal(result[0].displayLabel, 'unknown.custom.perm');
      assert.equal(result[0].metadataStatus, 'missing');
      assert.equal(result[0].scope, 'tenant');
      assert.equal(result[0].sensitivity, 'operational');
    },
  );
});

test('listPermissions preserves backward-compatible fields', async () => {
  await withStubs(
    [[roleRepository, {
      findActivePermissions: async () => [
        { id: 5n, code: 'sales.manage', module: 'sales', action: 'manage', description: 'Ventas', isActive: true },
      ],
    }]],
    async () => {
      const result = await roleService.listPermissions({ companyId: '1' });

      assert.equal(result[0].code, 'sales.manage');
      assert.equal(result[0].module, 'sales');
      assert.equal(result[0].action, 'manage');
      assert.equal(result[0].isActive, true);
    },
  );
});

test('listPermissions exposes approved recipe and production permission families through the endpoint service path', async () => {
  await withStubs(
    [[roleRepository, {
      findActivePermissions: async () => [
        { id: 31n, code: 'recipes.view', module: 'production', action: 'view_recipes', description: 'Ver recetas y versiones', isActive: true },
        { id: 32n, code: 'recipes.operations.view', module: 'production', action: 'view_recipe_ops', description: 'Consultar formulas operativas congeladas', isActive: true },
        { id: 33n, code: 'recipes.manage', module: 'production', action: 'manage_recipes', description: 'Gestionar recetas y versiones', isActive: true },
        { id: 34n, code: 'recipes.approve', module: 'production', action: 'approve_recipes', description: 'Aprobar versiones de receta', isActive: true },
        { id: 35n, code: 'production.view', module: 'production', action: 'view_orders', description: 'Ver ordenes de produccion', isActive: true },
        { id: 36n, code: 'production.create', module: 'production', action: 'create_orders', description: 'Crear ordenes de produccion', isActive: true },
        { id: 37n, code: 'production.approve', module: 'production', action: 'approve_orders', description: 'Aprobar ordenes de produccion', isActive: true },
        { id: 38n, code: 'production.execute', module: 'production', action: 'execute', description: 'Ejecutar produccion', isActive: true },
        { id: 39n, code: 'production.complete', module: 'production', action: 'complete', description: 'Completar produccion', isActive: true },
        { id: 40n, code: 'production.cancel', module: 'production', action: 'cancel', description: 'Cancelar produccion', isActive: true },
        { id: 41n, code: 'production.override', module: 'production', action: 'override', description: 'Sobrescribir guardas de produccion', isActive: true },
      ],
    }]],
    async () => {
      const result = await roleService.listPermissions({ companyId: '1' });
      const returnedCodes = result.map((permission) => permission.code);
      const expectedCodes = [
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

      assert.deepEqual(returnedCodes, expectedCodes);
      for (const permission of result) {
        assert.equal(permission.moduleCategory, 'production');
        assert.equal(permission.metadataStatus, 'complete');
        assert.ok(permission.displayLabel.length > 0);
      }
    },
  );
});

test('listPermissions excludes platform-scoped permissions for company admins', async () => {
  await withStubs(
    [[roleRepository, {
      findActivePermissions: async () => [
        { id: 1n, code: 'inventory.manage', module: 'inventory', action: 'manage', description: 'Gestionar inventario', isActive: true },
        { id: 2n, code: 'companies.manage', module: 'companies', action: 'manage', description: 'Crear empresas', isActive: true },
        { id: 3n, code: 'users.manage', module: 'admin', action: 'manage', description: 'Gestionar usuarios', isActive: true },
      ],
    }]],
    async () => {
      const result = await roleService.listPermissions({ companyId: '1' });

      const codes = result.map((p) => p.code);
      assert.ok(!codes.includes('companies.manage'), 'companies.manage must not appear for company admins');
      assert.ok(codes.includes('inventory.manage'), 'tenant-scoped permissions must still appear');
      assert.ok(codes.includes('users.manage'), 'other tenant-scoped permissions must still appear');

      const platformPerms = result.filter((p) => p.scope === 'platform');
      assert.equal(platformPerms.length, 0, 'no platform-scoped permission should be returned');
    },
  );
});

test('listPermissions filter is generic by scope, not hardcoded to companies.manage', async () => {
  await withStubs(
    [[roleRepository, {
      findActivePermissions: async () => [
        { id: 1n, code: 'inventory.manage', module: 'inventory', action: 'manage', description: 'Gestionar inventario', isActive: true },
        { id: 2n, code: 'companies.manage', module: 'companies', action: 'manage', description: 'Crear empresas', isActive: true },
        { id: 3n, code: 'users.manage', module: 'admin', action: 'manage', description: 'Gestionar usuarios', isActive: true },
      ],
    }]],
    async () => {
      const result = await roleService.listPermissions({ companyId: '1' });

      // Verify the filter uses scope, not code name
      const platformPerms = result.filter((p) => p.scope === 'platform');
      assert.equal(platformPerms.length, 0, 'zero platform-scoped permissions must reach the caller');

      // Verify ALL tenant-scoped permissions pass through
      const tenantPerms = result.filter((p) => p.scope === 'tenant');
      assert.equal(tenantPerms.length, 2, 'all tenant-scoped permissions must pass through');
      assert.ok(tenantPerms.some((p) => p.code === 'inventory.manage'));
      assert.ok(tenantPerms.some((p) => p.code === 'users.manage'));

      // Verify companies.manage was excluded by scope, not by name
      assert.ok(!result.some((p) => p.code === 'companies.manage'));
    },
  );
});

test('listPermissions rejects actors without companyId', async () => {
  await assert.rejects(
    () => roleService.listPermissions({ companyId: null }),
    (error) => {
      assert.equal(error.statusCode, 403);
      return true;
    },
  );
});
