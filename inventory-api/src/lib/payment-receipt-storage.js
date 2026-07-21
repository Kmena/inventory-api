const path = require('path');

const PRIVATE_PAYMENT_RECEIPTS_ROOT = path.resolve(__dirname, '..', '..', 'storage', 'private', 'payment-receipts');

function sanitizePaymentReceiptFileName(name) {
  return String(name || 'comprobante').replace(/[^a-zA-Z0-9._-]/g, '_');
}

function buildProtectedPaymentReceiptUrl(paymentId, receiptId) {
  return `/api/payments/${paymentId}/receipts/${receiptId}/download`;
}

function buildStorageReference(fileName, now = Date.now()) {
  const sanitizedFileName = sanitizePaymentReceiptFileName(fileName);
  return `${String(now)}-${sanitizedFileName}`;
}

function buildPrivatePaymentReceiptPath({ companyId, paymentId, storageRef }) {
  const sanitizedStorageRef = sanitizePaymentReceiptFileName(storageRef);

  return path.join(
    PRIVATE_PAYMENT_RECEIPTS_ROOT,
    String(companyId),
    String(paymentId),
    sanitizedStorageRef,
  );
}

module.exports = {
  PRIVATE_PAYMENT_RECEIPTS_ROOT,
  sanitizePaymentReceiptFileName,
  buildProtectedPaymentReceiptUrl,
  buildStorageReference,
  buildPrivatePaymentReceiptPath,
};
