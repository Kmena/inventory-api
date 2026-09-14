const test = require('node:test');
const assert = require('node:assert/strict');

const userRoutes = require('../src/routes/user.routes');
const roleRoutes = require('../src/routes/role.routes');
const userService = require('../src/services/user.service');
const userRepository = require('../src/repositories/user.repository');
const roleRepository = require('../src/repositories/role.repository');
const audit = require('../src/lib/audit');
const browserSessionService = require('../src/services/browser-session.service');

function getRouteGuard(router, path, method) {
  const layer = router.stack.find((entry) => entry.route && entry.route.path === path && entry.route.methods[method]);
  assert.ok(layer, `${method.toUpperCase()} route for ${path} should exist`);
  assert.ok(layer.route.stack.length >= 2, `${method.toUpperCase()} route for ${path} should include guard and handler`);
  return layer.route.stack[0].handle;
}

async function runGuard(guard, auth) {
  let nextError = 'not-called';
  await guard({ auth, requestContext: { requestId: 'req-fb6-permissions-1' } }, {}, (error) => {
    nextError = error;
  });
  return nextError;
}

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

test('FB6 company user routes use permissions instead of role code', async () => {
  const listGuard = getRouteGuard(userRoutes, '/company', 'get');
  const createGuard = getRouteGuard(userRoutes, '/company', 'post');
  const updateGuard = getRouteGuard(userRoutes, '/company/:userId', 'patch');
  const assignGuard = getRouteGuard(userRoutes, '/company/:userId/role', 'patch');

  const salesWithoutPermission = { role: 'sales', companyId: '7', permissions: [] };
  assert.equal((await runGuard(listGuard, salesWithoutPermission))?.statusCode, 403);
  assert.equal((await runGuard(createGuard, salesWithoutPermission))?.statusCode, 403);

  assert.equal(await runGuard(listGuard, { role: 'custom', companyId: '7', permissions: ['users.view'] }), undefined);
  assert.equal(await runGuard(createGuard, { role: 'custom', companyId: '7', permissions: ['users.create'] }), undefined);
  assert.equal(await runGuard(updateGuard, { role: 'custom', companyId: '7', permissions: ['users.update'] }), undefined);
  assert.equal(await runGuard(assignGuard, { role: 'custom', companyId: '7', permissions: ['users.assign-role'] }), undefined);
});

test('FB6 company role routes use roles.view and roles.manage permissions', async () => {
  const listGuard = getRouteGuard(roleRoutes, '/company', 'get');
  const createGuard = getRouteGuard(roleRoutes, '/company', 'post');
  const updateGuard = getRouteGuard(roleRoutes, '/company/:roleId', 'put');

  assert.equal((await runGuard(listGuard, { role: 'admin', companyId: '7', permissions: [] }))?.statusCode, 403);
  assert.equal(await runGuard(listGuard, { role: 'custom', companyId: '7', permissions: ['roles.view'] }), undefined);
  assert.equal(await runGuard(createGuard, { role: 'custom', companyId: '7', permissions: ['roles.manage'] }), undefined);
  assert.equal(await runGuard(updateGuard, { role: 'custom', companyId: '7', permissions: ['roles.manage'] }), undefined);
});

test('assignCompanyUserRole rejects foreign-company users before role assignment', async () => {
  await withStubs(
    [
      [userRepository, {
        findUserByIdForCompany: async (userId, companyId) => {
          assert.equal(userId.toString(), '55');
          assert.equal(companyId.toString(), '7');
          return null;
        },
      }],
    ],
    async () => {
      await assert.rejects(
        () => userService.assignCompanyUserRole('55', { roleId: '3' }, { companyId: '7', permissions: ['users.assign-role'] }),
        (error) => {
          assert.equal(error.statusCode, 404);
          return true;
        },
      );
    },
  );
});

