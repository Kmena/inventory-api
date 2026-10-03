const { z } = require('zod');
const {
  PAYMENT_RECEIPT_MAX_FILE_SIZE_BYTES: MAX_PAYMENT_RECEIPT_FILE_SIZE_BYTES,
  PAYMENT_RECEIPT_ALLOWED_MIME_TYPES: PAYMENT_RECEIPT_MIME_TYPES,
  PAYMENT_RECEIPT_EXTENSION_MIME_MAP,
  GovernedFileValidationError,
  validateGovernedBase64FilePayload,
} = require('../lib/sensitive-file-governance');

const paymentReceiptFileSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.enum(PAYMENT_RECEIPT_MIME_TYPES),
  fileContentBase64: z.string().min(1),
  note: z.string().max(500).optional().nullable(),
}).superRefine((value, ctx) => {
  try {
    validateGovernedBase64FilePayload({
      fileName: value.fileName,
      mimeType: value.mimeType,
      fileContentBase64: value.fileContentBase64,
      maxFileSizeBytes: MAX_PAYMENT_RECEIPT_FILE_SIZE_BYTES,
      allowedMimeTypes: PAYMENT_RECEIPT_MIME_TYPES,
      extensionMimeMap: PAYMENT_RECEIPT_EXTENSION_MIME_MAP,
      allowMimeTypeInference: false,
      invalidMimeTypeMessage: 'El comprobante adjunto debe ser PDF, imagen PNG/JPEG, CSV o Excel compatible',
      mimeExtensionMismatchMessage: 'El tipo MIME del comprobante no coincide con la extension del archivo',
      maxFileSizeMessage: 'El archivo adjunto supera el tamano maximo de 20 MB',
    });
  } catch (error) {
    if (!(error instanceof GovernedFileValidationError)) {
      throw error;
    }

    const normalizedMessage = String(error.message || '').toLowerCase();
    const path = normalizedMessage.includes('mime') || normalizedMessage.includes('extension')
      ? ['mimeType']
      : ['fileContentBase64'];

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path,
      message: error.message,
    });
  }
});

// Card network types accepted on payment registration
const CARD_TYPES = /** @type {const} */ (['VISA', 'MASTERCARD', 'AMEX', 'DINERS', 'OTHER']);

// Base object — used for update (partial) and as foundation for create refinement
const paymentBaseSchema = z.object({
  invoiceId: z.coerce.bigint(),
  amount: z.number().positive(),
  paymentMethod: z.enum(['CASH', 'CREDIT', 'TRANSFER', 'CARD']),
  // reference is required only for TRANSFER — enforced by superRefine in createPaymentSchema
  reference: z.string().trim().min(1).max(255).optional().nullable(),
  // TRANSFER: originating bank (free text, optional)
  bankName: z.string().trim().min(1).max(100).optional().nullable(),
  // CARD: card network
  cardType: z.enum(/** @type {[string, ...string[]]} */ ([...CARD_TYPES])).optional().nullable(),
  receiptFile: paymentReceiptFileSchema.optional(),
});

// Create adds the cross-field rule: TRANSFER requires reference
const createPaymentSchema = paymentBaseSchema.superRefine((data, ctx) => {
  if (data.paymentMethod === 'TRANSFER' && !data.reference?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['reference'],
      message: 'La referencia es requerida para transferencias',
    });
  }
});

const updatePaymentSchema = paymentBaseSchema.partial();

const approvePaymentSchema = z.object({
  note: z.string().max(500).optional(),
});

const markPaymentUnderReviewSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

const rejectPaymentSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

const reversePaymentSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

module.exports = {
  MAX_PAYMENT_RECEIPT_FILE_SIZE_BYTES,
  PAYMENT_RECEIPT_MIME_TYPES,
  CARD_TYPES,
  createPaymentSchema,
  updatePaymentSchema,
  approvePaymentSchema,
  markPaymentUnderReviewSchema,
  rejectPaymentSchema,
  reversePaymentSchema,
};
