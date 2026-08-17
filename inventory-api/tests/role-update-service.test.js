const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';

const roleService = require('../src/services/role.service');
const roleRepository = require('../src/repositories/role.repository');
const userRepository = require('../src/repositories/user.repository');
const browserSessionService = require('../src/services/browser-session.service');
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

function createRequest() {
  return {
    method: 'PUT',
    originalUrl: '/api/roles/company/10',
    baseUrl: '/api/roles',
    route: { path: '/company/:roleId' },
    headers: {},
    get(headerName) {
      return this.headers[headerName.toLowerCase()] || null;
    },
    requestContext: {
      requestId: 'req-role-update-1',
      method: 'PUT',
      path: '/api/roles/company/10',
      ip: '127.0.0.1',
      userAgent: 'role-update-test-agent',
      actor: null,
    },
  };
}

function createCompanyRole(overrides = {}) {
  return {
    id: 10n,
    code: 'company_1_ops',
    name: 'Operaciones',
    companyId: 1n,
    isActive: true,
    rolePermissions: [
      { isEnabled: true, permission: { code: 'inventory.manage', isActive: true } },
      { isEnabled: true, permission: { code: 'inventory.view', isActive: true } },
    ],
    ...overrides,
  };
}

test('updateCompanyRole updates permissions for a valid company role and invalidates impacted browser sessions after persistence', async () => {
  let updatedArgs = null;
  let invalidationArgs = null;

  await withStubs(
    [
      [roleRepository, {
        findCompanyOwnedRoleById: async () => createCompanyRole(),
        findRoleById: async () => {
          throw new Error('findRoleById should not be used for company-owned success lookup');
        },
        findActivePermissions: async () => [
          { code: 'inventory.manage' },
          { code: 'inventory.view' },
          { code: 'sales.manage' },
        ],
        updateCompanyRolePermissions: async (args) => {
          updatedArgs = args;
          return {
            ...createCompanyRole(),
            rolePermissions: [
              { isEnabled: true, permission: { code: 'inventory.manage', isActive: true } },
              { isEnabled: true, permission: { code: 'sales.manage', isActive: true } },
            ],
          };
        },
      }],
      [userRepository, {
        findActiveUsersByRoleId: async (roleId, companyId) => {
          assert.equal(roleId.toString(), '10');
          assert.equal(companyId.toString(), '1');
          return [{ id: 71n }, { id: 72n }];
        },
      }],
      [browserSessionService, {
        invalidateBrowserSessionsForUsers: async (userIds, options = {}) => {
          invalidationArgs = { userIds, options };
          return 2;
        },
      }],
      [audit, {
        recordAuditEventIfAvailable: async () => null,
      }],
    ],
    async () => {
      const result = await roleService.updateCompanyRole(
        '10',
        { permissionCodes: ['inventory.manage', 'sales.manage'] },
        { companyId: '1', roleId: '99' },
        createRequest(),
      );

      assert.equal(result.name, 'Operaciones');
      assert.equal(result.permissions.length, 2);
      assert.deepEqual(updatedArgs.permissionCodes, ['inventory.manage', 'sales.manage']);
      assert.deepEqual(invalidationArgs.userIds, [71n, 72n]);
      assert.equal(invalidationArgs.options.reasonCode, 'role_permission_change');
      assert.equal(invalidationArgs.options.metadata.roleId, '10');
      assert.equal(invalidationArgs.options.metadata.companyId, '1');
    },
  );
});

test('updateCompanyRole rejects actors without companyId', async () => {
  await assert.rejects(
    () => roleService.updateCompanyRole('10', { permissionCodes: ['inventory.manage'] }, { companyId: null }),
    (error) => {
      assert.equal(error.statusCode, 403);
      assert.equal(error.code, 'forbidden');
      return true;
    },
  );
});

test('updateCompanyRole rejects editing a global role (companyId null)', async () => {
  await withStubs(
    [[roleRepository, {
      findCompanyOwnedRoleById: async () => null,
      findRoleById: async () => createCompanyRole({ companyId: null }),
    }]],
    async () => {
      await assert.rejects(
        () => roleService.updateCompanyRole('10', { permissionCodes: ['inventory.manage'] }, { companyId: '1' }),
        (error) => {
          assert.equal(error.statusCode, 403);
          return true;
        },
      );
    },
  );
});

test('updateCompanyRole rejects editing a role from a different company', async () => {
  await withStubs(
    [[roleRepository, {
      findCompanyOwnedRoleById: async () => null,
      findRoleById: async () => createCompanyRole({ companyId: 999n }),
    }]],
    async () => {
      await assert.rejects(
        () => roleService.updateCompanyRole('10', { permissionCodes: ['inventory.manage'] }, { companyId: '1' }),
        (error) => {
          assert.equal(error.statusCode, 403);
          return true;
        },
      );
    },
  );
});

