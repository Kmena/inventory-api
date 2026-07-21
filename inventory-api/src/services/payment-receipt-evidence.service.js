const fs = require('node:fs/promises');
const path = require('node:path');

const paymentRepository = require('../repositories/payment.repository');
const { createHttpError } = require('../lib/errors');
const {
  buildProtectedPaymentReceiptUrl,
  buildPrivatePaymentReceiptPath,
  buildStorageReference,
} = require('../lib/payment-receipt-storage');
const {
  PAYMENT_RECEIPT_MAX_FILE_SIZE_BYTES,
  PAYMENT_RECEIPT_ALLOWED_MIME_TYPES,
  PAYMENT_RECEIPT_EXTENSION_MIME_MAP,
  GovernedFileValidationError,
  validateGovernedBase64FilePayload,
} = require('../lib/sensitive-file-governance');
const { getActorUserId } = require('./approval-baseline.service');

function serializePaymentReceipt(receipt, paymentId) {
  return {
    id: receipt.id,
    originalFileName: receipt.originalFileName,
    mimeType: receipt.mimeType,
    fileSizeBytes: receipt.fileSizeBytes,
    isCurrent: receipt.isCurrent,
    uploadedAt: receipt.uploadedAt,
    uploadedByUserId: receipt.uploadedByUserId,
    replacedAt: receipt.replacedAt,
    note: receipt.note,
    downloadUrl: buildProtectedPaymentReceiptUrl(paymentId, receipt.id),
  };
}

function serializePayment(payment) {
  return {
    ...payment,
    receipts: (payment.receipts || []).map((receipt) => serializePaymentReceipt(receipt, payment.id)),
  };
}

function serializePaymentList(payments) {
  return payments.map(serializePayment);
}

async function persistPaymentReceiptFile({ companyId, paymentId, storageRef, buffer }) {
  const absolutePath = buildPrivatePaymentReceiptPath({ companyId, paymentId, storageRef });
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, buffer);
  return absolutePath;
}

async function deletePaymentReceiptFileQuietly({ companyId, paymentId, storageRef }) {
  try {
    await fs.unlink(buildPrivatePaymentReceiptPath({ companyId, paymentId, storageRef }));
  } catch {
    // best-effort cleanup
  }
}

function validatePaymentReceiptPayload(receiptFile) {
  try {
    return validateGovernedBase64FilePayload({
      fileName: receiptFile.fileName,
      mimeType: receiptFile.mimeType,
      fileContentBase64: receiptFile.fileContentBase64,
      maxFileSizeBytes: PAYMENT_RECEIPT_MAX_FILE_SIZE_BYTES,
      allowedMimeTypes: PAYMENT_RECEIPT_ALLOWED_MIME_TYPES,
      extensionMimeMap: PAYMENT_RECEIPT_EXTENSION_MIME_MAP,
      allowMimeTypeInference: false,
      invalidMimeTypeMessage: 'El comprobante adjunto debe ser PDF, imagen PNG/JPEG, CSV o Excel compatible',
      mimeExtensionMismatchMessage: 'El tipo MIME del comprobante no coincide con la extension del archivo',
      maxFileSizeMessage: 'El comprobante adjunto supera el tamano maximo de 20 MB',
    });
  } catch (error) {
    if (error instanceof GovernedFileValidationError) {
      throw createHttpError(400, error.message, 'validation_error');
    }
    throw error;
  }
}

async function createPaymentReceiptEvidence(payment, receiptFile, auth) {
  if (!receiptFile) {
    return null;
  }

  const companyId = BigInt(payment.invoice.client.companyId);
  const storageRef = buildStorageReference(receiptFile.fileName);
  const { buffer: fileBuffer, mimeType } = receiptFile._validatedReceiptPayload || validatePaymentReceiptPayload(receiptFile);

  await persistPaymentReceiptFile({
    companyId,
    paymentId: payment.id,
    storageRef,
    buffer: fileBuffer,
  });

  try {
    return await paymentRepository.createPaymentReceipt({
      paymentId: payment.id,
      storageRef,
      originalFileName: receiptFile.fileName,
      mimeType,
      fileSizeBytes: BigInt(fileBuffer.length),
      uploadedByUserId: getActorUserId(auth),
      note: receiptFile.note || null,
    });
  } catch (error) {
    await deletePaymentReceiptFileQuietly({ companyId, paymentId: payment.id, storageRef });
    throw error;
  }
}

async function replacePaymentReceiptEvidence(payment, receiptFile, auth) {
  if (!receiptFile) {
    return null;
  }

  const companyId = BigInt(payment.invoice.client.companyId);
  const storageRef = buildStorageReference(receiptFile.fileName);
  const { buffer: fileBuffer, mimeType } = receiptFile._validatedReceiptPayload || validatePaymentReceiptPayload(receiptFile);

  await persistPaymentReceiptFile({
    companyId,
    paymentId: payment.id,
    storageRef,
    buffer: fileBuffer,
  });

  try {
    await paymentRepository.transaction(async (tx) => {
      await paymentRepository.markPaymentReceiptsAsReplaced(payment.id, new Date(), tx);
      await paymentRepository.createPaymentReceipt({
        paymentId: payment.id,
        storageRef,
        originalFileName: receiptFile.fileName,
        mimeType,
        fileSizeBytes: BigInt(fileBuffer.length),
        uploadedByUserId: getActorUserId(auth),
        note: receiptFile.note || null,
      }, tx);
    });
  } catch (error) {
    await deletePaymentReceiptFileQuietly({ companyId, paymentId: payment.id, storageRef });
    throw error;
  }

  return paymentRepository.findCompanyPaymentById(payment.id, companyId);
}

module.exports = {
  serializePaymentReceipt,
  serializePayment,
  serializePaymentList,
  validatePaymentReceiptPayload,
  createPaymentReceiptEvidence,
  replacePaymentReceiptEvidence,
};
