const test = require('node:test');
const assert = require('node:assert/strict');

const invoiceService = require('../src/services/invoice.service');
const paymentService = require('../src/services/payment.service');
const invoiceRepository = require('../src/repositories/invoice.repository');
const paymentRepository = require('../src/repositories/payment.repository');
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

function createPassThroughTransactionStub() {
  return async (work) => work({ kind: 'tx' });
}

function clonePayment(payment) {
  return {
    ...payment,
    approvedAt: payment.approvedAt ? new Date(payment.approvedAt) : null,
    rejectedAt: payment.rejectedAt ? new Date(payment.rejectedAt) : null,
    reversedAt: payment.reversedAt ? new Date(payment.reversedAt) : null,
    invoice: payment.invoice ? { ...payment.invoice, client: payment.invoice.client ? { ...payment.invoice.client } : payment.invoice.client } : payment.invoice,
    receipts: (payment.receipts || []).map((receipt) => ({ ...receipt })),
  };
}

function cloneInvoice(invoice) {
  return {
    ...invoice,
    paidAt: invoice.paidAt ? new Date(invoice.paidAt) : null,
    client: invoice.client ? { ...invoice.client } : invoice.client,
    payments: (invoice.payments || []).map((payment) => ({
      ...payment,
      approvedAt: payment.approvedAt ? new Date(payment.approvedAt) : null,
      createdAt: payment.createdAt ? new Date(payment.createdAt) : null,
      rejectedAt: payment.rejectedAt ? new Date(payment.rejectedAt) : null,
      reversedAt: payment.reversedAt ? new Date(payment.reversedAt) : null,
    })),
  };
}

function createPaymentFinancialTransactionHarness({ paymentStatus, throwOnInvoiceUpdate }) {
  const state = {
    payment: {
      id: 11n,
      invoiceId: 8n,
      amount: 40,
      paymentMethod: 'TRANSFER',
      reference: 'SINPE-200',
      status: paymentStatus,
      reviewReason: 'Revision inicial',
      invoice: { id: 8n, client: { companyId: 9n } },
      receipts: [],
    },
    invoice: {
      id: 8n,
      clientId: 4n,
      amount: 100,
      status: paymentStatus === 'APPROVED' ? 'PAID' : 'PENDING',
      paidAt: paymentStatus === 'APPROVED' ? new Date('2026-07-20T10:00:00.000Z') : null,
      client: { companyId: 9n },
      payments: [
        {
          id: 1n,
          amount: 60,
          status: 'APPROVED',
          approvedAt: new Date('2026-07-20T09:00:00.000Z'),
          createdAt: new Date('2026-07-20T09:00:00.000Z'),
        },
        {
          id: 11n,
          amount: 40,
          status: paymentStatus,
          approvedAt: paymentStatus === 'APPROVED' ? new Date('2026-07-20T10:00:00.000Z') : null,
          createdAt: new Date('2026-07-20T10:00:00.000Z'),
        },
      ],
    },
  };

  function getStore(db) {
    return db?.state || state;
  }

  function findPaymentRecord(store) {
    return store.invoice.payments.find((payment) => payment.id === 11n);
  }

  return {
    state,
    paymentRepositoryStubs: {
      transaction: async (work) => {
        const tx = {
          state: {
            payment: clonePayment(state.payment),
            invoice: cloneInvoice(state.invoice),
          },
        };

        const result = await work(tx);
        state.payment = clonePayment(tx.state.payment);
        state.invoice = cloneInvoice(tx.state.invoice);
        return result;
      },
      findCompanyPaymentById: async (_id, _companyId, _options, db) => clonePayment(getStore(db).payment),
      approveCompanyPayment: async (_id, _companyId, data, db) => {
        const store = getStore(db);
        store.payment.status = 'APPROVED';
        store.payment.approvedAt = data.approvedAt;
        store.payment.approvedByUserId = data.approvedByUserId;
        store.payment.reviewReason = data.reviewReason;
        const paymentRecord = findPaymentRecord(store);
        paymentRecord.status = 'APPROVED';
        paymentRecord.approvedAt = data.approvedAt;
        return clonePayment(store.payment);
      },
      rejectCompanyPayment: async (_id, _companyId, data, db) => {
        const store = getStore(db);
        store.payment.status = 'REJECTED';
        store.payment.rejectedAt = data.rejectedAt;
        store.payment.rejectedByUserId = data.rejectedByUserId;
        store.payment.rejectionReason = data.rejectionReason;
        const paymentRecord = findPaymentRecord(store);
        paymentRecord.status = 'REJECTED';
        paymentRecord.rejectedAt = data.rejectedAt;
        return clonePayment(store.payment);
      },
      reverseCompanyPayment: async (_id, _companyId, data, db) => {
        const store = getStore(db);
        store.payment.status = 'REVERSED';
        store.payment.reversedAt = data.reversedAt;
        store.payment.reversedByUserId = data.reversedByUserId;
        store.payment.reversalReason = data.reversalReason;
        const paymentRecord = findPaymentRecord(store);
        paymentRecord.status = 'REVERSED';
        paymentRecord.reversedAt = data.reversedAt;
        return { count: 1 };
      },
    },
    invoiceRepositoryStubs: {
      findCompanyInvoiceForFinancialSync: async (_invoiceId, _companyId, db) => cloneInvoice(getStore(db).invoice),
      updateCompanyInvoiceFinancialState: async (_invoiceId, _companyId, payload, db) => {
        if (throwOnInvoiceUpdate) {
          throw new Error('invoice_sync_failed');
        }
        const store = getStore(db);
        store.invoice.status = payload.status;
        store.invoice.paidAt = payload.paidAt;
        return cloneInvoice(store.invoice);
      },
    },
  };
}

