const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

const paymentService = require('../src/services/payment.service');
const receiptEvidenceService = require('../src/services/payment-receipt-evidence.service');
const paymentRepository = require('../src/repositories/payment.repository');
const invoiceRepository = require('../src/repositories/invoice.repository');
const {
  PRIVATE_PAYMENT_RECEIPTS_ROOT,
  buildPrivatePaymentReceiptPath,
} = require('../src/lib/payment-receipt-storage');

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

function buildReceiptFilePayload(overrides = {}) {
  return {
    fileName: 'voucher.pdf',
    mimeType: 'application/pdf',
    fileContentBase64: Buffer.from('comprobante privado').toString('base64'),
    ...overrides,
  };
}

test('createPayment stores receipt evidence outside the public directory and exposes only a protected downloadUrl', async () => {
  await fs.rm(path.join(PRIVATE_PAYMENT_RECEIPTS_ROOT, '91'), { recursive: true, force: true });

  const storedReceipts = [];
  let createdPayment = null;

  const result = await withRepositoryStubs(
    [
      [invoiceRepository, {
        findCompanyInvoiceForFinancialSync: async () => ({
          id: 14n,
          amount: 100,
          status: 'PENDING',
          paidAt: null,
          client: { companyId: 91n },
          payments: [],
        }),
      }],
      [paymentRepository, {
        createPayment: async (payload) => {
          createdPayment = {
            id: 21n,
            ...payload,
            invoice: { id: 14n, client: { companyId: 91n } },
            receipts: [],
          };
          return createdPayment;
        },
        createPaymentReceipt: async (payload) => {
          const receipt = { id: 33n, isCurrent: true, uploadedAt: new Date('2026-07-20T12:00:00.000Z'), replacedAt: null, ...payload };
          storedReceipts.push(receipt);
          return receipt;
        },
        findCompanyPaymentById: async () => ({
          ...createdPayment,
          receipts: storedReceipts,
        }),
        deleteCompanyPayment: async () => ({ count: 1 }),
      }],
    ],
    () => paymentService.createPayment({
      invoiceId: 14n,
      amount: 50,
      paymentMethod: 'TRANSFER',
      reference: 'SINPE-SEC-1',
      receiptFile: buildReceiptFilePayload(),
    }, {
      companyId: '91',
      sub: '8',
      permissions: ['collections.manage.own'],
    }),
  );

  assert.equal(result.receipts.length, 1);
  assert.equal(result.receipts[0].downloadUrl, '/api/payments/21/receipts/33/download');
  assert.equal(Object.hasOwn(result.receipts[0], 'storageRef'), false);

  const absolutePath = buildPrivatePaymentReceiptPath({
    companyId: 91n,
    paymentId: 21n,
    storageRef: storedReceipts[0].storageRef,
  });
  const persistedContent = await fs.readFile(absolutePath, 'utf8');
  assert.equal(persistedContent, 'comprobante privado');
  assert.equal(absolutePath.includes(`${path.sep}src${path.sep}public${path.sep}`), false);
});

test('createPayment rejects receipt files whose MIME type does not match the file extension', async () => {
  await withRepositoryStubs(
    [
      [invoiceRepository, {
        findCompanyInvoiceForFinancialSync: async () => ({
          id: 14n,
          amount: 100,
          status: 'PENDING',
          paidAt: null,
          client: { companyId: 91n },
          payments: [],
        }),
      }],
    ],
    async () => {
      await assert.rejects(
        () => paymentService.createPayment({
          invoiceId: 14n,
          amount: 50,
          paymentMethod: 'TRANSFER',
          reference: 'SINPE-SEC-2',
          receiptFile: buildReceiptFilePayload({
            mimeType: 'image/png',
            fileContentBase64: Buffer.from('contenido incompatible').toString('base64'),
          }),
        }, {
          companyId: '91',
          sub: '8',
          permissions: ['collections.manage.own'],
        }),
        (error) => error?.statusCode === 400 && error?.code === 'validation_error' && /mime|extension/i.test(error.message),
      );
    },
  );
});