test('updateCompanyRole rejects nonexistent role', async () => {
  await withStubs(
    [[roleRepository, {
      findCompanyOwnedRoleById: async () => null,
      findRoleById: async () => null,
    }]],
    async () => {
      await assert.rejects(
        () => roleService.updateCompanyRole('999', { permissionCodes: ['inventory.manage'] }, { companyId: '1' }),
        (error) => {
          assert.equal(error.statusCode, 404);
          assert.equal(error.code, 'not_found');
          return true;
        },
      );
    },
  );
});

test('updateCompanyRole rejects inactive role', async () => {
  await withStubs(
    [[roleRepository, {
      findCompanyOwnedRoleById: async () => null,
      findRoleById: async () => createCompanyRole({ isActive: false }),
    }]],
    async () => {
      await assert.rejects(
        () => roleService.updateCompanyRole('10', { permissionCodes: ['inventory.manage'] }, { companyId: '1' }),
        (error) => {
          assert.equal(error.statusCode, 404);
          return true;
        },
      );
    },
  );
});

test('updateCompanyRole rejects invalid/inactive permission codes', async () => {
  await withStubs(
    [[roleRepository, {
      findCompanyOwnedRoleById: async () => createCompanyRole(),
      findRoleById: async () => {
        throw new Error('findRoleById should not be used when company-scoped role exists');
      },
      findActivePermissions: async () => [{ code: 'inventory.manage' }],
    }]],
    async () => {
      await assert.rejects(
        () => roleService.updateCompanyRole('10', { permissionCodes: ['inventory.manage', 'nonexistent.perm'] }, { companyId: '1' }),
        (error) => {
          assert.equal(error.statusCode, 400);
          assert.equal(error.code, 'validation_error');
          assert.ok(error.message.includes('nonexistent.perm'));
          return true;
        },
      );
    },
  );
});

test('updateCompanyRole denies platform-scoped permissions and records governance audit', async () => {
  let auditPayload = null;

  await withStubs(
    [
      [roleRepository, {
        findCompanyOwnedRoleById: async () => createCompanyRole(),
        findRoleById: async () => {
          throw new Error('findRoleById should not be used when company-scoped role exists');
        },
        findActivePermissions: async () => [
          { code: 'companies.manage' },
          { code: 'inventory.manage' },
        ],
      }],
      [audit, {
        recordAuditEventSafelyIfAvailable: async (payload) => {
          auditPayload = payload;
        },
      }],
    ],
    async () => {
      await assert.rejects(
        () => roleService.updateCompanyRole(
          '10',
          { permissionCodes: ['companies.manage'] },
          { companyId: '1' },
          createRequest(),
        ),
        (error) => {
          assert.equal(error.statusCode, 403);
          assert.equal(error.code, 'platform_permission_not_assignable');
          assert.equal(auditPayload.action, 'roles.company.update.governance_denied');
          assert.equal(auditPayload.outcome, 'REJECTED');
          return true;
        },
      );
    },
  );
});

test('updateCompanyRole prevents self-lockout by blocking removal of administrative permissions from own role', async () => {
  await withStubs(
    [
      [roleRepository, {
        findCompanyOwnedRoleById: async () => createCompanyRole({ id: 50n }),
        findRoleById: async () => {
          throw new Error('findRoleById should not be used when company-scoped role exists');
        },
        findActivePermissions: async () => [
          { code: 'inventory.manage' },
          { code: 'settings.manage' },
        ],
      }],
    ],
    async () => {
      await assert.rejects(
        () => roleService.updateCompanyRole(
          '50',
          { permissionCodes: ['inventory.manage'] },
          { companyId: '1', roleId: '50' },
        ),
        (error) => {
          assert.equal(error.statusCode, 400);
          assert.equal(error.code, 'self_lockout_prevented');
          assert.ok(error.message.includes('settings.manage'));
          return true;
        },
      );
    },
  );
});

test('updateCompanyRole allows editing own role when protected permissions are kept', async () => {
  await withStubs(
    [
      [roleRepository, {
        findCompanyOwnedRoleById: async () => createCompanyRole({ id: 50n }),
        findRoleById: async () => {
          throw new Error('findRoleById should not be used when company-scoped role exists');
        },
        findActivePermissions: async () => [
          { code: 'inventory.manage' },
          { code: 'settings.manage' },
          { code: 'users.manage' },
        ],
        updateCompanyRolePermissions: async () => ({
          ...createCompanyRole({ id: 50n }),
          rolePermissions: [
            { isEnabled: true, permission: { code: 'settings.manage', isActive: true } },
            { isEnabled: true, permission: { code: 'users.manage', isActive: true } },
            { isEnabled: true, permission: { code: 'inventory.manage', isActive: true } },
          ],
        }),
      }],
      [userRepository, {
        findActiveUsersByRoleId: async (roleId, companyId) => {
          assert.equal(roleId.toString(), '50');
          assert.equal(companyId.toString(), '1');
          return [{ id: 50n }];
        },
      }],
      [browserSessionService, {
        invalidateBrowserSessionsForUsers: async () => 1,
      }],
      [audit, {
        recordAuditEventIfAvailable: async () => null,
      }],
    ],
    async () => {
      const result = await roleService.updateCompanyRole(
        '50',
        { permissionCodes: ['settings.manage', 'users.manage', 'inventory.manage'] },
        { companyId: '1', roleId: '50' },
        createRequest(),
      );
      assert.equal(result.permissions.length, 3);
    },
  );
});

