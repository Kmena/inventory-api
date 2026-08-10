const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');

process.env.NODE_ENV = 'test';
process.env.BROWSER_SESSION_STORE_MODE = 'memory';

const audit = require('../src/lib/audit');
const authService = require('../src/services/auth.service');
const authorize = require('../src/middlewares/authorize');
const authorizePermission = require('../src/middlewares/authorizePermission');
const { authorizeAccessPolicy } = require('../src/security/access-policies');
const paymentService = require('../src/services/payment.service');
const invoiceService = require('../src/services/invoice.service');
const orderService = require('../src/services/order.service');
const companyService = require('../src/services/company.service');
const userService = require('../src/services/user.service');
const roleService = require('../src/services/role.service');
const inventoryService = require('../src/services/inventory.service');
const userRepository = require('../src/repositories/user.repository');
const paymentRepository = require('../src/repositories/payment.repository');
const invoiceRepository = require('../src/repositories/invoice.repository');
const orderRepository = require('../src/repositories/order.repository');
const companyRepository = require('../src/repositories/company.repository');
const roleRepository = require('../src/repositories/role.repository');
const inventoryRepository = require('../src/repositories/inventory.repository');

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

function createPassThroughTransactionStub() {
  return async (work) => work({
    kind: 'tx',
    // TASK-015: creditBalance update stubs — no-op; these audit tests do not assert on balance changes
    invoice: { findUnique: async () => null },
    client: { update: async () => null },
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
      requestId: 'req-test-1',
      method: 'POST',
      path: '/api/test',
      ip: '127.0.0.1',
      userAgent: 'audit-test-agent',
      actor: null,
    },
  };
}

test('authService.login records a SUCCESS audit event without persisting the password', async () => {
  const passwordHash = await bcrypt.hash('secret123', 4);
  const recordedEvents = [];

  await withStubs(
    [
      [userRepository, {
        findUserByUsernameWithRelations: async () => ({
          id: 11n,
          username: 'alice',
          passwordHash,
          status: 'ACTIVE',
          companyId: 7n,
          role: { code: 'admin', isActive: true, rolePermissions: [] },
          company: { isActive: true },
        }),
      }],
      [audit, {
        recordAuditEventIfAvailable: async (payload) => {
          recordedEvents.push(payload);
        },
      }],
    ],
    async () => {
      const result = await authService.login({ username: 'alice', password: 'secret123' }, createRequest());
      assert.equal(typeof result.token, 'string');
      assert.equal(result.user.username, 'alice');
      assert.equal(result.user.id, '11');
      assert.equal(result.user.companyId, '7');
      assert.equal(result.user.role.code, 'admin');
      assert.equal(typeof result.user.id, 'string');
      assert.equal(typeof result.user.companyId, 'string');
    },
  );

  assert.equal(recordedEvents.length, 1);
  assert.equal(recordedEvents[0].action, 'auth.login');
  assert.equal(recordedEvents[0].outcome, 'SUCCESS');
  assert.deepEqual(recordedEvents[0].metadata, { username: 'alice' });
  assert.equal('password' in recordedEvents[0].metadata, false);
});

test('authService.login records a REJECTED audit event for invalid credentials', async () => {
  const passwordHash = await bcrypt.hash('correct-password', 4);
  const recordedEvents = [];

  await withStubs(
    [
      [userRepository, {
        findUserByUsernameWithRelations: async () => ({
          id: 12n,
          username: 'bob',
          passwordHash,
          status: 'ACTIVE',
          companyId: 8n,
          role: { code: 'sales', isActive: true, rolePermissions: [] },
          company: { isActive: true },
        }),
      }],
      [audit, {
        recordAuditEventIfAvailable: async (payload) => {
          recordedEvents.push(payload);
        },
      }],
    ],
    async () => {
      await assert.rejects(
        () => authService.login({ username: 'bob', password: 'wrong-password' }, createRequest()),
        (error) => error.code === 'unauthorized',
      );
    },
  );

  assert.equal(recordedEvents.length, 1);
  assert.equal(recordedEvents[0].action, 'auth.login');
  assert.equal(recordedEvents[0].outcome, 'REJECTED');
  assert.equal(recordedEvents[0].reasonCode, 'invalid_credentials');
});

test('authorize records role-based denials as audit events', async () => {
  const recordedEvents = [];
  const guard = authorize('admin');
  let nextError = null;

  await withStubs(
    [[audit, {
      recordAuditEventSafelyIfAvailable: async (payload) => {
        recordedEvents.push(payload);
      },
    }]],
    async () => {
      await guard({ auth: { role: 'sales' }, requestContext: { requestId: 'req-role-1' } }, {}, (error) => {
        nextError = error;
      });
    },
  );

  assert.equal(nextError?.code, 'forbidden');
  assert.equal(recordedEvents.length, 1);
  assert.equal(recordedEvents[0].action, 'security.authorization.role');
  assert.equal(recordedEvents[0].reasonCode, 'role_denied');
});

