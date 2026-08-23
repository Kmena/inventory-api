const test = require('node:test');
const assert = require('node:assert/strict');

const userService = require('../src/services/user.service');
const userRepository = require('../src/repositories/user.repository');
const roleRepository = require('../src/repositories/role.repository');
const audit = require('../src/lib/audit');

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

test('registerCompanyUser uses company-scoped assignable role lookup for same-company roles', async () => {
  let createUserPayload = null;

  await withStubs(
    [
      [userRepository, {
        findUserByUsername: async () => null,
        createUser: async (payload) => {
          createUserPayload = payload;
          return { id: 21n, ...payload };
        },
      }],
      [roleRepository, {
        findAssignableRoleByIdForCompany: async (roleId, companyId) => {
          assert.equal(roleId.toString(), '3');
          assert.equal(companyId.toString(), '7');
          return { id: 3n, code: 'warehouse', companyId: 7n, isActive: true };
        },
        findRoleById: async () => {
          throw new Error('findRoleById should not be used when the scoped assignable lookup succeeds');
        },
      }],
      [audit, {
        recordAuditEventIfAvailable: async () => null,
      }],
    ],
    async () => {
      const result = await userService.registerCompanyUser(
        { username: 'tenant-worker', password: 'WorkerPass123!', roleId: 3n },
        { companyId: '7' },
      );

      assert.equal(result.username, 'tenant-worker');
      assert.equal(createUserPayload.companyId, 7n);
      assert.equal(createUserPayload.roleId, 3n);
      assert.equal(createUserPayload.status, 'ACTIVE');
      assert.notEqual(createUserPayload.passwordHash, 'WorkerPass123!');
    },
  );
});

test('registerCompanyUser allows active global non-root roles through the scoped assignable lookup', async () => {
  await withStubs(
    [
      [userRepository, {
        findUserByUsername: async () => null,
        createUser: async (payload) => ({ id: 22n, ...payload }),
      }],
      [roleRepository, {
        findAssignableRoleByIdForCompany: async () => ({
          id: 4n,
          code: 'global_sales',
          companyId: null,
          isActive: true,
        }),
        findRoleById: async () => {
          throw new Error('findRoleById should not be used when the scoped assignable lookup succeeds');
        },
      }],
      [audit, {
        recordAuditEventIfAvailable: async () => null,
      }],
    ],
    async () => {
      const result = await userService.registerCompanyUser(
        { username: 'global-worker', password: 'WorkerPass123!', roleId: 4n },
        { companyId: '7' },
      );

      assert.equal(result.roleId, 4n);
      assert.equal(result.companyId, 7n);
    },
  );
});

test('registerCompanyUser rejects foreign-company roles after scoped lookup miss', async () => {
  await withStubs(
    [
      [userRepository, {
        findUserByUsername: async () => null,
      }],
      [roleRepository, {
        findAssignableRoleByIdForCompany: async () => null,
        findRoleById: async () => ({
          id: 8n,
          code: 'tenant-foreign',
          companyId: 99n,
          isActive: true,
        }),
      }],
    ],
    async () => {
      await assert.rejects(
        () => userService.registerCompanyUser(
          { username: 'foreign-worker', password: 'WorkerPass123!', roleId: 8n },
          { companyId: '7' },
        ),
        (error) => {
          assert.equal(error.statusCode, 403);
          assert.equal(error.code, 'forbidden');
          assert.equal(error.message, 'El rol no pertenece a esta empresa');
          return true;
        },
      );
    },
  );
});

test('registerCompanyUser rejects root roles after scoped lookup miss', async () => {
  await withStubs(
    [
      [userRepository, {
        findUserByUsername: async () => null,
      }],
      [roleRepository, {
        findAssignableRoleByIdForCompany: async () => null,
        findRoleById: async () => ({
          id: 1n,
          code: 'root',
          companyId: null,
          isActive: true,
        }),
      }],
    ],
    async () => {
      await assert.rejects(
        () => userService.registerCompanyUser(
          { username: 'root-worker', password: 'WorkerPass123!', roleId: 1n },
          { companyId: '7' },
        ),
        (error) => {
          assert.equal(error.statusCode, 403);
          assert.equal(error.code, 'forbidden');
          assert.equal(error.message, 'No se pueden crear usuarios root desde esta pantalla');
          return true;
        },
      );
    },
  );
});
