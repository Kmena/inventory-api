const test = require('node:test');
const assert = require('node:assert/strict');

const {
  serializePayment,
  validatePaymentReceiptPayload,
} = require('../src/services/payment-receipt-evidence.service');

test('serializePayment exposes protected receipt download URLs without mutating the base payment contract', () => {
  const serialized = serializePayment({
    id: 18n,
    status: 'PENDING_APPROVAL',
    receipts: [{
      id: 3n,
      originalFileName: 'voucher.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 128n,
      isCurrent: true,
      uploadedAt: new Date('2026-01-05T10:00:00Z'),
      uploadedByUserId: 9n,
      replacedAt: null,
      note: 'evidencia',
    }],
  });

  assert.equal(serialized.id, 18n);
  assert.equal(serialized.receipts[0].downloadUrl, '/api/payments/18/receipts/3/download');
});

test('validatePaymentReceiptPayload rejects mismatched MIME type and extension with validation semantics', () => {
  assert.throws(
    () => validatePaymentReceiptPayload({
      fileName: 'voucher.pdf',
      mimeType: 'image/png',
      fileContentBase64: Buffer.from('privado').toString('base64'),
    }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, 'validation_error');
      assert.match(error.message, /MIME|extension/i);
      return true;
    },
  );
});
