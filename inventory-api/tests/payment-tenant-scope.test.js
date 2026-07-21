const test = require('node:test');
const assert = require('node:assert/strict');

const paymentRepository = require('../src/repositories/payment.repository');
const invoiceRepository = require('../src/repositories/invoice.repository');
const paymentService = require('../src/services/payment.service');

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

function createPassThroughTransactionStub() {
  return async (work) => work({ kind: 'tx' });
}

test('listPayments rejects authenticated users without company scope', async () => {
  await assert.rejects(
    () => paymentService.listPayments({ companyId: null, permissions: ['collections.manage.own'] }),
    (error) => {
      assert.equal(error.statusCode, 403);
      assert.equal(error.code, 'forbidden');
      return true;
    },
  );
});

test('listPayments queries only payments within the authenticated company', async () => {
  let receivedArguments = null;

  const payments = await withRepositoryStubs(
    [[paymentRepository, {
      findCompanyPayments: async (companyId, _pagination, options) => {
        receivedArguments = { companyId, options };
        return [{ id: 1n, amount: 150, receipts: [] }];
      },
    }]],
    () => paymentService.listPayments({ companyId: '22', permissions: ['sales.manage'] }),
  );

  assert.deepEqual(receivedArguments, { companyId: 22n, options: {} });
  assert.deepEqual(payments, [{ id: 1n, amount: 150, receipts: [] }]);
});

test('listPayments scopes own-collection users to submittedByUserId', async () => {
  let receivedArguments = null;

  await withRepositoryStubs(
    [[paymentRepository, {
      findCompanyPayments: async (companyId, _pagination, options) => {
        receivedArguments = { companyId, options };
        return [];
      },
    }]],
    () => paymentService.listPayments({ companyId: '22', sub: '90', permissions: ['collections.manage.own'] }),
  );

  assert.deepEqual(receivedArguments, {
    companyId: 22n,
    options: { submittedByUserId: 90n },
  });
});

test('getPayment returns not found when payment belongs to another tenant', async () => {
  await withRepositoryStubs(
    [[paymentRepository, {
      findCompanyPaymentById: async () => null,
    }]],
    async () => {
      await assert.rejects(
        () => paymentService.getPayment(9n, { companyId: '44', permissions: ['sales.manage'] }),
        (error) => {
          assert.equal(error.statusCode, 404);
          assert.equal(error.code, 'not_found');
          return true;
        },
      );
    },
  );
});

test('getPayment scopes detail lookup using the authenticated company and own-submitter scope when needed', async () => {
  let receivedLookup = null;

  const payment = await withRepositoryStubs(
    [[paymentRepository, {
      findCompanyPaymentById: async (paymentId, companyId, options) => {
        receivedLookup = { paymentId, companyId, options };
        return { id: paymentId, amount: 90, receipts: [] };
      },
    }]],
    () => paymentService.getPayment(7n, { companyId: '80', sub: '11', permissions: ['collections.manage.own'] }),
  );

  assert.deepEqual(receivedLookup, {
    paymentId: 7n,
    companyId: 80n,
    options: { submittedByUserId: 11n },
  });
  assert.deepEqual(payment, { id: 7n, amount: 90, receipts: [] });
});

test('createPayment rejects an invoice from another tenant', async () => {
  await withRepositoryStubs(
    [[invoiceRepository, {
      findCompanyInvoiceForFinancialSync: async () => null,
    }]],
    async () => {
      await assert.rejects(
        () => paymentService.createPayment(
          { invoiceId: 8n, amount: 50, paymentMethod: 'CASH', reference: 'RC-1' },
          { companyId: '4', permissions: ['collections.manage.own'] },
        ),
        (error) => {
          assert.equal(error.statusCode, 400);
          assert.equal(error.code, 'validation_error');
          return true;
        },
      );
    },
  );
});

