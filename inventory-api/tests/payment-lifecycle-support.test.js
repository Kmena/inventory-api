const test = require('node:test');
const assert = require('node:assert/strict');

const paymentRepository = require('../src/repositories/payment.repository');
const invoiceRepository = require('../src/repositories/invoice.repository');
const paymentLifecycleSupport = require('../src/services/payment-lifecycle-support.service');

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

test('assertPaymentEditable accepts only editable lifecycle statuses', () => {
  assert.doesNotThrow(() => paymentLifecycleSupport.assertPaymentEditable({ status: 'PENDING_APPROVAL' }));
  assert.doesNotThrow(() => paymentLifecycleSupport.assertPaymentEditable({ status: 'UNDER_REVIEW' }));
  assert.throws(
    () => paymentLifecycleSupport.assertPaymentEditable({ status: 'APPROVED' }),
    (error) => error?.statusCode === 409 && error?.code === 'conflict',
  );
});

test('assertNoApprovalOverpayment preserves exact decimal completion and rejects overflow', () => {
  assert.doesNotThrow(() => paymentLifecycleSupport.assertNoApprovalOverpayment({
    amount: 100,
    payments: [{ amount: 60.1, status: 'APPROVED' }],
  }, {
    amount: 39.9,
  }));

  assert.throws(
    () => paymentLifecycleSupport.assertNoApprovalOverpayment({
      amount: 100,
      payments: [{ amount: 60.1, status: 'APPROVED' }],
    }, {
      amount: 40,
    }),
    (error) => error?.statusCode === 409 && error?.code === 'conflict',
  );
});

test('synchronizeInvoiceFinancialState derives and persists the invoice financial state', async () => {
  let receivedUpdate = null;

  await withStubs(
    [[invoiceRepository, {
      findCompanyInvoiceForFinancialSync: async () => ({
        id: 8n,
        amount: 100,
        status: 'PENDING',
        paidAt: null,
        payments: [
          { amount: 100, status: 'APPROVED', approvedAt: new Date('2026-07-20T10:00:00Z') },
        ],
      }),
      updateCompanyInvoiceFinancialState: async (invoiceId, companyId, payload) => {
        receivedUpdate = { invoiceId, companyId, payload };
        return { id: invoiceId, ...payload };
      },
    }]],
    async () => {
      const result = await paymentLifecycleSupport.synchronizeInvoiceFinancialState(8n, 9n);
      assert.equal(result.status, 'PAID');
    },
  );

  assert.deepEqual(receivedUpdate, {
    invoiceId: 8n,
    companyId: 9n,
    payload: {
      appliedAmount: 100,
      pendingAmount: 0,
      status: 'PAID',
      paidAt: new Date('2026-07-20T10:00:00.000Z'),
    },
  });
});

test('executePaymentFinancialSyncTransaction delegates to the payment repository transaction boundary', async () => {
  const seen = [];

  await withStubs(
    [[paymentRepository, {
      transaction: async (work) => {
        seen.push('transaction');
        return work({ kind: 'tx' });
      },
    }]],
    async () => {
      const result = await paymentLifecycleSupport.executePaymentFinancialSyncTransaction(async (tx) => {
        seen.push(tx.kind);
        return 'ok';
      });
      assert.equal(result, 'ok');
    },
  );

  assert.deepEqual(seen, ['transaction', 'tx']);
});
