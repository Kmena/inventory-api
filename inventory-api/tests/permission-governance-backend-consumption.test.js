const test = require('node:test');
const assert = require('node:assert/strict');

const companyService = require('../src/services/company.service');
const roleService = require('../src/services/role.service');
const companyRepository = require('../src/repositories/company.repository');
const roleRepository = require('../src/repositories/role.repository');
const audit = require('../src/lib/audit');
const auditRepository = require('../src/repositories/audit.repository');

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
    method: 'POST',
    originalUrl: '/api/test',
    baseUrl: '/api/test',
    route: { path: '/' },
    headers: {},
    get(headerName) {
      return this.headers[headerName.toLowerCase()] || null;
    },
    requestContext: {
      requestId: 'req-governance-1',
      method: 'POST',
      path: '/api/test',
      ip: '127.0.0.1',
      userAgent: 'governance-test-agent',
      actor: null,
    },
  };
}

test('companyService.registerCompany denies non-global-root actors before persistence', async () => {
  let repositoryCalled = false;

  await withStubs(
    [[companyRepository, {
      createCompany: async () => {
        repositoryCalled = true;
        return { id: 1n };
      },
    }]],
    async () => {
      await assert.rejects(
        () => companyService.registerCompany({ name: 'Blocked Company' }, { role: 'admin', companyId: '7' }, createRequest()),
        (error) => {
          assert.equal(error.statusCode, 403);
          assert.equal(error.code, 'forbidden');
          assert.equal(repositoryCalled, false);
          return true;
        },
      );
    },
  );
});

test('companyService.registerCompany allows global root actors to persist', async () => {
  let repositoryCalled = false;

  await withStubs(
    [
      [companyRepository, {
        createCompany: async () => {
          repositoryCalled = true;
          return { id: 22n, name: 'Allowed Company', legalId: '123', isActive: true };
        },
      }],
      [audit, {
        recordAuditEventIfAvailable: async () => null,
      }],
    ],
    async () => {
      const result = await companyService.registerCompany({ name: 'Allowed Company' }, { role: 'root', companyId: null }, createRequest());
      assert.equal(result.id, 22n);
      assert.equal(repositoryCalled, true);
    },
  );
});

test('roleService.createCompanyRole denies platform-scoped permissions before persistence and records a governance denial audit attempt', async () => {
  let repositoryCalled = false;
  let auditPayload = null;

  await withStubs(
    [
      [roleRepository, {
        findActivePermissions: async () => [{ code: 'companies.manage' }, { code: 'inventory.manage' }],
        createCompanyRole: async () => {
          repositoryCalled = true;
          return { id: 99n };
        },
      }],
      [audit, {
        recordAuditEventSafelyIfAvailable: async (payload) => {
          auditPayload = payload;
        },
      }],
    ],
    async () => {
      await assert.rejects(
        () => roleService.createCompanyRole({ name: 'Platform Role', permissionCodes: ['companies.manage'] }, { companyId: '1' }, createRequest()),
        (error) => {
          assert.equal(error.statusCode, 403);
          assert.equal(error.code, 'platform_permission_not_assignable');
          assert.equal(repositoryCalled, false);
          assert.equal(auditPayload.action, 'roles.company.create.governance_denied');
          assert.equal(auditPayload.outcome, 'REJECTED');
          assert.equal(auditPayload.reasonCode, 'platform_permission_not_assignable');
          assert.deepEqual(auditPayload.metadata, {
            governanceDecision: 'deny',
            denialCode: 'platform_permission_not_assignable',
            ruleId: 'tenant-role-platform-permission-denied',
            affectedPermissions: ['companies.manage'],
            requestedPermissionCodes: ['companies.manage'],
            companyId: '1',
          });
          return true;
        },
      );
    },
  );
});

 test('roleService.createCompanyRole preserves the same denial response when governance denial audit persistence fails', async () => {
  let repositoryCalled = false;
  let warned = false;

  await withStubs(
    [
      [roleRepository, {
        findActivePermissions: async () => [{ code: 'companies.manage' }, { code: 'inventory.manage' }],
        createCompanyRole: async () => {
          repositoryCalled = true;
          return { id: 99n };
        },
      }],
      [auditRepository, {
        createAuditEvent: async () => {
          throw new Error('audit store unavailable');
        },
      }],
      [console, {
        warn: () => {
          warned = true;
        },
      }],
    ],
    async () => {
      await assert.rejects(
        () => roleService.createCompanyRole({ name: 'Platform Role', permissionCodes: ['companies.manage'] }, { companyId: '1' }, createRequest()),
        (error) => {
          assert.equal(error.statusCode, 403);
          assert.equal(error.code, 'platform_permission_not_assignable');
          assert.equal(repositoryCalled, false);
          assert.equal(warned, true);
          return true;
        },
      );
    },
  );
});

test('roleService.createCompanyRole records governance warnings in audit metadata while preserving creation', async () => {
  let auditPayload = null;

  await withStubs(
    [
      [roleRepository, {
        findActivePermissions: async () => [{ code: 'inventory.manage' }],
        createCompanyRole: async () => ({
          id: 71n,
          code: 'company_1_inventory_admin',
          name: 'Inventory Admin',
          companyId: 1n,
          isActive: true,
          rolePermissions: [{ isEnabled: true, permission: { code: 'inventory.manage', isActive: true } }],
        }),
      }],
      [audit, {
        recordAuditEventIfAvailable: async (payload) => {
          auditPayload = payload;
        },
      }],
    ],
    async () => {
      const role = await roleService.createCompanyRole({ name: 'Inventory Admin', permissionCodes: ['inventory.manage'] }, { companyId: '1' }, createRequest());
      assert.equal(role.name, 'Inventory Admin');
    },
  );

  assert.equal(auditPayload.metadata.governanceDecision, 'allow');
  assert.equal(Array.isArray(auditPayload.metadata.governanceWarnings), true);
  assert.equal(auditPayload.metadata.governanceWarnings.length, 1);
  assert.equal(auditPayload.metadata.governanceWarnings[0].severity, 'warn');
});

test('roleService.createCompanyRole keeps allowed tenant-scoped permissions working', async () => {
  let repositoryCalled = false;

  await withStubs(
    [
      [roleRepository, {
        findActivePermissions: async () => [{ code: 'inventory.manage' }, { code: 'users.manage' }],
        createCompanyRole: async ({ permissionCodes }) => {
          repositoryCalled = true;
          assert.deepEqual(permissionCodes, ['inventory.manage', 'users.manage']);
          return {
            id: 88n,
            code: 'company_1_ops_admin',
            name: 'Ops Admin',
            companyId: 1n,
            isActive: true,
            rolePermissions: [
              { isEnabled: true, permission: { code: 'inventory.manage', isActive: true } },
              { isEnabled: true, permission: { code: 'users.manage', isActive: true } },
            ],
          };
        },
      }],
      [audit, {
        recordAuditEventIfAvailable: async () => null,
      }],
    ],
    async () => {
      const role = await roleService.createCompanyRole(
        { name: 'Ops Admin', permissionCodes: ['inventory.manage', 'users.manage'] },
        { companyId: '1' },
        createRequest(),
      );
      assert.equal(role.name, 'Ops Admin');
      assert.equal(repositoryCalled, true);
    },
  );
});