test('updatePayment validates invoice reference and scopes write to the authenticated company', async () => {
  let receivedUpdate = null;

  const updatedPayment = await withRepositoryStubs(
    [
      [paymentRepository, {
        findCompanyPaymentById: async () => ({
          id: 6n,
          invoiceId: 2n,
          amount: 10,
          status: 'PENDING_APPROVAL',
          reference: 'REF-1',
          invoice: { id: 2n, client: { companyId: 14n } },
          receipts: [],
        }),
        updateCompanyPayment: async (paymentId, companyId, payload) => {
          receivedUpdate = { paymentId, companyId, payload };
          return {
            id: paymentId,
            status: 'PENDING_APPROVAL',
            invoice: { id: 3n, client: { companyId } },
            receipts: [],
            ...payload,
          };
        },
      }],
      [invoiceRepository, {
        findCompanyInvoiceForFinancialSync: async (invoiceId, companyId) => ({ id: invoiceId, client: { companyId }, status: 'PENDING', payments: [] }),
      }],
    ],
    () => paymentService.updatePayment(
      6n,
      { invoiceId: 3n, amount: 15, reference: 'REF-2' },
      { companyId: '14', sub: '88', permissions: ['collections.manage.own'] },
    ),
  );

  assert.deepEqual(receivedUpdate, {
    paymentId: 6n,
    companyId: 14n,
    payload: { invoiceId: 3n, amount: 15, reference: 'REF-2' },
  });
  assert.equal(updatedPayment.invoiceId, 3n);
  assert.equal(updatedPayment.amount, 15);
});

test('removePayment rejects deleting a payment outside the authenticated tenant', async () => {
  let reverseCalled = false;

  await withRepositoryStubs(
    [[paymentRepository, {
      findCompanyPaymentById: async () => null,
      reverseCompanyPayment: async () => {
        reverseCalled = true;
      },
    }]],
    async () => {
      await assert.rejects(
        () => paymentService.removePayment(99n, { companyId: '19', sub: '200', permissions: ['collections.payments.reverse'] }),
        (error) => {
          assert.equal(error.statusCode, 404);
          assert.equal(error.code, 'not_found');
          return true;
        },
      );
    },
  );

  assert.equal(reverseCalled, false);
});

test('removePayment converts DELETE compatibility flow into payment reversal', async () => {
  let receivedReverseCall = null;

  const result = await withRepositoryStubs(
    [
      [paymentRepository, {
        transaction: createPassThroughTransactionStub(),
        findCompanyPaymentById: async (paymentId) => ({
          id: paymentId,
          invoiceId: 7n,
          amount: 90,
          status: 'APPROVED',
          invoice: { id: 7n, client: { companyId: 19n } },
          receipts: [],
        }),
        reverseCompanyPayment: async (paymentId, companyId, payload) => {
          receivedReverseCall = { paymentId, companyId, payload };
          return { count: 1 };
        },
      }],
      [invoiceRepository, {
        findCompanyInvoiceForFinancialSync: async () => ({
          id: 7n,
          amount: 90,
          status: 'PAID',
          paidAt: new Date('2026-07-20T10:00:00Z'),
          client: { companyId: 19n },
          payments: [],
        }),
        updateCompanyInvoiceFinancialState: async () => ({ id: 7n, status: 'PENDING', paidAt: null }),
      }],
    ],
    () => paymentService.removePayment(13n, { companyId: '19', sub: '200', permissions: ['collections.payments.reverse'] }),
  );

  assert.equal(receivedReverseCall.paymentId, 13n);
  assert.equal(receivedReverseCall.companyId, 19n);
  assert.equal(receivedReverseCall.payload.reversedByUserId, 200n);
  assert.equal(receivedReverseCall.payload.reversalReason, 'DELETE_COMPATIBILITY_FLOW');
  assert.ok(receivedReverseCall.payload.reversedAt instanceof Date);
  assert.deepEqual(result, { count: 1 });
});

test('removePayment rejects repeated reversal attempts with controlled conflict', async () => {
  await withRepositoryStubs(
    [[paymentRepository, {
      findCompanyPaymentById: async () => ({ id: 13n, invoiceId: 7n, amount: 90, status: 'REVERSED', invoice: { id: 7n, client: { companyId: 19n } }, receipts: [] }),
    }]],
    async () => {
      await assert.rejects(
        () => paymentService.removePayment(13n, { companyId: '19', sub: '200', permissions: ['collections.payments.reverse'] }),
        (error) => {
          assert.equal(error.statusCode, 409);
          assert.equal(error.code, 'conflict');
          return true;
        },
      );
    },
  );
});