test('authorizePermission records permission denials as audit events', async () => {
  const recordedEvents = [];
  const guard = authorizePermission('inventory.manage');
  let nextError = null;

  await withStubs(
    [[audit, {
      recordAuditEventSafelyIfAvailable: async (payload) => {
        recordedEvents.push(payload);
      },
    }]],
    async () => {
      await guard({ auth: { permissions: ['inventory.view'] }, requestContext: { requestId: 'req-perm-1' } }, {}, (error) => {
        nextError = error;
      });
    },
  );

  assert.equal(nextError?.code, 'forbidden');
  assert.equal(recordedEvents.length, 1);
  assert.equal(recordedEvents[0].action, 'security.authorization.permission');
  assert.equal(recordedEvents[0].reasonCode, 'permission_denied');
});

test('authorizeAccessPolicy records actor-scope denials as route-level audit events', async () => {
  const recordedEvents = [];
  const guard = authorizeAccessPolicy('company.list-global');
  let nextError = null;

  await withStubs(
    [[audit, {
      recordAuditEventSafelyIfAvailable: async (payload) => {
        recordedEvents.push(payload);
      },
    }]],
    async () => {
      await guard({ auth: { role: 'root', companyId: '7' }, requestContext: { requestId: 'req-access-policy-1' } }, {}, (error) => {
        nextError = error;
      });
    },
  );

  assert.equal(nextError?.code, 'forbidden');
  assert.equal(recordedEvents.length, 1);
  assert.equal(recordedEvents[0].action, 'security.authorization.access_policy');
  assert.equal(recordedEvents[0].reasonCode, 'actor_scope_denied');
  assert.equal(recordedEvents[0].metadata.policyId, 'company.list-global');
  assert.equal(recordedEvents[0].metadata.actorScope, 'global-root');
});

test('paymentService.removePayment records a payment reversal audit event', async () => {
  const recordedEvents = [];

  await withStubs(
    [
      [paymentRepository, {
        transaction: createPassThroughTransactionStub(),
        findCompanyPaymentById: async () => ({
          id: 21n,
          invoiceId: 5n,
          amount: 99,
          status: 'APPROVED',
          invoice: { id: 5n, client: { companyId: 1n } },
          receipts: [],
        }),
        reverseCompanyPayment: async () => ({ count: 1 }),
      }],
      [invoiceRepository, {
        findCompanyInvoiceForFinancialSync: async () => ({
          id: 5n,
          amount: 99,
          status: 'PAID',
          paidAt: new Date('2026-07-20T10:00:00Z'),
          client: { companyId: 1n },
          payments: [],
        }),
        updateCompanyInvoiceFinancialState: async () => ({ id: 5n, status: 'PENDING', paidAt: null }),
      }],
      [audit, {
        recordAuditEventIfAvailable: async (payload) => {
          recordedEvents.push(payload);
        },
      }],
    ],
    async () => {
      await paymentService.removePayment(21n, { companyId: '1', sub: '10', permissions: ['collections.payments.reverse'] }, createRequest());
    },
  );

  assert.equal(recordedEvents.length, 1);
  assert.equal(recordedEvents[0].action, 'payments.reverse');
  assert.equal(recordedEvents[0].resourceType, 'payment');
});

test('invoiceService.removeInvoice records an invoice cancellation audit event', async () => {
  const recordedEvents = [];

  await withStubs(
    [
      [invoiceRepository, {
        findCompanyInvoiceById: async () => ({ id: 31n, clientId: 4n, orderId: 2n, amount: 150, status: 'PENDING' }),
        cancelCompanyInvoice: async () => ({ count: 1 }),
      }],
      [audit, {
        recordAuditEventIfAvailable: async (payload) => {
          recordedEvents.push(payload);
        },
      }],
    ],
    async () => {
      await invoiceService.removeInvoice(31n, { companyId: '1' }, createRequest());
    },
  );

  assert.equal(recordedEvents.length, 1);
  assert.equal(recordedEvents[0].action, 'invoices.cancel');
  assert.equal(recordedEvents[0].resourceType, 'invoice');
});

test('orderService.createOrder records an order creation audit event', async () => {
  const recordedEvents = [];

  await withStubs(
    [
      [orderRepository, {
        findCompanyClientStore: async () => ({ id: 9n, clientId: 5n }),
        countCompanyProducts: async () => 1,
        createOrder: async () => ({ id: 41n, clientId: 5n, clientStoreId: 9n, warehouseId: null, status: 'DRAFT', approved: false, items: [{ id: 1n }] }),
      }],
      [audit, {
        recordAuditEventIfAvailable: async (payload) => {
          recordedEvents.push(payload);
        },
      }],
    ],
    async () => {
      await orderService.createOrder({ clientId: 5n, clientStoreId: 9n, items: [{ productId: 7n, quantity: 2 }] }, {
        companyId: '1',
        sub: '10',
        role: 'sales',
        permissions: ['sales.manage'],
      }, createRequest());
    },
  );

  assert.equal(recordedEvents.length, 1);
  assert.equal(recordedEvents[0].action, 'orders.create');
});