test('updateCompanyRole skips targeted invalidation when no active users are assigned to the role', async () => {
  let invalidationCallCount = 0;

  await withStubs(
    [
      [roleRepository, {
        findCompanyOwnedRoleById: async () => createCompanyRole(),
        findRoleById: async () => {
          throw new Error('findRoleById should not be used when company-scoped role exists');
        },
        findActivePermissions: async () => [{ code: 'inventory.manage' }],
        updateCompanyRolePermissions: async () => ({
          ...createCompanyRole(),
          rolePermissions: [
            { isEnabled: true, permission: { code: 'inventory.manage', isActive: true } },
          ],
        }),
      }],
      [userRepository, {
        findActiveUsersByRoleId: async () => [],
      }],
      [browserSessionService, {
        invalidateBrowserSessionsForUsers: async () => {
          invalidationCallCount += 1;
          return 0;
        },
      }],
      [audit, {
        recordAuditEventIfAvailable: async () => null,
      }],
    ],
    async () => {
      const result = await roleService.updateCompanyRole(
        '10',
        { permissionCodes: ['inventory.manage'] },
        { companyId: '1', roleId: '99' },
        createRequest(),
      );
      assert.equal(result.permissions.length, 1);
      assert.equal(invalidationCallCount, 0);
    },
  );
});

test('updateCompanyRole returns store-unavailable semantics when role persistence succeeds but session invalidation fails', async () => {
  let persistenceCompleted = false;

  await withStubs(
    [
      [roleRepository, {
        findCompanyOwnedRoleById: async () => createCompanyRole(),
        findRoleById: async () => {
          throw new Error('findRoleById should not be used when company-scoped role exists');
        },
        findActivePermissions: async () => [{ code: 'inventory.manage' }],
        updateCompanyRolePermissions: async () => {
          persistenceCompleted = true;
          return {
            ...createCompanyRole(),
            rolePermissions: [
              { isEnabled: true, permission: { code: 'inventory.manage', isActive: true } },
            ],
          };
        },
      }],
      [userRepository, {
        findActiveUsersByRoleId: async () => [{ id: 71n }],
      }],
      [browserSessionService, {
        invalidateBrowserSessionsForUsers: async () => {
          const error = new Error('No se pudo invalidar la sesion browser en este momento. Intente de nuevo en unos momentos.');
          error.statusCode = 503;
          error.code = 'service_unavailable';
          throw error;
        },
      }],
      [audit, {
        recordAuditEventIfAvailable: async () => null,
      }],
    ],
    async () => {
      await assert.rejects(
        () => roleService.updateCompanyRole(
          '10',
          { permissionCodes: ['inventory.manage'] },
          { companyId: '1', roleId: '99' },
          createRequest(),
        ),
        (error) => {
          assert.equal(persistenceCompleted, true);
          assert.equal(error.statusCode, 503);
          assert.equal(error.code, 'service_unavailable');
          return true;
        },
      );
    },
  );
});

test('updateCompanyRole deduplicates permission codes', async () => {
  let updatedArgs = null;

  await withStubs(
    [
      [roleRepository, {
        findCompanyOwnedRoleById: async () => createCompanyRole(),
        findRoleById: async () => {
          throw new Error('findRoleById should not be used when company-scoped role exists');
        },
        findActivePermissions: async () => [{ code: 'inventory.manage' }],
        updateCompanyRolePermissions: async (args) => {
          updatedArgs = args;
          return {
            ...createCompanyRole(),
            rolePermissions: [
              { isEnabled: true, permission: { code: 'inventory.manage', isActive: true } },
            ],
          };
        },
      }],
      [userRepository, {
        findActiveUsersByRoleId: async () => [],
      }],
      [audit, {
        recordAuditEventIfAvailable: async () => null,
      }],
    ],
    async () => {
      await roleService.updateCompanyRole(
        '10',
        { permissionCodes: ['inventory.manage', 'inventory.manage', 'inventory.manage'] },
        { companyId: '1', roleId: '99' },
        createRequest(),
      );
      assert.deepEqual(updatedArgs.permissionCodes, ['inventory.manage']);
    },
  );
});
