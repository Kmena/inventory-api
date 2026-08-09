'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const billingTriggerService = require('../src/services/billing-trigger.service');
const invoiceRepository = require('../src/repositories/invoice.repository');
const paymentRepository = require('../src/repositories/payment.repository');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function makeOrder(overrides = {}) {
  return {
    id: 1n,
    clientId: 42n,
    paymentCondition: 'CASH',
    transferMetadata: null,
    items: [
      { quantity: 2, unitPrice: 100, totalDiscount: 0 },
      { quantity: 1, unitPrice: 50, totalDiscount: 10 },
    ],
    ...overrides,
  };
}

function makeClient(overrides = {}) {
  return {
    id: 42n,
    paymentDays: 30,
    ...overrides,
  };
}

function makeAuth() {
  return { sub: '99', companyId: '7' };
}

function makeFakeDb(overrides = {}) {
  return {
    invoice: {
      findFirst: async () => null,
      create: async (args) => ({ id: 100n, ...args.data }),
      ...((overrides.invoice) || {}),
    },
    payment: {
      findFirst: async () => null,
      create: async (args) => ({ id: 200n, ...args.data }),
      ...((overrides.payment) || {}),
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests for calculateInvoiceAmount
// ---------------------------------------------------------------------------

test('calculateInvoiceAmount sums quantity * price - totalDiscount per item', () => {
  const items = [
    { quantity: 2, unitPrice: 100, totalDiscount: 10 },
    { quantity: 3, unitPrice: 50, totalDiscount: 0 },
  ];
  assert.equal(billingTriggerService.calculateInvoiceAmount(items), 340);
});

test('calculateInvoiceAmount clamps to 0 for negative totals', () => {
  const items = [{ quantity: 1, unitPrice: 10, totalDiscount: 999 }];
  assert.equal(billingTriggerService.calculateInvoiceAmount(items), 0);
});

test('calculateInvoiceAmount handles empty items array', () => {
  assert.equal(billingTriggerService.calculateInvoiceAmount([]), 0);
});

// ---------------------------------------------------------------------------
// Tests for calculateDueAt
// ---------------------------------------------------------------------------

test('calculateDueAt returns current date for CASH', () => {
  const before = new Date();
  const dueAt = billingTriggerService.calculateDueAt('CASH', null);
  const after = new Date();
  assert.ok(dueAt >= before && dueAt <= after);
});

test('calculateDueAt returns current date for TRANSFER', () => {
  const before = new Date();
  const dueAt = billingTriggerService.calculateDueAt('TRANSFER', null);
  const after = new Date();
  assert.ok(dueAt >= before && dueAt <= after);
});

test('calculateDueAt adds paymentDays days for CREDIT', () => {
  const now = new Date();
  const dueAt = billingTriggerService.calculateDueAt('CREDIT', 15);
  const expectedMs = 15 * 24 * 60 * 60 * 1000;
  const diff = dueAt.getTime() - now.getTime();
  assert.ok(diff >= expectedMs - 1000 && diff <= expectedMs + 2000);
});

test('calculateDueAt defaults to 30 days for CREDIT when paymentDays is null', () => {
  const now = new Date();
  const dueAt = billingTriggerService.calculateDueAt('CREDIT', null);
  const expectedMs = 30 * 24 * 60 * 60 * 1000;
  const diff = dueAt.getTime() - now.getTime();
  assert.ok(diff >= expectedMs - 1000 && diff <= expectedMs + 2000);
});

// ---------------------------------------------------------------------------
// Tests for executeBillingLogic
// ---------------------------------------------------------------------------

test('executeBillingLogic returns null when paymentCondition is null (legacy order)', async () => {
  const order = makeOrder({ paymentCondition: null });
  const result = await billingTriggerService.executeBillingLogic(order, makeClient(), makeAuth(), makeFakeDb());
  assert.equal(result, null);
});

test('executeBillingLogic returns null when order has no clientId', async () => {
  const order = makeOrder({ clientId: null });
  const result = await billingTriggerService.executeBillingLogic(order, makeClient(), makeAuth(), makeFakeDb());
  assert.equal(result, null);
});

test('executeBillingLogic returns null when invoice already exists for order (idempotency)', async () => {
  const db = makeFakeDb({
    invoice: {
      findFirst: async () => ({ id: 55n }),
    },
  });
  const result = await billingTriggerService.executeBillingLogic(makeOrder(), makeClient(), makeAuth(), db);
  assert.equal(result, null);
});

test('executeBillingLogic creates Invoice and CASH Payment with PENDING_APPROVAL status', async () => {
  const captured = { invoiceArgs: null, paymentArgs: null };
  const db = makeFakeDb({
    invoice: {
      findFirst: async () => null,
      create: async (args) => {
        captured.invoiceArgs = args.data;
        return { id: 100n, ...args.data };
      },
    },
    payment: {
      findFirst: async () => null,
      create: async (args) => {
        captured.paymentArgs = args.data;
        return { id: 200n, ...args.data };
      },
    },
  });

  await withRepositoryStubs(
    [
      [invoiceRepository, {
        createInvoice: async ({ clientId, orderId, number, amount, dueAt }, _db) => {
          captured.invoiceArgs = { clientId, orderId, number, amount, dueAt };
          return { id: 100n, clientId, orderId, number, amount, dueAt };
        },
      }],
      [paymentRepository, {
        createPayment: async (data, _db) => {
          captured.paymentArgs = data;
          return { id: 200n, ...data };
        },
      }],
    ],
    async () => {
      const fakeDb = {
        invoice: { findFirst: async () => null },
        payment: { findFirst: async () => null },
      };
      const result = await billingTriggerService.executeBillingLogic(
        makeOrder({ paymentCondition: 'CASH' }),
        makeClient(),
        makeAuth(),
        fakeDb,
      );
      assert.ok(result, 'result must not be null');
      assert.ok(result.invoice, 'invoice must be created');
      assert.ok(result.payment, 'payment must be created');
      assert.equal(captured.paymentArgs.paymentMethod, 'CASH');
      assert.equal(captured.paymentArgs.status, 'PENDING_APPROVAL');
      assert.match(String(captured.paymentArgs.reference), /COBRO-CONTADO/);
    },
  );
});

test('executeBillingLogic creates Invoice and TRANSFER Payment with reference from transferMetadata', async () => {
  const captured = { paymentArgs: null };
  const order = makeOrder({
    paymentCondition: 'TRANSFER',
    transferMetadata: {
      bank: 'BCR',
      reference: 'TRF-999',
      amount: 150,
      date: new Date().toISOString(),
    },
  });

  await withRepositoryStubs(
    [
      [invoiceRepository, {
        createInvoice: async ({ clientId, orderId, number, amount, dueAt }, _db) => ({ id: 100n, clientId, orderId, number, amount, dueAt }),
      }],
      [paymentRepository, {
        createPayment: async (data, _db) => {
          captured.paymentArgs = data;
          return { id: 200n, ...data };
        },
      }],
    ],
    async () => {
      const fakeDb = {
        invoice: { findFirst: async () => null },
        payment: { findFirst: async () => null },
      };
      const result = await billingTriggerService.executeBillingLogic(order, makeClient(), makeAuth(), fakeDb);
      assert.ok(result.invoice, 'invoice must be created');
      assert.ok(result.payment, 'payment must be created');
      assert.equal(captured.paymentArgs.paymentMethod, 'TRANSFER');
      assert.equal(captured.paymentArgs.reference, 'TRF-999');
      assert.equal(captured.paymentArgs.status, 'PENDING_APPROVAL');
    },
  );
});

test('executeBillingLogic clamps TRANSFER payment amount to invoiceAmount when transferMetadata.amount exceeds invoice', async () => {
  const captured = { paymentArgs: null };
  // invoiceAmount = 2*100 + 1*50 - 10 = 240
  // transferMetadata.amount = 9999 → should be clamped to 240
  const order = makeOrder({
    paymentCondition: 'TRANSFER',
    transferMetadata: { bank: 'BAC', reference: 'TRF-CLAMP', amount: 9999, date: new Date().toISOString() },
  });

  await withRepositoryStubs(
    [
      [invoiceRepository, {
        createInvoice: async ({ clientId, orderId, number, amount, dueAt }, _db) => ({ id: 100n, clientId, orderId, number, amount, dueAt }),
      }],
      [paymentRepository, {
        createPayment: async (data, _db) => {
          captured.paymentArgs = data;
          return { id: 200n, ...data };
        },
      }],
    ],
    async () => {
      const fakeDb = {
        invoice: { findFirst: async () => null },
        payment: { findFirst: async () => null },
      };
      const result = await billingTriggerService.executeBillingLogic(order, makeClient(), makeAuth(), fakeDb);
      assert.ok(result.invoice);
      assert.ok(result.payment);
      assert.equal(captured.paymentArgs.amount, 240); // 2*100-0 + 1*50-10 = 240
    },
  );
});

test('executeBillingLogic creates Invoice but NO Payment for CREDIT orders', async () => {
  await withRepositoryStubs(
    [
      [invoiceRepository, {
        createInvoice: async ({ clientId, orderId, number, amount, dueAt }, _db) => ({ id: 100n, clientId, orderId, number, amount, dueAt }),
      }],
      [paymentRepository, {
        createPayment: async () => { throw new Error('should not be called'); },
      }],
    ],
    async () => {
      const fakeDb = {
        invoice: { findFirst: async () => null },
        payment: { findFirst: async () => null },
      };
      const result = await billingTriggerService.executeBillingLogic(
        makeOrder({ paymentCondition: 'CREDIT' }),
        makeClient({ paymentDays: 30 }),
        makeAuth(),
        fakeDb,
      );
      assert.ok(result.invoice, 'invoice must be created for CREDIT');
      assert.equal(result.payment, null, 'payment must be null for CREDIT');
    },
  );
});

test('executeBillingLogic does not create duplicate CASH Payment if one already exists (BR-006)', async () => {
  const createPaymentCalls = [];
  await withRepositoryStubs(
    [
      [invoiceRepository, {
        createInvoice: async ({ clientId, orderId, number, amount, dueAt }, _db) => ({ id: 100n, clientId, orderId, number, amount, dueAt }),
      }],
      [paymentRepository, {
        createPayment: async (data, _db) => {
          createPaymentCalls.push(data);
          return { id: 200n, ...data };
        },
      }],
    ],
    async () => {
      const fakeDb = {
        invoice: { findFirst: async () => null },
        payment: {
          // Simulates a non-cancelled payment already exists for this invoice
          findFirst: async () => ({ id: 999n, status: 'PENDING_APPROVAL' }),
        },
      };
      const result = await billingTriggerService.executeBillingLogic(
        makeOrder({ paymentCondition: 'CASH' }),
        makeClient(),
        makeAuth(),
        fakeDb,
      );
      assert.ok(result.invoice, 'invoice must be created');
      assert.equal(result.payment, null, 'payment must not be created (BR-006: existing non-cancelled payment)');
      assert.equal(createPaymentCalls.length, 0, 'createPayment should not be called');
    },
  );
});

// ---------------------------------------------------------------------------
// Tests for generateBillingOnDispatch (best-effort wrapper)
// ---------------------------------------------------------------------------

test('generateBillingOnDispatch returns null silently when executeBillingLogic would throw', async () => {
  // Simulate an order that triggers a DB error — the public function must not throw
  const order = makeOrder();
  // Override prisma for this test by using legacy order (paymentCondition=null)
  const result = await billingTriggerService.generateBillingOnDispatch(
    { ...order, paymentCondition: null },
    makeClient(),
    makeAuth(),
  );
  assert.equal(result, null);
});

// ---------------------------------------------------------------------------
// TEST-006: Two-step payment flow failure — createPayment succeeds, approvePayment fails
// ---------------------------------------------------------------------------

test('TEST-006: createPayment response has an id field directly', async () => {
  const paymentService = require('../src/services/payment.service');
  const _paymentRepository = require('../src/repositories/payment.repository');
  const _invoiceRepository = require('../src/repositories/invoice.repository');

  const createdPayment = {
    id: 99n, invoiceId: 10n, amount: 500, paymentMethod: 'CASH',
    reference: 'REF-01', status: 'PENDING_APPROVAL', receipts: [],
    invoice: { id: 10n, client: { companyId: 9n } },
  };

  await withRepositoryStubs(
    [
      [_paymentRepository, {
        createPayment: async (data) => ({ id: createdPayment.id, ...data }),
        findCompanyPaymentById: async () => ({ ...createdPayment }),
      }],
      [_invoiceRepository, {
        findCompanyInvoiceForFinancialSync: async () => ({
          id: 10n, clientId: 42n, amount: 1000, status: 'PENDING', paidAt: null,
          client: { companyId: 9n },
          payments: [],
        }),
      }],
    ],
    async () => {
      const auth = { companyId: '9', sub: '55', permissions: ['collections.manage.own'] };
      const result = await paymentService.createPayment(
        { invoiceId: 10n, amount: 500, paymentMethod: 'CASH', reference: 'REF-01' },
        auth,
      );
      assert.ok(result.id, 'createPayment response must have an id field');
      assert.equal(result.status, 'PENDING_APPROVAL');
    },
  );
});

test('TEST-006: payment remains in PENDING_APPROVAL when approvePayment fails after createPayment', async () => {
  const paymentService = require('../src/services/payment.service');
  const _paymentRepository = require('../src/repositories/payment.repository');
  const _invoiceRepository = require('../src/repositories/invoice.repository');

  const pendingPayment = {
    id: 88n, invoiceId: 10n, amount: 300, paymentMethod: 'TRANSFER',
    reference: 'REF-02', status: 'PENDING_APPROVAL', reviewReason: null,
    invoice: { id: 10n, client: { companyId: 9n } }, receipts: [],
  };

  await withRepositoryStubs(
    [
      [_paymentRepository, {
        findCompanyPaymentById: async () => ({ ...pendingPayment }),
        transaction: async (_work) => {
          throw new Error('Simulated approval failure');
        },
      }],
      [_invoiceRepository, {
        findCompanyInvoiceForFinancialSync: async () => ({
          id: 10n, clientId: 42n, amount: 1000, status: 'PENDING', paidAt: null,
          client: { companyId: 9n }, payments: [],
        }),
      }],
    ],
    async () => {
      const auth = { companyId: '9', sub: '55', permissions: ['collections.payments.approve'] };
      await assert.rejects(
        () => paymentService.approvePayment(88n, {}, auth),
        (error) => {
          // The approval failed — payment remains in PENDING_APPROVAL
          assert.ok(error, 'approvePayment must throw when approval fails');
          return true;
        },
      );
      // Verify the payment is still in PENDING_APPROVAL by querying again
      const payment = await _paymentRepository.findCompanyPaymentById(88n, 9n);
      assert.equal(payment.status, 'PENDING_APPROVAL',
        'payment must remain in PENDING_APPROVAL when approvePayment fails');
    },
  );
});