test('assignCompanyUserRole blocks assigning roles.manage without actor roles.manage', async () => {
  await withStubs(
    [
      [userRepository, {
        findUserByIdForCompany: async () => ({ id: 55n, companyId: 7n, roleId: 2n }),
      }],
      [roleRepository, {
        findAssignableRoleByIdForCompany: async () => ({
          id: 9n,
          code: 'company_admin_delegate',
          companyId: 7n,
          isActive: true,
          rolePermissions: [
            { isEnabled: true, permission: { code: 'roles.manage', isActive: true } },
          ],
        }),
      }],
    ],
    async () => {
      await assert.rejects(
        () => userService.assignCompanyUserRole('55', { roleId: '9' }, { companyId: '7', permissions: ['users.assign-role'] }),
        (error) => {
          assert.equal(error.statusCode, 403);
          assert.equal(error.code, 'forbidden');
          return true;
        },
      );
    },
  );
});

test('assignCompanyUserRole updates same-company target and invalidates target sessions', async () => {
  let invalidatedUserId = null;
  await withStubs(
    [
      [userRepository, {
        findUserByIdForCompany: async () => ({ id: 55n, companyId: 7n, roleId: 2n }),
        assignCompanyUserRole: async (_userId, _companyId, roleId) => ({ id: 55n, companyId: 7n, roleId, passwordHash: 'x' }),
      }],
      [roleRepository, {
        findAssignableRoleByIdForCompany: async () => ({ id: 9n, code: 'sales_agent', companyId: 7n, isActive: true, rolePermissions: [] }),
      }],
      [browserSessionService, {
        invalidateBrowserSessionsForUser: async (userId) => {
          invalidatedUserId = userId;
          return 1;
        },
      }],
      [audit, {
        recordAuditEventIfAvailable: async () => null,
      }],
    ],
    async () => {
      const result = await userService.assignCompanyUserRole(
        '55',
        { roleId: '9' },
        { sub: '22', companyId: '7', permissions: ['users.assign-role'] },
      );

      assert.equal(result.roleId.toString(), '9');
      assert.equal(invalidatedUserId.toString(), '55');
    },
  );
});

test('assignCompanyUserRole rejects self role changes', async () => {
  await withStubs(
    [
      [userRepository, {
        findUserByIdForCompany: async () => ({ id: 55n, companyId: 7n, roleId: 2n }),
      }],
    ],
    async () => {
      await assert.rejects(
        () => userService.assignCompanyUserRole('55', { roleId: '9' }, { sub: '55', companyId: '7', permissions: ['users.assign-role'] }),
        (error) => {
          assert.equal(error.statusCode, 403);
          return true;
        },
      );
    },
  );
});

test('registerCompanyUser blocks roles.manage escalation via create-user (anti-bypass for POST)', async () => {
  // Proves the same resolveAssignableRoleForCompany governance applies to user-creation,
  // so an actor cannot bypass the assign-role escalation check via POST /users/company.
  await withStubs(
    [
      [userRepository, {
        findUserByUsername: async () => null,
      }],
      [roleRepository, {
        findAssignableRoleByIdForCompany: async () => ({
          id: 9n,
          code: 'admin_delegate',
          companyId: 7n,
          isActive: true,
          rolePermissions: [
            { isEnabled: true, permission: { code: 'roles.manage', isActive: true } },
          ],
        }),
      }],
    ],
    async () => {
      await assert.rejects(
        () => userService.registerCompanyUser(
          { username: 'new-admin', password: 'Password123!', roleId: '9' },
          { companyId: '7', permissions: ['users.create'] },
        ),
        (error) => {
          assert.equal(error.statusCode, 403);
          assert.equal(error.code, 'forbidden');
          return true;
        },
      );
    },
  );
});