test('createPayment removes the created payment and the private file when receipt DB persistence fails after file storage', async () => {
  await fs.rm(path.join(PRIVATE_PAYMENT_RECEIPTS_ROOT, '91'), { recursive: true, force: true });

  let createdPayment = null;
  let deletedPaymentId = null;
  const expectedStorageRef = '1721600000000-voucher.pdf';

  await withRepositoryStubs(
    [
      [invoiceRepository, {
        findCompanyInvoiceForFinancialSync: async () => ({
          id: 14n,
          amount: 100,
          status: 'PENDING',
          paidAt: null,
          client: { companyId: 91n },
          payments: [],
        }),
      }],
      [paymentRepository, {
        createPayment: async (payload) => {
          createdPayment = {
            id: 22n,
            ...payload,
            invoice: { id: 14n, client: { companyId: 91n } },
            receipts: [],
          };
          return createdPayment;
        },
        createPaymentReceipt: async () => {
          throw new Error('receipt db unavailable');
        },
        deleteCompanyPayment: async (paymentId) => {
          deletedPaymentId = paymentId;
          return { count: 1 };
        },
      }],
      [Date, {
        now: () => 1721600000000,
      }],
    ],
    async () => {
      await assert.rejects(
        () => paymentService.createPayment({
          invoiceId: 14n,
          amount: 50,
          paymentMethod: 'TRANSFER',
          reference: 'SINPE-SEC-ROLLBACK',
          receiptFile: buildReceiptFilePayload(),
        }, {
          companyId: '91',
          sub: '8',
          permissions: ['collections.manage.own'],
        }),
        (error) => {
          assert.equal(error.statusCode, 500);
          assert.equal(error.code, 'internal_server_error');
          assert.equal(error.message, 'No se pudo guardar la evidencia del pago');
          return true;
        },
      );
    },
  );

  assert.equal(deletedPaymentId, 22n);
  const absolutePath = buildPrivatePaymentReceiptPath({
    companyId: 91n,
    paymentId: 22n,
    storageRef: expectedStorageRef,
  });
  await assert.rejects(() => fs.access(absolutePath), /ENOENT/);
});

test('createPayment currently surfaces payment cleanup failure after receipt persistence fails', async () => {
  await fs.rm(path.join(PRIVATE_PAYMENT_RECEIPTS_ROOT, '91'), { recursive: true, force: true });

  const expectedStorageRef = '1721600000001-voucher.pdf';

  await withRepositoryStubs(
    [
      [invoiceRepository, {
        findCompanyInvoiceForFinancialSync: async () => ({
          id: 14n,
          amount: 100,
          status: 'PENDING',
          paidAt: null,
          client: { companyId: 91n },
          payments: [],
        }),
      }],
      [paymentRepository, {
        createPayment: async (payload) => ({
          id: 23n,
          ...payload,
          invoice: { id: 14n, client: { companyId: 91n } },
          receipts: [],
        }),
        createPaymentReceipt: async () => {
          throw new Error('receipt db unavailable');
        },
        deleteCompanyPayment: async () => {
          throw new Error('payment rollback failed');
        },
      }],
      [Date, {
        now: () => 1721600000001,
      }],
    ],
    async () => {
      await assert.rejects(
        () => paymentService.createPayment({
          invoiceId: 14n,
          amount: 50,
          paymentMethod: 'TRANSFER',
          reference: 'SINPE-SEC-ROLLBACK-FAIL',
          receiptFile: buildReceiptFilePayload(),
        }, {
          companyId: '91',
          sub: '8',
          permissions: ['collections.manage.own'],
        }),
        /payment rollback failed/,
      );
    },
  );

  const absolutePath = buildPrivatePaymentReceiptPath({
    companyId: 91n,
    paymentId: 23n,
    storageRef: expectedStorageRef,
  });
  await assert.rejects(() => fs.access(absolutePath), /ENOENT/);
});

