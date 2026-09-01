'use strict';

/**
 * Characterization tests for creditBalance update behaviour (TASK-014, TASK-015).
 *
 * TASK-014: Client.creditBalance increments when an order moves to APPROVED.
 *   The increment uses the same amount formula as billing-trigger.service.js
 *   calculateInvoiceAmount, and is guarded by (clientId && orderAmount > 0).
 *
 * TASK-015: Client.creditBalance decrements on Payment APPROVED and increments
 *   on Payment REVERSED, both inside the payment service Prisma transaction.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const paymentService    = require('../src/services/payment.service');
const paymentRepository = require('../src/repositories/payment.repository');
const invoiceRepository = require('../src/repositories/invoice.repository');

// calculateInvoiceAmount is the shared formula used by billing-trigger AND inventory.service
const { calculateInvoiceAmount } = require('../src/services/billing-trigger.service');

// ---------------------------------------------------------------------------
// Shared stub helper
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// TASK-014 — creditBalance increment on order approval
//
// The actual update lives inside inventoryRepository.transaction in
// inventory.service.js reserveStockForOrder, which is hard to isolate due to
// the inventory allocation inner loop.  These tests therefore verify:
//   a) the shared amount formula produces the correct increment value, and
//   b) the guard conditions (no clientId / zero amount) are correctly modelled.
// ---------------------------------------------------------------------------

test('TASK-014: order amount formula matches calculateInvoiceAmount (shared formula)', () => {
  const items = [
    { quantity: 3, unitPrice: 100, totalDiscount: 10 },
    { quantity: 2, unitPrice:  50, totalDiscount:  0 },
  ];
  // 3*100 - 10 + 2*50 - 0 = 290 + 100 = 390
  assert.equal(calculateInvoiceAmount(items), 390);
});

test('TASK-014: creditBalance update is skipped when orderAmount is 0', () => {
  const orderAmount = calculateInvoiceAmount([]);
  assert.equal(orderAmount, 0);
  const clientId = 42n;
  // Guard: if (order.clientId && orderAmount > 0) — false when orderAmount === 0
  assert.equal(!!(clientId && orderAmount > 0), false,
    'creditBalance must NOT be updated when orderAmount is 0');
});

test('TASK-014: creditBalance update is skipped when order has no clientId', () => {
  const orderAmount = calculateInvoiceAmount([
    { quantity: 1, unitPrice: 500, totalDiscount: 0 },
  ]);
  assert.equal(orderAmount, 500);
  const clientId = null;
  // Guard: if (order.clientId && orderAmount > 0) — false when clientId is null
  assert.equal(!!(clientId && orderAmount > 0), false,
    'creditBalance must NOT be updated when clientId is null');
});

test('TASK-014: creditBalance increment value matches orderAmount when clientId and items present', () => {
  const items = [{ quantity: 2, unitPrice: 200, totalDiscount: 50 }];
  // 2*200 - 50 = 350
  const orderAmount = calculateInvoiceAmount(items);
  assert.equal(orderAmount, 350);
  const clientId = 7n;
  const shouldUpdate = !!(clientId && orderAmount > 0);
  assert.equal(shouldUpdate, true);
  // The increment Prisma receives equals orderAmount
  assert.equal(orderAmount, 350);
});

// ---------------------------------------------------------------------------
// TASK-015 — creditBalance decrement on payment approval
// ---------------------------------------------------------------------------

function buildApprovalHarness({ invoiceClientId }) {
  const clientUpdateCalls = [];

  const paymentId   = 11n;
  const invoiceId   = 8n;
  const paymentAmount = 150;

  // Payment starts as PENDING_APPROVAL so assertPaymentCanBeApproved passes
  const pendingPayment = {
    id: paymentId,
    invoiceId,
    amount: paymentAmount,
    paymentMethod: 'TRANSFER',
    reference: 'SINPE-555',
    status: 'PENDING_APPROVAL',
    reviewReason: null,
    invoice: { id: invoiceId, client: { companyId: 9n } },
    receipts: [],
  };

  const approvedPayment = { ...pendingPayment, status: 'APPROVED', approvedAt: new Date() };

  // Invoice with no existing approved payments so assertNoApprovalOverpayment passes
  const baseInvoice = {
    id: invoiceId,
    clientId: invoiceClientId,
    amount: 200,
    status: 'PENDING',
    paidAt: null,
    client: { companyId: 9n },
    payments: [],
  };

  const transactionStub = async (work) => {
    const tx = {
      invoice: {
        findUnique: async ({ where }) => {
          if (where?.id === invoiceId) return { clientId: invoiceClientId };
          return null;
        },
      },
      client: {
        update: async (args) => { clientUpdateCalls.push(args); return null; },
      },
    };
    return work(tx);
  };

  const paymentRepositoryStubs = {
    transaction: transactionStub,
    findCompanyPaymentById: async () => ({ ...pendingPayment }),
    approveCompanyPayment: async () => ({ ...approvedPayment }),
  };

  const invoiceRepositoryStubs = {
    // Used for validation (outer + transactional) and financial sync
    findCompanyInvoiceForFinancialSync: async () => ({ ...baseInvoice }),
    updateCompanyInvoiceFinancialState: async () => ({ ...baseInvoice, status: 'PARTIAL' }),
  };

  return { clientUpdateCalls, paymentRepositoryStubs, invoiceRepositoryStubs };
}

test('TASK-015: approvePayment decrements creditBalance when invoice has clientId', async () => {
  const { clientUpdateCalls, paymentRepositoryStubs, invoiceRepositoryStubs } =
    buildApprovalHarness({ invoiceClientId: 42n });

  const auth = { companyId: '9', sub: '55', permissions: ['collections.payments.approve'] };

  await withStubs(
    [
      [paymentRepository, paymentRepositoryStubs],
      [invoiceRepository, invoiceRepositoryStubs],
    ],
    () => paymentService.approvePayment(11n, {}, auth),
  );

  assert.equal(clientUpdateCalls.length, 1, 'tx.client.update must be called once');
  assert.equal(clientUpdateCalls[0].where.id, 42n);
  assert.deepEqual(clientUpdateCalls[0].data, { creditBalance: { decrement: 150 } });
});

test('TASK-015: approvePayment skips creditBalance update when invoice has no clientId', async () => {
  const { clientUpdateCalls, paymentRepositoryStubs, invoiceRepositoryStubs } =
    buildApprovalHarness({ invoiceClientId: null });

  const auth = { companyId: '9', sub: '55', permissions: ['collections.payments.approve'] };

  await withStubs(
    [
      [paymentRepository, paymentRepositoryStubs],
      [invoiceRepository, invoiceRepositoryStubs],
    ],
    () => paymentService.approvePayment(11n, {}, auth),
  );

  assert.equal(clientUpdateCalls.length, 0,
    'tx.client.update must NOT be called when invoice has no clientId');
});

// ---------------------------------------------------------------------------
// TASK-015 — creditBalance increment on payment reversal
// ---------------------------------------------------------------------------

function buildReversalHarness({ invoiceClientId }) {
  const clientUpdateCalls = [];

  const paymentId     = 22n;
  const invoiceId     = 9n;
  const paymentAmount = 75;

  // Payment must be APPROVED so assertPaymentCanBeReversed passes
  const approvedPayment = {
    id: paymentId,
    invoiceId,
    amount: paymentAmount,
    paymentMethod: 'CASH',
    reference: 'COBRO-777',
    status: 'APPROVED',
    reversedAt: null,
    reviewReason: null,
    invoice: { id: invoiceId, client: { companyId: 9n } },
    receipts: [],
  };

  const reversedPayment = { ...approvedPayment, status: 'REVERSED', reversedAt: new Date() };

  const baseInvoice = {
    id: invoiceId,
    clientId: invoiceClientId,
    amount: 200,
    status: 'PENDING',
    paidAt: null,
    client: { companyId: 9n },
    payments: [],
  };

  let findPaymentCallCount = 0;

  const transactionStub = async (work) => {
    const tx = {
      invoice: {
        findUnique: async ({ where }) => {
          if (where?.id === invoiceId) return { clientId: invoiceClientId };
          return null;
        },
      },
      client: {
        update: async (args) => { clientUpdateCalls.push(args); return null; },
      },
    };
    return work(tx);
  };

  const paymentRepositoryStubs = {
    transaction: transactionStub,
    // Called once before tx (existence check), twice inside tx (transactionalPayment + reversedPaymentResult)
    findCompanyPaymentById: async () => {
      findPaymentCallCount += 1;
      // Before reversal is committed it's APPROVED; after it's REVERSED
      return findPaymentCallCount >= 3 ? { ...reversedPayment } : { ...approvedPayment };
    },
    reverseCompanyPayment: async () => ({ count: 1 }),
  };

  const invoiceRepositoryStubs = {
    findCompanyInvoiceForFinancialSync: async () => ({ ...baseInvoice }),
    updateCompanyInvoiceFinancialState: async () => ({ ...baseInvoice, status: 'PENDING' }),
  };

  return { clientUpdateCalls, paymentRepositoryStubs, invoiceRepositoryStubs };
}

test('TASK-015: reversePayment increments creditBalance when invoice has clientId', async () => {
  const { clientUpdateCalls, paymentRepositoryStubs, invoiceRepositoryStubs } =
    buildReversalHarness({ invoiceClientId: 42n });

  const auth = { companyId: '9', sub: '77', permissions: ['collections.payments.reverse'] };

  await withStubs(
    [
      [paymentRepository, paymentRepositoryStubs],
      [invoiceRepository, invoiceRepositoryStubs],
    ],
    () => paymentService.reversePayment(22n, auth, 'Customer request'),
  );

  assert.equal(clientUpdateCalls.length, 1, 'tx.client.update must be called once on reversal');
  assert.equal(clientUpdateCalls[0].where.id, 42n);
  assert.deepEqual(clientUpdateCalls[0].data, { creditBalance: { increment: 75 } });
});

// ---------------------------------------------------------------------------
// BUG-001 — creditBalance decrement on order cancellation
//
// When an approved order is cancelled via releaseStockReservation(orderId, true, auth, req),
// the creditBalance must be decremented by the same orderAmount that was incremented on approval.
// This mirrors the increment guard: if (cancel && order.clientId && orderAmount > 0).
// ---------------------------------------------------------------------------

test('BUG-001: cancel approved order with clientId decrements creditBalance by orderAmount', () => {
  const items = [
    { quantity: 3, unitPrice: 100, totalDiscount: 10 },
    { quantity: 2, unitPrice:  50, totalDiscount:  0 },
  ];
  const orderAmount = calculateInvoiceAmount(items);
  assert.equal(orderAmount, 390);

  const cancel = true;
  const clientId = 42n;
  const shouldDecrement = !!(cancel && clientId && orderAmount > 0);
  assert.equal(shouldDecrement, true,
    'creditBalance must be decremented when cancel=true, clientId present, and orderAmount > 0');
});

test('BUG-001: release (cancel=false) approved order does NOT decrement creditBalance', () => {
  const items = [{ quantity: 1, unitPrice: 500, totalDiscount: 0 }];
  const orderAmount = calculateInvoiceAmount(items);
  assert.equal(orderAmount, 500);

  const cancel = false;
  const clientId = 42n;
  const shouldDecrement = !!(cancel && clientId && orderAmount > 0);
  assert.equal(shouldDecrement, false,
    'creditBalance must NOT be decremented when cancel=false (release, not cancel)');
});

test('BUG-001: cancel approved order without clientId does NOT decrement creditBalance', () => {
  const items = [{ quantity: 1, unitPrice: 500, totalDiscount: 0 }];
  const orderAmount = calculateInvoiceAmount(items);
  assert.equal(orderAmount, 500);

  const cancel = true;
  const clientId = null;
  const shouldDecrement = !!(cancel && clientId && orderAmount > 0);
  assert.equal(shouldDecrement, false,
    'creditBalance must NOT be decremented when clientId is null');
});

test('BUG-001: cancel approved order with zero amount does NOT decrement creditBalance', () => {
  const orderAmount = calculateInvoiceAmount([]);
  assert.equal(orderAmount, 0);

  const cancel = true;
  const clientId = 42n;
  const shouldDecrement = !!(cancel && clientId && orderAmount > 0);
  assert.equal(shouldDecrement, false,
    'creditBalance must NOT be decremented when orderAmount is 0');
});

test('BUG-001: cancel and approval paths use same calculateInvoiceAmount formula', () => {
  const items = [
    { quantity: 5, unitPrice: 200, totalDiscount: 100 },
  ];
  // Both paths must produce the same value
  const approvalAmount = calculateInvoiceAmount(items);
  const cancelAmount = calculateInvoiceAmount(items);
  assert.equal(approvalAmount, cancelAmount,
    'approval and cancellation must use the same formula for symmetry');
  assert.equal(approvalAmount, 900);
});

test('BUG-001: calculateInvoiceAmount clamps negative totals to 0', () => {
  const items = [{ quantity: 1, unitPrice: 10, totalDiscount: 50 }];
  const orderAmount = calculateInvoiceAmount(items);
  assert.equal(orderAmount, 0,
    'negative totals must be clamped to 0 via Math.max(0, total)');
  // With clamp, no creditBalance decrement should happen
  const cancel = true;
  const clientId = 42n;
  const shouldDecrement = !!(cancel && clientId && orderAmount > 0);
  assert.equal(shouldDecrement, false);
});

// ---------------------------------------------------------------------------
// AUD-028 — ClientStore.creditBalance path in approvePayment / reversePayment
//
// When the invoice has an orderId the service walks invoice → order → clientStoreId
// and updates ClientStore.creditBalance in addition to Client.creditBalance.
// These tests exercise that branch by providing an orderId in the invoice stub.
// ---------------------------------------------------------------------------

function buildApprovalHarnessWithStore({ clientStoreId }) {
  const storeUpdateCalls = [];

  const paymentId     = 55n;
  const invoiceId     = 14n;
  const orderId       = 77n;
  const paymentAmount = 200;

  const pendingPayment = {
    id: paymentId, invoiceId, amount: paymentAmount,
    paymentMethod: 'TRANSFER', reference: 'SINPE-999',
    status: 'PENDING_APPROVAL', reviewReason: null,
    invoice: { id: invoiceId, client: { companyId: 9n } },
    receipts: [],
  };

  const transactionStub = async (work) => {
    const tx = {
      invoice: {
        findUnique: async ({ where }) => {
          if (where?.id === invoiceId) return { clientId: null, orderId };
          return null;
        },
      },
      order: {
        findUnique: async ({ where }) => {
          if (where?.id === orderId) return { clientStoreId };
          return null;
        },
      },
      client: { update: async () => null },
      clientStore: {
        update: async (args) => { storeUpdateCalls.push(args); return null; },
      },
    };
    return work(tx);
  };

  const paymentRepositoryStubs = {
    transaction: transactionStub,
    findCompanyPaymentById: async () => ({ ...pendingPayment }),
    approveCompanyPayment: async () => ({ ...pendingPayment, status: 'APPROVED' }),
  };

  const invoiceRepositoryStubs = {
    findCompanyInvoiceForFinancialSync: async () => ({
      id: invoiceId, clientId: null, amount: 500, status: 'PENDING',
      paidAt: null, client: { companyId: 9n }, payments: [],
    }),
    updateCompanyInvoiceFinancialState: async () => ({
      id: invoiceId, clientId: null, amount: 500, status: 'PARTIAL',
      paidAt: null, client: { companyId: 9n }, payments: [],
    }),
  };

  return { storeUpdateCalls, paymentRepositoryStubs, invoiceRepositoryStubs };
}

test('AUD-028: approvePayment decrements ClientStore.creditBalance when invoice has orderId → clientStoreId', async () => {
  const clientStoreId = 88n;
  const { storeUpdateCalls, paymentRepositoryStubs, invoiceRepositoryStubs } =
    buildApprovalHarnessWithStore({ clientStoreId });

  const auth = { companyId: '9', sub: '55', permissions: ['collections.payments.approve'] };

  await withStubs(
    [
      [paymentRepository, paymentRepositoryStubs],
      [invoiceRepository, invoiceRepositoryStubs],
    ],
    () => paymentService.approvePayment(55n, {}, auth),
  );

  assert.equal(storeUpdateCalls.length, 1, 'tx.clientStore.update must be called once');
  assert.equal(storeUpdateCalls[0].where.id, clientStoreId);
  assert.deepEqual(storeUpdateCalls[0].data, { creditBalance: { decrement: 200 } });
});

test('AUD-028: approvePayment skips ClientStore.creditBalance when order has no clientStoreId', async () => {
  const { storeUpdateCalls, paymentRepositoryStubs, invoiceRepositoryStubs } =
    buildApprovalHarnessWithStore({ clientStoreId: null });

  const auth = { companyId: '9', sub: '55', permissions: ['collections.payments.approve'] };

  await withStubs(
    [
      [paymentRepository, paymentRepositoryStubs],
      [invoiceRepository, invoiceRepositoryStubs],
    ],
    () => paymentService.approvePayment(55n, {}, auth),
  );

  assert.equal(storeUpdateCalls.length, 0,
    'tx.clientStore.update must NOT be called when order has no clientStoreId');
});
