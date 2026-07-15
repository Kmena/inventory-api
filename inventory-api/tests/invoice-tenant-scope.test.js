const test = require('node:test');
const assert = require('node:assert/strict');

const invoiceRepository = require('../src/repositories/invoice.repository');
const clientRepository = require('../src/repositories/client.repository');
const orderRepository = require('../src/repositories/order.repository');
const invoiceService = require('../src/services/invoice.service');

function withRepositoryStubs(stubsByModule, run) {
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

test('listInvoices rejects authenticated users without company scope', async () => {
  await assert.rejects(
    () => invoiceService.listInvoices({ companyId: null }),
    (error) => {
      assert.equal(error.statusCode, 403);
      assert.equal(error.code, 'forbidden');
      return true;
    },
  );
});

test('listInvoices queries only invoices within the authenticated company', async () => {
  let receivedCompanyId = null;

  const invoices = await withRepositoryStubs(
    [[invoiceRepository, {
      findCompanyInvoices: async (companyId) => {
        receivedCompanyId = companyId;
        return [{ id: 1n, number: 'F-001' }];
      },
    }]],
    () => invoiceService.listInvoices({ companyId: '12' }),
  );

  assert.equal(receivedCompanyId, 12n);
  assert.deepEqual(invoices, [{ id: 1n, number: 'F-001' }]);
});

test('getInvoice returns not found when invoice belongs to another tenant', async () => {
  await withRepositoryStubs(
    [[invoiceRepository, {
      findCompanyInvoiceById: async () => null,
    }]],
    async () => {
      await assert.rejects(
        () => invoiceService.getInvoice(9n, { companyId: '44' }),
        (error) => {
          assert.equal(error.statusCode, 404);
          assert.equal(error.code, 'not_found');
          return true;
        },
      );
    },
  );
});

test('getInvoice scopes detail lookup using the authenticated company', async () => {
  let receivedLookup = null;

  const invoice = await withRepositoryStubs(
    [[invoiceRepository, {
      findCompanyInvoiceById: async (invoiceId, companyId) => {
        receivedLookup = { invoiceId, companyId };
        return { id: invoiceId, number: 'F-777' };
      },
    }]],
    () => invoiceService.getInvoice(7n, { companyId: '90' }),
  );

  assert.deepEqual(receivedLookup, { invoiceId: 7n, companyId: 90n });
  assert.deepEqual(invoice, { id: 7n, number: 'F-777' });
});

test('createInvoice rejects a client from another tenant', async () => {
  await withRepositoryStubs(
    [
      [clientRepository, {
        findCompanyClientById: async () => null,
      }],
      [invoiceRepository, {
        createInvoice: async () => {
          throw new Error('should not create');
        },
      }],
    ],
    async () => {
      await assert.rejects(
        () => invoiceService.createInvoice({ clientId: 8n, number: 'F-010' }, { companyId: '5' }),
        (error) => {
          assert.equal(error.statusCode, 400);
          assert.equal(error.code, 'validation_error');
          return true;
        },
      );
    },
  );
});

test('createInvoice rejects an order from another tenant', async () => {
  await withRepositoryStubs(
    [
      [clientRepository, {
        findCompanyClientById: async () => ({ id: 2n, companyId: 5n }),
      }],
      [orderRepository, {
        findOrderById: async () => null,
      }],
    ],
    async () => {
      await assert.rejects(
        () => invoiceService.createInvoice({ clientId: 2n, orderId: 44n, number: 'F-011' }, { companyId: '5' }),
        (error) => {
          assert.equal(error.statusCode, 400);
          assert.equal(error.code, 'validation_error');
          return true;
        },
      );
    },
  );
});

test('updateInvoice validates references and scopes write to the authenticated company', async () => {
  let receivedUpdate = null;

  const updatedInvoice = await withRepositoryStubs(
    [
      [invoiceRepository, {
        findCompanyInvoiceById: async () => ({ id: 6n, clientId: 2n, orderId: 4n, number: 'F-020' }),
        updateCompanyInvoice: async (invoiceId, companyId, payload) => {
          receivedUpdate = { invoiceId, companyId, payload };
          return { id: invoiceId, ...payload };
        },
      }],
      [clientRepository, {
        findCompanyClientById: async (clientId, companyId) => ({ id: clientId, companyId }),
      }],
      [orderRepository, {
        findOrderById: async (orderId, companyId) => ({ id: orderId, companyId }),
      }],
    ],
    () => invoiceService.updateInvoice(6n, { clientId: 3n, orderId: 9n, number: 'F-020-A' }, { companyId: '14' }),
  );

  assert.deepEqual(receivedUpdate, {
    invoiceId: 6n,
    companyId: 14n,
    payload: { clientId: 3n, orderId: 9n, number: 'F-020-A', dueAt: undefined, paidAt: undefined },
  });
  assert.deepEqual(updatedInvoice, { id: 6n, clientId: 3n, orderId: 9n, number: 'F-020-A', dueAt: undefined, paidAt: undefined });
});

test('removeInvoice rejects deleting an invoice outside the authenticated tenant', async () => {
  let deleteCalled = false;

  await withRepositoryStubs(
    [[invoiceRepository, {
      findCompanyInvoiceById: async () => null,
      cancelCompanyInvoice: async () => {
        deleteCalled = true;
      },
    }]],
    async () => {
      await assert.rejects(
        () => invoiceService.removeInvoice(99n, { companyId: '19' }),
        (error) => {
          assert.equal(error.statusCode, 404);
          assert.equal(error.code, 'not_found');
          return true;
        },
      );
    },
  );

  assert.equal(deleteCalled, false);
});

test('removeInvoice converts DELETE compatibility flow into cancellation', async () => {
  let receivedCancellation = null;

  const result = await withRepositoryStubs(
    [[invoiceRepository, {
      findCompanyInvoiceById: async () => ({ id: 40n, clientId: 3n, status: 'PENDING', number: 'F-040' }),
      cancelCompanyInvoice: async (invoiceId, companyId) => {
        receivedCancellation = { invoiceId, companyId };
        return { count: 1 };
      },
    }]],
    () => invoiceService.removeInvoice(40n, { companyId: '19' }),
  );

  assert.deepEqual(receivedCancellation, { invoiceId: 40n, companyId: 19n });
  assert.deepEqual(result, { count: 1 });
});

test('removeInvoice rejects repeated cancellation attempts with controlled conflict', async () => {
  await withRepositoryStubs(
    [[invoiceRepository, {
      findCompanyInvoiceById: async () => ({ id: 40n, clientId: 3n, status: 'CANCELLED', number: 'F-040' }),
    }]],
    async () => {
      await assert.rejects(
        () => invoiceService.removeInvoice(40n, { companyId: '19' }),
        (error) => {
          assert.equal(error.statusCode, 409);
          assert.equal(error.code, 'conflict');
          return true;
        },
      );
    },
  );
});

test('listInvoiceDebtInconsistencies ignores reversed payments in pending calculations', async () => {
  const result = await withRepositoryStubs(
    [[invoiceRepository, {
      findInvoicesForDebtReview: async () => ([{
        id: 50n,
        number: 'F-050',
        amount: 100,
        status: 'PENDING',
        issuedAt: new Date('2026-07-15T00:00:00Z'),
        dueAt: null,
        clientId: 3n,
        client: { id: 3n, code: 'C-3', name: 'Cliente 3' },
        order: {
          id: 5n,
          clientId: 3n,
          clientStoreId: 9n,
          clientStore: { id: 9n, name: 'Tienda 9', clientId: 99n },
        },
        payments: [
          { id: 1n, amount: 20, status: 'ACTIVE' },
          { id: 2n, amount: 30, status: 'REVERSED' },
        ],
      }]),
    }]],
    () => invoiceService.listInvoiceDebtInconsistencies({ companyId: '77' }),
  );

  assert.equal(result.summary.total, 1);
  assert.equal(result.invoices[0].pendingAmount, 80);
});
