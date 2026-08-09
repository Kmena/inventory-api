'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const clientService = require('../src/services/client.service');
const clientRepository = require('../src/repositories/client.repository');

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

function makeAuth(companyId = '7') {
  return { sub: '15', companyId, role: 'admin', permissions: [] };
}

function makeClient(overrides = {}) {
  return {
    id: 42n,
    code: 'CLT-042',
    name: 'Test Client',
    creditLimit: 5000,
    creditBalance: 1200,
    paymentType: 'CREDIT',
    paymentDays: 30,
    invoices: [],
    ...overrides,
  };
}

function makeInvoice(overrides = {}) {
  return {
    id: 100n,
    number: 'INV-1',
    status: 'PENDING',
    amount: 500,
    dueAt: new Date('2026-10-01'),
    issuedAt: new Date('2026-09-01'),
    payments: [],
    order: { id: 1n, status: 'DELIVERED' },
    ...overrides,
  };
}

function makePayment(overrides = {}) {
  return {
    id: 200n,
    amount: 200,
    status: 'APPROVED',
    paymentMethod: 'CASH',
    createdAt: new Date('2026-09-15'),
    approvedAt: new Date('2026-09-16'),
    ...overrides,
  };
}

test('getClientLedger returns client with calculated pendingAmount and appliedAmount for invoices with payments', async () => {
  const invoice = makeInvoice({
    payments: [makePayment({ amount: 200, status: 'APPROVED' })],
  });

  await withRepositoryStubs(
    [[clientRepository, {
      findClientLedger: async (clientId, companyId) => {
        assert.equal(clientId, 42n);
        assert.equal(companyId, 7n);
        return makeClient({ invoices: [invoice] });
      },
    }]],
    async () => {
      const result = await clientService.getClientLedger(42n, makeAuth('7'));
      assert.equal(result.client.id, 42n);
      assert.equal(result.client.name, 'Test Client');
      assert.equal(result.invoices.length, 1);
      const inv = result.invoices[0];
      assert.equal(inv.appliedAmount, 200);
      assert.equal(inv.pendingAmount, 300); // 500 - 200 = 300
    },
  );
});

test('getClientLedger returns empty invoices array when client has no invoices', async () => {
  await withRepositoryStubs(
    [[clientRepository, {
      findClientLedger: async () => makeClient({ invoices: [] }),
    }]],
    async () => {
      const result = await clientService.getClientLedger(42n, makeAuth('7'));
      assert.deepEqual(result.invoices, []);
    },
  );
});

test('getClientLedger throws 404 when clientId belongs to a different company', async () => {
  await withRepositoryStubs(
    [[clientRepository, {
      findClientLedger: async () => null,
    }]],
    async () => {
      await assert.rejects(
        () => clientService.getClientLedger(999n, makeAuth('7')),
        (err) => {
          assert.equal(err.statusCode || err.status, 404);
          return true;
        },
      );
    },
  );
});

test('getClientLedger exposes creditLimit and creditBalance from client data', async () => {
  await withRepositoryStubs(
    [[clientRepository, {
      findClientLedger: async () => makeClient({ creditLimit: 10000, creditBalance: 3500 }),
    }]],
    async () => {
      const result = await clientService.getClientLedger(42n, makeAuth('7'));
      assert.equal(result.client.creditLimit, 10000);
      assert.equal(result.client.creditBalance, 3500);
    },
  );
});
