const test = require('node:test');
const assert = require('node:assert/strict');

const { createPaymentSchema, CARD_TYPES } = require('../src/schemas/payment.schema');

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

// ── Method-conditional field tests ──────────────────────────────────────────

test('createPaymentSchema accepts CASH payment without reference (reference is method-conditional)', () => {
  const result = createPaymentSchema.safeParse({
    invoiceId: 1,
    amount: 10000,
    paymentMethod: 'CASH',
  });
  assert.equal(result.success, true);
  assert.equal(result.data.reference ?? null, null);
});

test('createPaymentSchema rejects TRANSFER payment without reference', () => {
  const result = createPaymentSchema.safeParse({
    invoiceId: 1,
    amount: 10000,
    paymentMethod: 'TRANSFER',
  });
  assert.equal(result.success, false);
  const refIssue = result.error.issues.find((i) => i.path.includes('reference'));
  assert.ok(refIssue, 'should have a reference issue');
});

test('createPaymentSchema accepts TRANSFER payment with reference and optional bankName', () => {
  const result = createPaymentSchema.safeParse({
    invoiceId: 1,
    amount: 10000,
    paymentMethod: 'TRANSFER',
    reference: 'SINPE-001',
    bankName: 'BAC San José',
  });
  assert.equal(result.success, true);
  assert.equal(result.data.bankName, 'BAC San José');
});

test('createPaymentSchema accepts CARD payment with valid cardType', () => {
  const result = createPaymentSchema.safeParse({
    invoiceId: 1,
    amount: 5000,
    paymentMethod: 'CARD',
    cardType: 'VISA',
  });
  assert.equal(result.success, true);
  assert.equal(result.data.cardType, 'VISA');
});

test('createPaymentSchema rejects unknown cardType values', () => {
  const result = createPaymentSchema.safeParse({
    invoiceId: 1,
    amount: 5000,
    paymentMethod: 'CARD',
    cardType: 'BITCOIN',
  });
  assert.equal(result.success, false);
});

test('CARD_TYPES export contains expected card network values', () => {
  assert.ok(Array.isArray(CARD_TYPES));
  assert.ok(CARD_TYPES.includes('VISA'));
  assert.ok(CARD_TYPES.includes('MASTERCARD'));
  assert.ok(CARD_TYPES.includes('AMEX'));
  assert.ok(CARD_TYPES.includes('DINERS'));
  assert.ok(CARD_TYPES.includes('OTHER'));
});