test('createInvoice ignores caller-provided status and paidAt in the normal flow', async () => {
  let capturedPayload = null;

  await withRepositoryStubs(
    [
      [clientRepository, {
        findCompanyClientById: async (clientId, companyId) => ({ id: clientId, companyId }),
      }],
      [invoiceRepository, {
        createInvoice: async (payload) => {
          capturedPayload = payload;
          return { id: 1n, ...payload, payments: [] };
        },
      }],
    ],
    async () => {
      await invoiceService.createInvoice({
        clientId: 5n,
        number: 'F-100',
        amount: 100,
        status: 'PAID',
        paidAt: '2026-07-20T12:00:00.000Z',
      }, { companyId: '9' });
    },
  );

  assert.equal(Object.hasOwn(capturedPayload, 'status'), false);
  assert.equal(Object.hasOwn(capturedPayload, 'paidAt'), false);
});

test('updateInvoice ignores caller-provided status and paidAt during invoice edits', async () => {
  let capturedUpdate = null;

  await withRepositoryStubs(
    [
      [invoiceRepository, {
        findCompanyInvoiceById: async () => ({
          id: 2n,
          clientId: 5n,
          orderId: null,
          number: 'F-200',
          amount: 100,
          status: 'PENDING',
          paidAt: null,
        }),
        updateCompanyInvoice: async (_invoiceId, _companyId, payload) => {
          capturedUpdate = payload;
          return { id: 2n, ...payload };
        },
      }],
      [clientRepository, {
        findCompanyClientById: async (clientId, companyId) => ({ id: clientId, companyId }),
      }],
    ],
    async () => {
      await invoiceService.updateInvoice(2n, {
        status: 'PARTIAL',
        paidAt: '2026-07-21T09:30:00.000Z',
      }, { companyId: '9' });
    },
  );

  assert.equal(Object.hasOwn(capturedUpdate, 'status'), false);
  assert.equal(Object.hasOwn(capturedUpdate, 'paidAt'), false);
});