test('companyService.registerCompany records a company audit event', async () => {
  const recordedEvents = [];

  await withStubs(
    [
      [companyRepository, {
        createCompany: async () => ({ id: 51n, name: 'Acme', legalId: '123', isActive: true }),
      }],
      [audit, {
        recordAuditEventIfAvailable: async (payload) => {
          recordedEvents.push(payload);
        },
      }],
    ],
    async () => {
      await companyService.registerCompany({ name: 'Acme' }, { role: 'root', companyId: null }, createRequest());
    },
  );

  assert.equal(recordedEvents.length, 1);
  assert.equal(recordedEvents[0].action, 'companies.create');
});

test('userService.registerCompanyUser records an administrative user audit event', async () => {
  const passwordHash = await bcrypt.hash('user-pass', 4);
  const recordedEvents = [];

  await withStubs(
    [
      [userRepository, {
        findUserByUsername: async () => null,
        createUser: async () => ({ id: 61n, companyId: 7n, roleId: 3n, username: 'worker', status: 'ACTIVE', passwordHash }),
      }],
      [roleRepository, {
        findRoleById: async () => ({ id: 3n, code: 'sales', companyId: 7n, isActive: true }),
      }],
      [audit, {
        recordAuditEventIfAvailable: async (payload) => {
          recordedEvents.push(payload);
        },
      }],
    ],
    async () => {
      await userService.registerCompanyUser({ username: 'worker', password: 'user-pass', roleId: 3n }, { companyId: '7' }, createRequest());
    },
  );

  assert.equal(recordedEvents.length, 1);
  assert.equal(recordedEvents[0].action, 'users.company.create');
});

test('roleService.createCompanyRole records a governance denial audit event distinct from success auditing', async () => {
  const recordedDenials = [];

  await withStubs(
    [
      [roleRepository, {
        findActivePermissions: async () => [{ code: 'companies.manage' }, { code: 'inventory.manage' }],
      }],
      [audit, {
        recordAuditEventSafelyIfAvailable: async (payload) => {
          recordedDenials.push(payload);
        },
      }],
    ],
    async () => {
      await assert.rejects(
        () => roleService.createCompanyRole({ name: 'Platform Role', permissionCodes: ['companies.manage'] }, { companyId: '1' }, createRequest()),
        (error) => error.code === 'platform_permission_not_assignable',
      );
    },
  );

  assert.equal(recordedDenials.length, 1);
  assert.equal(recordedDenials[0].action, 'roles.company.create.governance_denied');
  assert.equal(recordedDenials[0].outcome, 'REJECTED');
  assert.equal(recordedDenials[0].reasonCode, 'platform_permission_not_assignable');
  assert.deepEqual(recordedDenials[0].metadata.affectedPermissions, ['companies.manage']);
});

test('roleService.createCompanyRole records an administrative role audit event', async () => {
  const recordedEvents = [];

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
          recordedEvents.push(payload);
        },
      }],
    ],
    async () => {
      await roleService.createCompanyRole({ name: 'Inventory Admin', permissionCodes: ['inventory.manage'] }, { companyId: '1' }, createRequest());
    },
  );

  assert.equal(recordedEvents.length, 1);
  assert.equal(recordedEvents[0].action, 'roles.company.create');
});

test('inventoryService.updateLotQa records a QA audit event', async () => {
  const recordedEvents = [];

  await withStubs(
    [
      [inventoryRepository, {
        transaction: async () => ({
          previousLot: { id: 81n, status: 'QUARANTINED', qaStatus: 'PENDING' },
          updatedLot: { id: 81n, status: 'AVAILABLE', qaStatus: 'APPROVED' },
        }),
      }],
      [audit, {
        recordAuditEventIfAvailable: async (payload) => {
          recordedEvents.push(payload);
        },
      }],
    ],
    async () => {
      const updatedLot = await inventoryService.updateLotQa(81n, { action: 'APPROVE', reason: 'QA ok' }, { companyId: '1', sub: '10' }, createRequest());
      assert.equal(updatedLot.qaStatus, 'APPROVED');
    },
  );

  assert.equal(recordedEvents.length, 1);
  assert.equal(recordedEvents[0].action, 'inventory.lot.qa.update');
});

test('inventoryService.adjustStock records a manual adjustment audit event', async () => {
  const recordedEvents = [];

  await withStubs(
    [
      [inventoryRepository, {
        transaction: async () => ({
          product: { id: 91n },
          warehouseStock: { warehouseId: 4n },
          lot: { id: 15n },
          movement: { id: 101n, quantity: 3, movementType: 'ADJUSTMENT' },
        }),
      }],
      [audit, {
        recordAuditEventIfAvailable: async (payload) => {
          recordedEvents.push(payload);
        },
      }],
    ],
    async () => {
      await inventoryService.adjustStock({ direction: 'IN', quantity: 3, reasonCode: 'MANUAL_FIX' }, { companyId: '1', sub: '10' }, createRequest());
    },
  );

  assert.equal(recordedEvents.length, 1);
  assert.equal(recordedEvents[0].action, 'inventory.stock.adjust');
});
