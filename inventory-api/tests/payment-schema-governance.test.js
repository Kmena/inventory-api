const test = require('node:test');
const assert = require('node:assert/strict');

const { createPaymentSchema } = require('../src/schemas/payment.schema');

function buildValidPayload(overrides = {}) {
  return {
    invoiceId: 14,
    amount: 50,
    paymentMethod: 'TRANSFER',
    reference: 'SINPE-SEC-100',
    receiptFile: {
      fileName: 'voucher.pdf',
      mimeType: 'application/pdf',
      fileContentBase64: Buffer.from('comprobante privado').toString('base64'),
    },
    ...overrides,
  };
}

test('createPaymentSchema accepts governed payment receipts with valid MIME and base64 payload', () => {
  const parsed = createPaymentSchema.parse(buildValidPayload());
  assert.equal(parsed.receiptFile.fileName, 'voucher.pdf');
});

test('createPaymentSchema rejects mismatched payment receipt MIME type and file extension', () => {
  const result = createPaymentSchema.safeParse(buildValidPayload({
    receiptFile: {
      fileName: 'voucher.pdf',
      mimeType: 'image/png',
      fileContentBase64: Buffer.from('comprobante privado').toString('base64'),
    },
  }));

  assert.equal(result.success, false);
  assert.match(result.error.issues[0].message, /MIME|extension/i);
});

test('createPaymentSchema rejects invalid base64 payment receipt payloads', () => {
  const result = createPaymentSchema.safeParse(buildValidPayload({
    receiptFile: {
      fileName: 'voucher.pdf',
      mimeType: 'application/pdf',
      fileContentBase64: '%%%base64-invalido%%%',
    },
  }));

  assert.equal(result.success, false);
  assert.match(result.error.issues[0].message, /base64/i);
});