test('createPayment registers a pending payment without mutating invoice status or paidAt', async () => {
  let updateInvoiceFinancialStateCalls = 0;
  let capturedCreatePayload = null;

  const createdPayment = await withRepositoryStubs(
    [
      [invoiceRepository, {
        findCompanyInvoiceForFinancialSync: async () => ({
          id: 8n,
          clientId: 4n,
          amount: 100,
          status: 'PENDING',
          paidAt: null,
          client: { companyId: 9n },
          payments: [],
        }),
        updateCompanyInvoiceFinancialState: async () => {
          updateInvoiceFinancialStateCalls += 1;
          return null;
        },
      }],
      [paymentRepository, {
        createPayment: async (payload) => {
          capturedCreatePayload = payload;
          return {
            id: 10n,
            ...payload,
            invoice: { id: 8n, client: { companyId: 9n } },
            receipts: [],
          };
        },
        findCompanyPaymentById: async () => ({
          id: 10n,
          invoiceId: 8n,
          amount: 100,
          paymentMethod: 'TRANSFER',
          reference: 'SINPE-123',
          status: 'PENDING_APPROVAL',
          invoice: { id: 8n, client: { companyId: 9n } },
          receipts: [],
        }),
        deleteCompanyPayment: async () => ({ count: 1 }),
      }],
    ],
    () => paymentService.createPayment({
      invoiceId: 8n,
      amount: 100,
      paymentMethod: 'TRANSFER',
      reference: 'SINPE-123',
    }, { companyId: '9', sub: '22', permissions: ['collections.manage.own'] }),
  );

  assert.equal(capturedCreatePayload.status, 'PENDING_APPROVAL');
  assert.equal(capturedCreatePayload.submittedByUserId, 22n);
  assert.equal(updateInvoiceFinancialStateCalls, 0);
  assert.equal(createdPayment.status, 'PENDING_APPROVAL');
});

test('approvePayment accepts exact decimal completion without false overpayment conflicts', async () => {
  let updateFinancialStatePayload = null;
  let currentPaymentStatus = 'PENDING_APPROVAL';
  let currentApprovedAt = null;

  const approvedPayment = await withRepositoryStubs(
    [
      [paymentRepository, {
        transaction: createPassThroughTransactionStub(),
        findCompanyPaymentById: async () => ({
          id: 21n,
          invoiceId: 18n,
          amount: 0.2,
          paymentMethod: 'TRANSFER',
          reference: 'SINPE-DECIMAL',
          status: currentPaymentStatus,
          invoice: { id: 18n, client: { companyId: 9n } },
          receipts: [],
        }),
        approveCompanyPayment: async (_id, _companyId, data) => {
          currentPaymentStatus = 'APPROVED';
          currentApprovedAt = data.approvedAt;
          return {
            id: 21n,
            invoiceId: 18n,
            amount: 0.2,
            paymentMethod: 'TRANSFER',
            reference: 'SINPE-DECIMAL',
            status: 'APPROVED',
            approvedAt: data.approvedAt,
            invoice: { id: 18n, client: { companyId: 9n } },
            receipts: [],
          };
        },
      }],
      [invoiceRepository, {
        findCompanyInvoiceForFinancialSync: async () => ({
          id: 18n,
          clientId: 4n,
          amount: 0.3,
          status: 'PENDING',
          paidAt: null,
          client: { companyId: 9n },
          payments: [
            {
              id: 1n,
              amount: 0.1,
              status: 'APPROVED',
              approvedAt: new Date('2026-07-20T09:00:00.000Z'),
              createdAt: new Date('2026-07-20T09:00:00.000Z'),
            },
            {
              id: 21n,
              amount: 0.2,
              status: currentPaymentStatus,
              approvedAt: currentApprovedAt,
              createdAt: new Date('2026-07-20T10:00:00.000Z'),
            },
          ],
        }),
        updateCompanyInvoiceFinancialState: async (_invoiceId, _companyId, payload) => {
          updateFinancialStatePayload = payload;
          return { id: 18n, ...payload };
        },
      }],
    ],
    () => paymentService.approvePayment(21n, {}, { companyId: '9', sub: '55', permissions: ['collections.payments.approve'] }),
  );

  assert.equal(updateFinancialStatePayload.status, 'PAID');
  assert.equal(updateFinancialStatePayload.paidAt.toISOString(), currentApprovedAt.toISOString());
  assert.equal(approvedPayment.status, 'APPROVED');
});