test('createPaymentReceiptEvidence currently tolerates cleanup failure and may leave an orphan private receipt file', async () => {
  await fs.rm(path.join(PRIVATE_PAYMENT_RECEIPTS_ROOT, '91'), { recursive: true, force: true });

  const payment = { id: 24n, invoice: { client: { companyId: 91n } } };
  const receiptFile = {
    ...buildReceiptFilePayload(),
    _validatedReceiptPayload: {
      buffer: Buffer.from('comprobante huerfano'),
      mimeType: 'application/pdf',
    },
  };
  const expectedStorageRef = '1721600000002-voucher.pdf';

  await withRepositoryStubs(
    [
      [paymentRepository, {
        createPaymentReceipt: async () => {
          throw new Error('receipt db unavailable');
        },
      }],
      [Date, {
        now: () => 1721600000002,
      }],
      [fs, {
        unlink: async () => {
          throw new Error('unlink failed');
        },
      }],
    ],
    async () => {
      await assert.rejects(
        () => receiptEvidenceService.createPaymentReceiptEvidence(payment, receiptFile, {
          companyId: '91',
          sub: '8',
          permissions: ['collections.manage.own'],
        }),
        /receipt db unavailable/,
      );
    },
  );

  const absolutePath = buildPrivatePaymentReceiptPath({
    companyId: 91n,
    paymentId: 24n,
    storageRef: expectedStorageRef,
  });
  const persistedContent = await fs.readFile(absolutePath, 'utf8');
  assert.equal(persistedContent, 'comprobante huerfano');

  await fs.rm(path.join(PRIVATE_PAYMENT_RECEIPTS_ROOT, '91'), { recursive: true, force: true });
});

test('replacePaymentReceiptEvidence removes the new private file when the replacement transaction fails', async () => {
  await fs.rm(path.join(PRIVATE_PAYMENT_RECEIPTS_ROOT, '91'), { recursive: true, force: true });

  const payment = { id: 25n, invoice: { client: { companyId: 91n } } };
  const receiptFile = {
    ...buildReceiptFilePayload(),
    _validatedReceiptPayload: {
      buffer: Buffer.from('comprobante reemplazo'),
      mimeType: 'application/pdf',
    },
  };
  const expectedStorageRef = '1721600000003-voucher.pdf';

  await withRepositoryStubs(
    [
      [paymentRepository, {
        transaction: async (work) => work({}),
        markPaymentReceiptsAsReplaced: async () => ({ count: 1 }),
        createPaymentReceipt: async () => {
          throw new Error('replacement receipt db unavailable');
        },
      }],
      [Date, {
        now: () => 1721600000003,
      }],
    ],
    async () => {
      await assert.rejects(
        () => receiptEvidenceService.replacePaymentReceiptEvidence(payment, receiptFile, {
          companyId: '91',
          sub: '8',
          permissions: ['collections.manage.own'],
        }),
        /replacement receipt db unavailable/,
      );
    },
  );

  const absolutePath = buildPrivatePaymentReceiptPath({
    companyId: 91n,
    paymentId: 25n,
    storageRef: expectedStorageRef,
  });
  await assert.rejects(() => fs.access(absolutePath), /ENOENT/);
});

test('getPaymentReceiptDownload resolves the protected file only for the authenticated tenant scope', async () => {
  const storageRef = 'download-voucher.pdf';
  const absolutePath = buildPrivatePaymentReceiptPath({ companyId: 91n, paymentId: 21n, storageRef });
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, 'descarga privada');

  const download = await withRepositoryStubs(
    [
      [paymentRepository, {
        findCompanyPaymentById: async () => ({ id: 21n, invoiceId: 14n, amount: 50, status: 'PENDING_APPROVAL', receipts: [] }),
        findCompanyPaymentReceiptById: async () => ({
          id: 33n,
          paymentId: 21n,
          storageRef,
          originalFileName: 'voucher.pdf',
          mimeType: 'application/pdf',
        }),
      }],
    ],
    () => paymentService.getPaymentReceiptDownload(21n, 33n, {
      companyId: '91',
      sub: '8',
      permissions: ['collections.manage.own'],
    }),
  );

  assert.equal(download.fileName, 'voucher.pdf');
  assert.equal(download.mimeType, 'application/pdf');
  assert.equal(download.absolutePath, absolutePath);
});
