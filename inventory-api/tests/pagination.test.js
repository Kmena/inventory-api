const test = require('node:test');
const assert = require('node:assert/strict');

const clientRepository = require('../src/repositories/client.repository');
const clientService = require('../src/services/client.service');
const productRepository = require('../src/repositories/product.repository');
const productService = require('../src/services/product.service');
const invoiceRepository = require('../src/repositories/invoice.repository');
const invoiceService = require('../src/services/invoice.service');
const paymentRepository = require('../src/repositories/payment.repository');
const paymentService = require('../src/services/payment.service');
const orderRepository = require('../src/repositories/order.repository');
const orderService = require('../src/services/order.service');
const userRepository = require('../src/repositories/user.repository');
const userService = require('../src/services/user.service');
const warehouseRepository = require('../src/repositories/warehouse.repository');
const warehouseService = require('../src/services/warehouse.service');
const roleRepository = require('../src/repositories/role.repository');
const roleService = require('../src/services/role.service');
const inventoryRepository = require('../src/repositories/inventory.repository');
const inventoryService = require('../src/services/inventory.service');
const { parsePaginationQuery } = require('../src/lib/pagination');

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

test('parsePaginationQuery returns normalized pagination when page params are present', () => {
  assert.deepEqual(parsePaginationQuery({ page: '2', pageSize: '10' }), {
    page: 2,
    pageSize: 10,
    skip: 10,
    take: 10,
  });
});

test('parsePaginationQuery rejects pageSize above the configured maximum', () => {
  assert.throws(
    () => parsePaginationQuery({ pageSize: '101' }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, 'validation_error');
      return true;
    },
  );
});

test('listCompanyClients returns paginated metadata when pagination is requested', async () => {
  let receivedPagination = null;

  const result = await withStubs(
    [[clientRepository, {
      findCompanyClients: async (_companyId, pagination) => {
        receivedPagination = pagination;
        return {
          totalItems: 3,
          items: [{ id: 7n, name: 'Cliente A', _count: { stores: 1 } }],
        };
      },
    }]],
    () => clientService.listCompanyClients({ companyId: '15' }, { page: 2, pageSize: 1, skip: 1, take: 1 }),
  );

  assert.deepEqual(receivedPagination, { page: 2, pageSize: 1, skip: 1, take: 1 });
  assert.deepEqual(result, {
    items: [{ id: 7n, name: 'Cliente A', _count: { stores: 1 }, storesCount: 1 }],
    pagination: {
      page: 2,
      pageSize: 1,
      totalItems: 3,
      totalPages: 3,
    },
  });
});

test('listProducts preserves permission-aware serialization inside paginated results', async () => {
  const result = await withStubs(
    [[productRepository, {
      findAllProducts: async () => ({
        totalItems: 2,
        items: [{ id: 1n, name: 'Producto A', quantity: 10, reservedQuantity: 2 }],
      }),
    }]],
    () => productService.listProducts(
      { companyId: '8', sub: '4', permissions: ['products.view'] },
      { page: 1, pageSize: 25, skip: 0, take: 25 },
    ),
  );

  assert.deepEqual(result, {
    items: [{ id: 1n, name: 'Producto A' }],
    pagination: {
      page: 1,
      pageSize: 25,
      totalItems: 2,
      totalPages: 1,
    },
  });
});

test('listInvoices returns paginated responses without changing legacy tenant scoping', async () => {
  let receivedCompanyId = null;

  const result = await withStubs(
    [[invoiceRepository, {
      findCompanyInvoices: async (companyId, pagination) => {
        receivedCompanyId = companyId;
        assert.deepEqual(pagination, { page: 1, pageSize: 2, skip: 0, take: 2 });
        return {
          totalItems: 5,
          items: [{ id: 11n, number: 'F-001' }],
        };
      },
    }]],
    () => invoiceService.listInvoices({ companyId: '21' }, { page: 1, pageSize: 2, skip: 0, take: 2 }),
  );

  assert.equal(receivedCompanyId, 21n);
  assert.deepEqual(result.pagination, {
    page: 1,
    pageSize: 2,
    totalItems: 5,
    totalPages: 3,
  });
  assert.deepEqual(result.items, [{ id: 11n, number: 'F-001' }]);
});

test('listOrders preserves the legacy array response when pagination is not requested', async () => {
  const result = await withStubs(
    [[orderRepository, {
      findAllOrders: async (_companyId, pagination) => {
        assert.equal(pagination, null);
        return [{ id: 81n, status: 'DRAFT' }];
      },
    }]],
    () => orderService.listOrders({ companyId: '9', sub: '4', role: 'sales' }),
  );

  assert.deepEqual(result, [{ id: 81n, status: 'DRAFT' }]);
});