test('approvePayment synchronizes invoice status and paidAt using approved payments only', async () => {
  let updateFinancialStatePayload = null;
  let currentPaymentStatus = 'PENDING_APPROVAL';
  let currentApprovedAt = null;

  const approvedPayment = await withRepositoryStubs(
    [
      [paymentRepository, {
        transaction: createPassThroughTransactionStub(),
        findCompanyPaymentById: async () => ({
          id: 11n,
          invoiceId: 8n,
          amount: 40,
          paymentMethod: 'TRANSFER',
          reference: 'SINPE-200',
          status: currentPaymentStatus,
          invoice: { id: 8n, client: { companyId: 9n } },
          receipts: [],
        }),
        approveCompanyPayment: async (_id, _companyId, data) => {
          currentPaymentStatus = 'APPROVED';
          currentApprovedAt = data.approvedAt;
          return {
            id: 11n,
            invoiceId: 8n,
            amount: 40,
            paymentMethod: 'TRANSFER',
            reference: 'SINPE-200',
            status: 'APPROVED',
            approvedAt: data.approvedAt,
            invoice: { id: 8n, client: { companyId: 9n } },
            receipts: [],
          };
        },
      }],
      [invoiceRepository, {
        findCompanyInvoiceForFinancialSync: async () => ({
          id: 8n,
          clientId: 4n,
          amount: 100,
          status: 'PENDING',
          paidAt: null,
          client: { companyId: 9n },
          payments: [
            {
              id: 1n,
              amount: 60,
              status: 'APPROVED',
              approvedAt: new Date('2026-07-20T09:00:00.000Z'),
              createdAt: new Date('2026-07-20T09:00:00.000Z'),
            },
            {
              id: 11n,
              amount: 40,
              status: currentPaymentStatus,
              approvedAt: currentApprovedAt,
              createdAt: new Date('2026-07-20T10:00:00.000Z'),
            },
            {
              id: 3n,
              amount: 25,
              status: 'PENDING_APPROVAL',
              approvedAt: null,
              createdAt: new Date('2026-07-20T11:00:00.000Z'),
            },
          ],
        }),
        updateCompanyInvoiceFinancialState: async (_invoiceId, _companyId, payload) => {
          updateFinancialStatePayload = payload;
          return { id: 8n, ...payload };
        },
      }],
    ],
    () => paymentService.approvePayment(11n, {}, { companyId: '9', sub: '55', permissions: ['collections.payments.approve'] }),
  );

  assert.equal(updateFinancialStatePayload.status, 'PAID');
  assert.equal(updateFinancialStatePayload.paidAt.toISOString(), currentApprovedAt.toISOString());
  assert.equal(approvedPayment.status, 'APPROVED');
});

test('removePayment reverses an approved payment and re-synchronizes invoice status', async () => {
  let updateFinancialStatePayload = null;

  await withRepositoryStubs(
    [
      [paymentRepository, {
        transaction: createPassThroughTransactionStub(),
        findCompanyPaymentById: async (paymentId) => ({
          id: paymentId,
          invoiceId: 8n,
          amount: 100,
          status: 'APPROVED',
          paymentMethod: 'TRANSFER',
          reference: 'SINPE-300',
          invoice: { id: 8n, client: { companyId: 9n } },
          receipts: [],
        }),
        reverseCompanyPayment: async () => ({ count: 1 }),
      }],
      [invoiceRepository, {
        findCompanyInvoiceForFinancialSync: async () => ({
          id: 8n,
          clientId: 4n,
          amount: 100,
          status: 'PAID',
          paidAt: new Date('2026-07-20T10:00:00.000Z'),
          client: { companyId: 9n },
          payments: [],
        }),
        updateCompanyInvoiceFinancialState: async (_invoiceId, _companyId, payload) => {
          updateFinancialStatePayload = payload;
          return { id: 8n, ...payload };
        },
      }],
    ],
    async () => {
      await paymentService.removePayment(12n, { companyId: '9', sub: '55', permissions: ['collections.payments.reverse'] });
    },
  );

  assert.equal(updateFinancialStatePayload.status, 'PENDING');
  assert.equal(updateFinancialStatePayload.paidAt, null);
});