test('assignCompanyUserRole allows assigning roles.manage role when actor already has roles.manage', async () => {
  // Proves the escalation check is authorization-based, not a blanket deny.
  let invalidatedUserId = null;
  await withStubs(
    [
      [userRepository, {
        findUserByIdForCompany: async () => ({ id: 55n, companyId: 7n, roleId: 2n }),
        assignCompanyUserRole: async (_userId, _companyId, roleId) => ({ id: 55n, companyId: 7n, roleId, passwordHash: 'x' }),
      }],
      [roleRepository, {
        findAssignableRoleByIdForCompany: async () => ({
          id: 9n,
          code: 'admin_delegate',
          companyId: 7n,
          isActive: true,
          rolePermissions: [
            { isEnabled: true, permission: { code: 'roles.manage', isActive: true } },
          ],
        }),
      }],
      [browserSessionService, {
        invalidateBrowserSessionsForUser: async (userId) => {
          invalidatedUserId = userId;
          return 1;
        },
      }],
      [audit, {
        recordAuditEventIfAvailable: async () => null,
      }],
    ],
    async () => {
      const result = await userService.assignCompanyUserRole(
        '55',
        { roleId: '9' },
        { sub: '22', companyId: '7', permissions: ['users.assign-role', 'roles.manage'] },
      );
      assert.equal(result.roleId.toString(), '9');
      assert.equal(invalidatedUserId.toString(), '55');
    },
  );
});

test('assignCompanyUserRole rejects inactive role with 400', async () => {
  await withStubs(
    [
      [userRepository, {
        findUserByIdForCompany: async () => ({ id: 55n, companyId: 7n, roleId: 2n }),
      }],
      [roleRepository, {
        findAssignableRoleByIdForCompany: async () => null,
        findRoleById: async () => ({ id: 99n, code: 'archived-role', isActive: false, rolePermissions: [] }),
      }],
    ],
    async () => {
      await assert.rejects(
        () => userService.assignCompanyUserRole('55', { roleId: '99' }, { companyId: '7', permissions: ['users.assign-role'] }),
        (error) => {
          assert.equal(error.statusCode, 400);
          assert.equal(error.code, 'validation_error');
          return true;
        },
      );
    },
  );
});

test('assignCompanyUserRole rejects self role change even when actor has both users.assign-role and roles.manage', async () => {
  // Self-change is checked before the role governance step — no permission set can bypass it.
  await withStubs(
    [
      [userRepository, {
        findUserByIdForCompany: async () => ({ id: 55n, companyId: 7n, roleId: 2n }),
      }],
    ],
    async () => {
      await assert.rejects(
        () => userService.assignCompanyUserRole(
          '55',
          { roleId: '9' },
          { sub: '55', companyId: '7', permissions: ['users.assign-role', 'roles.manage'] },
        ),
        (error) => {
          assert.equal(error.statusCode, 403);
          return true;
        },
      );
    },
  );
});

test('updateCompanyUser updates only same-company non-role fields', async () => {
  let updatePayload = null;
  await withStubs(
    [
      [userRepository, {
        findUserByIdForCompany: async () => ({ id: 55n, companyId: 7n, username: 'agent-a', status: 'ACTIVE' }),
        updateCompanyUserFields: async (_userId, _companyId, data) => {
          updatePayload = data;
          return { id: 55n, companyId: 7n, username: 'agent-a', fullName: data.fullName, email: data.email, phone: data.phone, status: 'ACTIVE', passwordHash: 'x' };
        },
      }],
      [audit, {
        recordAuditEventIfAvailable: async () => null,
      }],
    ],
    async () => {
      const result = await userService.updateCompanyUser(
        '55',
        { fullName: 'Agent Updated', email: 'updated@example.com', phone: '8888-8888', roleId: '99', status: 'BLOCKED' },
        { companyId: '7', permissions: ['users.update'] },
      );

      assert.deepEqual(updatePayload, { fullName: 'Agent Updated', email: 'updated@example.com', phone: '8888-8888' });
      assert.equal(result.username, 'agent-a');
      assert.equal(result.passwordHash, undefined);
    },
  );
});