test('listOrders returns paginated metadata only when pagination is requested', async () => {
  const result = await withStubs(
    [[orderRepository, {
      findAllOrders: async (_companyId, pagination) => {
        assert.deepEqual(pagination, { page: 2, pageSize: 1, skip: 1, take: 1 });
        return {
          totalItems: 3,
          items: [{ id: 82n, status: 'APPROVED' }],
        };
      },
    }]],
    () => orderService.listOrders({ companyId: '9', sub: '4', role: 'sales' }, { page: 2, pageSize: 1, skip: 1, take: 1 }),
  );

  assert.deepEqual(result, {
    items: [{ id: 82n, status: 'APPROVED' }],
    pagination: {
      page: 2,
      pageSize: 1,
      totalItems: 3,
      totalPages: 3,
    },
  });
});

test('listPayments returns paginated responses when requested', async () => {
  const result = await withStubs(
    [[paymentRepository, {
      findCompanyPayments: async () => ({
        totalItems: 4,
        items: [{ id: 5n, amount: 100, receipts: [] }],
      }),
    }]],
    () => paymentService.listPayments({ companyId: '9', permissions: ['sales.manage'] }, { page: 2, pageSize: 1, skip: 1, take: 1 }),
  );

  assert.deepEqual(result, {
    items: [{ id: 5n, amount: 100, receipts: [] }],
    pagination: {
      page: 2,
      pageSize: 1,
      totalItems: 4,
      totalPages: 4,
    },
  });
});

test('listUsers returns paginated metadata when requested', async () => {
  const result = await withStubs(
    [[userRepository, {
      findAllUsers: async () => ({
        totalItems: 2,
        items: [{ id: 1n, username: 'root', passwordHash: 'secret' }],
      }),
    }]],
    () => userService.listUsers({ page: 1, pageSize: 1, skip: 0, take: 1 }),
  );

  assert.deepEqual(result, {
    items: [{ id: 1n, username: 'root' }],
    pagination: {
      page: 1,
      pageSize: 1,
      totalItems: 2,
      totalPages: 2,
    },
  });
});

test('listCompanyWarehouses returns paginated items while preserving summary and warehouseTypes', async () => {
  const result = await withStubs(
    [[warehouseRepository, {
      findCompanyWarehouses: async () => ({
        totalItems: 3,
        summary: { total: 3, active: 2, virtual: 1, sellable: 1 },
        items: [{
          id: 5n,
          companyId: 9n,
          code: 'BOD-01',
          name: 'Bodega Central',
          warehouseType: 'PHYSICAL',
          isVirtual: false,
          isSellableSource: true,
          isActive: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z',
        }],
      }),
    }]],
    () => warehouseService.listCompanyWarehouses({ companyId: '9' }, { page: 1, pageSize: 1, skip: 0, take: 1 }),
  );

  assert.equal(result.summary.total, 3);
  assert.equal(result.pagination.totalItems, 3);
  assert.equal(result.items[0].warehouseTypeLabel, 'General');
  assert.ok(Array.isArray(result.warehouseTypes));
});

test('listAssignableRoles returns paginated metadata when requested', async () => {
  const result = await withStubs(
    [[roleRepository, {
      findAssignableRoles: async () => ({
        totalItems: 4,
        items: [{
          id: 6n,
          code: 'admin_local',
          name: 'Admin local',
          companyId: 2n,
          isActive: true,
          rolePermissions: [{ isEnabled: true, permission: { code: 'users.view', isActive: true } }],
        }],
      }),
    }]],
    () => roleService.listAssignableRoles({ companyId: '2' }, { page: 2, pageSize: 1, skip: 1, take: 1 }),
  );

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].id, 6n);
  assert.equal(result.items[0].code, 'admin_local');
  assert.equal(result.items[0].name, 'Admin local');
  assert.equal(result.items[0].companyId, 2n);
  assert.equal(result.items[0].isActive, true);
  assert.equal(result.items[0].permissions.length, 1);
  assert.equal(result.items[0].permissions[0].code, 'users.view');
  assert.deepEqual(result.pagination, {
    page: 2,
    pageSize: 1,
    totalItems: 4,
    totalPages: 4,
  });
});

test('listMovements returns paginated metadata and preserves filters', async () => {
  let receivedFilters = null;
  let receivedPagination = null;

  const result = await withStubs(
    [[inventoryRepository, {
      findAllMovements: async (_companyId, filters, pagination) => {
        receivedFilters = filters;
        receivedPagination = pagination;
        return {
          totalItems: 8,
          items: [{ id: 99n, movementType: 'ENTRY' }],
        };
      },
    }]],
    () => inventoryService.listMovements(
      { companyId: '13', sub: '2' },
      { warehouseId: 7n, productId: 8n },
      { page: 1, pageSize: 5, skip: 0, take: 5 },
    ),
  );

  assert.deepEqual(receivedFilters, { warehouseId: 7n, productId: 8n });
  assert.deepEqual(receivedPagination, { page: 1, pageSize: 5, skip: 0, take: 5 });
  assert.deepEqual(result, {
    items: [{ id: 99n, movementType: 'ENTRY' }],
    pagination: {
      page: 1,
      pageSize: 5,
      totalItems: 8,
      totalPages: 2,
    },
  });
});