test('approvePayment rolls back payment state when invoice financial sync fails inside the transaction', async () => {
  const harness = createPaymentFinancialTransactionHarness({
    paymentStatus: 'PENDING_APPROVAL',
    throwOnInvoiceUpdate: true,
  });

  await withRepositoryStubs(
    [
      [paymentRepository, harness.paymentRepositoryStubs],
      [invoiceRepository, harness.invoiceRepositoryStubs],
    ],
    async () => {
      await assert.rejects(
        () => paymentService.approvePayment(11n, {}, { companyId: '9', sub: '55', permissions: ['collections.payments.approve'] }),
        /invoice_sync_failed/,
      );
    },
  );

  assert.equal(harness.state.payment.status, 'PENDING_APPROVAL');
  assert.equal(harness.state.invoice.status, 'PENDING');
  assert.equal(harness.state.invoice.paidAt, null);
});

test('rejectPayment rolls back payment state when invoice financial sync fails inside the transaction', async () => {
  const harness = createPaymentFinancialTransactionHarness({
    paymentStatus: 'UNDER_REVIEW',
    throwOnInvoiceUpdate: true,
  });

  await withRepositoryStubs(
    [
      [paymentRepository, harness.paymentRepositoryStubs],
      [invoiceRepository, harness.invoiceRepositoryStubs],
    ],
    async () => {
      await assert.rejects(
        () => paymentService.rejectPayment(11n, { reason: 'Comprobante invalido' }, { companyId: '9', sub: '55', permissions: ['collections.payments.approve'] }),
        /invoice_sync_failed/,
      );
    },
  );

  assert.equal(harness.state.payment.status, 'UNDER_REVIEW');
  assert.equal(harness.state.invoice.status, 'PENDING');
  assert.equal(harness.state.invoice.paidAt, null);
});

test('reversePayment rolls back payment state when invoice financial sync fails inside the transaction', async () => {
  const harness = createPaymentFinancialTransactionHarness({
    paymentStatus: 'APPROVED',
    throwOnInvoiceUpdate: true,
  });

  await withRepositoryStubs(
    [
      [paymentRepository, harness.paymentRepositoryStubs],
      [invoiceRepository, harness.invoiceRepositoryStubs],
    ],
    async () => {
      await assert.rejects(
        () => paymentService.reversePayment(11n, { companyId: '9', sub: '55', permissions: ['collections.payments.reverse'] }, 'Ajuste administrativo'),
        /invoice_sync_failed/,
      );
    },
  );

  assert.equal(harness.state.payment.status, 'APPROVED');
  assert.equal(harness.state.invoice.status, 'PAID');
  assert.equal(harness.state.invoice.paidAt?.toISOString(), '2026-07-20T10:00:00.000Z');
});

test('listInvoiceDebtInconsistencies derives pendingAmount from approved payments only', async () => {
  const result = await withRepositoryStubs(
    [[invoiceRepository, {
      findInvoicesForDebtReview: async () => ([{
        id: 50n,
        number: 'F-050',
        amount: 100,
        status: 'PARTIAL',
        issuedAt: new Date('2026-07-15T00:00:00Z'),
        dueAt: null,
        paidAt: null,
        clientId: 3n,
        client: { id: 3n, code: 'C-3', name: 'Cliente 3' },
        order: {
          id: 5n,
          clientId: 3n,
          clientStoreId: 9n,
          clientStore: { id: 9n, name: 'Tienda 9', clientId: 99n },
        },
        payments: [
          { id: 1n, amount: 20, status: 'APPROVED', approvedAt: new Date('2026-07-15T08:00:00Z'), createdAt: new Date('2026-07-15T08:00:00Z') },
          { id: 2n, amount: 80, status: 'PENDING_APPROVAL', approvedAt: null, createdAt: new Date('2026-07-15T09:00:00Z') },
          { id: 3n, amount: 10, status: 'REVERSED', approvedAt: new Date('2026-07-15T07:00:00Z'), createdAt: new Date('2026-07-15T07:00:00Z') },
        ],
      }]),
    }]],
    () => invoiceService.listInvoiceDebtInconsistencies({ companyId: '77' }),
  );

  assert.equal(result.summary.total, 1);
  assert.equal(result.invoices[0].pendingAmount, 80);
  assert.equal(result.invoices[0].status, 'PARTIAL');
  assert.equal(result.invoices[0].client.id, 3n);
});
