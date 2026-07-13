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

test('listPayments rejects authenticated users without company scope', async () => {
  await assert.rejects(
    () => paymentService.listPayments({ companyId: null }),
    (error) => {
      assert.equal(error.statusCode, 403);
      assert.equal(error.code, 'forbidden');
      return true;
    },
  );
});

test('listPayments queries only payments within the authenticated company', async () => {
  let receivedCompanyId = null;

  const payments = await withRepositoryStubs(
    [[paymentRepository, {
      findCompanyPayments: async (companyId) => {
        receivedCompanyId = companyId;
        return [{ id: 1n, amount: 150 }];
      },
    }]],
    () => paymentService.listPayments({ companyId: '22' }),
  );

  assert.equal(receivedCompanyId, 22n);
  assert.deepEqual(payments, [{ id: 1n, amount: 150 }]);
});

test('getPayment returns not found when payment belongs to another tenant', async () => {
  await withRepositoryStubs(
    [[paymentRepository, {
      findCompanyPaymentById: async () => null,
    }]],
    async () => {
      await assert.rejects(
        () => paymentService.getPayment(9n, { companyId: '44' }),
        (error) => {
          assert.equal(error.statusCode, 404);
          assert.equal(error.code, 'not_found');
          return true;
        },
      );
    },
  );
});

test('getPayment scopes detail lookup using the authenticated company', async () => {
  let receivedLookup = null;

  const payment = await withRepositoryStubs(
    [[paymentRepository, {
      findCompanyPaymentById: async (paymentId, companyId) => {
        receivedLookup = { paymentId, companyId };
        return { id: paymentId, amount: 90 };
      },
    }]],
    () => paymentService.getPayment(7n, { companyId: '80' }),
  );

  assert.deepEqual(receivedLookup, { paymentId: 7n, companyId: 80n });
  assert.deepEqual(payment, { id: 7n, amount: 90 });
});

test('createPayment rejects an invoice from another tenant', async () => {
  await withRepositoryStubs(
    [[invoiceRepository, {
      findCompanyInvoiceById: async () => null,
    }]],
    async () => {
      await assert.rejects(
        () => paymentService.createPayment({ invoiceId: 8n, amount: 50, paymentMethod: 'CASH' }, { companyId: '4' }),
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
        findCompanyPaymentById: async () => ({ id: 6n, invoiceId: 2n, amount: 10 }),
        updateCompanyPayment: async (paymentId, companyId, payload) => {
          receivedUpdate = { paymentId, companyId, payload };
          return { id: paymentId, ...payload };
        },
      }],
      [invoiceRepository, {
        findCompanyInvoiceById: async (invoiceId, companyId) => ({ id: invoiceId, client: { companyId } }),
      }],
    ],
    () => paymentService.updatePayment(6n, { invoiceId: 3n, amount: 15 }, { companyId: '14' }),
  );

  assert.deepEqual(receivedUpdate, {
    paymentId: 6n,
    companyId: 14n,
    payload: { invoiceId: 3n, amount: 15 },
  });
  assert.deepEqual(updatedPayment, { id: 6n, invoiceId: 3n, amount: 15 });
});

test('removePayment rejects deleting a payment outside the authenticated tenant', async () => {
  let deleteCalled = false;

  await withRepositoryStubs(
    [[paymentRepository, {
      findCompanyPaymentById: async () => null,
      deleteCompanyPayment: async () => {
        deleteCalled = true;
      },
    }]],
    async () => {
      await assert.rejects(
        () => paymentService.removePayment(99n, { companyId: '19' }),
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
