const path = require('node:path');

const CLIENT_DOCUMENT_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const CLIENT_DOCUMENT_ALLOWED_MIME_TYPES = /** @type {const} */ ([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const CLIENT_DOCUMENT_EXTENSION_MIME_MAP = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const PAYMENT_RECEIPT_MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const PAYMENT_RECEIPT_ALLOWED_MIME_TYPES = /** @type {const} */ ([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
]);
const PAYMENT_RECEIPT_EXTENSION_MIME_MAP = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv': 'text/csv',
};

class GovernedFileValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GovernedFileValidationError';
  }
}

function assertValidBase64Content(base64Content) {
  const normalizedContent = String(base64Content || '').trim();
  if (!normalizedContent) {
    throw new GovernedFileValidationError('El archivo adjunto no puede estar vacio');
  }

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalizedContent) || (normalizedContent.length % 4) !== 0) {
    throw new GovernedFileValidationError('El archivo adjunto debe estar en base64 valido');
  }

  const buffer = Buffer.from(normalizedContent, 'base64');
  if (!buffer.length) {
    throw new GovernedFileValidationError('El archivo adjunto no puede estar vacio');
  }

  const normalizedWithoutPadding = normalizedContent.replace(/=+$/u, '');
  const roundTripWithoutPadding = buffer.toString('base64').replace(/=+$/u, '');
  if (normalizedWithoutPadding !== roundTripWithoutPadding) {
    throw new GovernedFileValidationError('El archivo adjunto debe estar en base64 valido');
  }

  return buffer;
}

function validateGovernedBase64FilePayload({
  fileName,
  mimeType,
  fileContentBase64,
  maxFileSizeBytes,
  allowedMimeTypes,
  extensionMimeMap,
  allowMimeTypeInference = false,
  invalidMimeTypeMessage = 'El archivo adjunto no tiene un tipo permitido',
  mimeExtensionMismatchMessage = 'El tipo MIME declarado no coincide con la extension del archivo',
  maxFileSizeMessage,
}) {
  const normalizedFileName = String(fileName || '').trim();
  const normalizedMimeType = String(mimeType || '').trim().toLowerCase();
  const fileExtension = path.extname(normalizedFileName).toLowerCase();
  const extensionMimeType = extensionMimeMap[fileExtension] || null;

  if (normalizedMimeType && extensionMimeType && normalizedMimeType !== extensionMimeType) {
    throw new GovernedFileValidationError(mimeExtensionMismatchMessage);
  }

  const resolvedMimeType = normalizedMimeType || (allowMimeTypeInference ? extensionMimeType : null);
  if (!resolvedMimeType || !allowedMimeTypes.includes(resolvedMimeType)) {
    throw new GovernedFileValidationError(invalidMimeTypeMessage);
  }

  const buffer = assertValidBase64Content(fileContentBase64);
  if (buffer.length > maxFileSizeBytes) {
    throw new GovernedFileValidationError(maxFileSizeMessage || 'El archivo adjunto supera el tamano maximo permitido');
  }

  return {
    buffer,
    mimeType: resolvedMimeType,
  };
}

module.exports = {
  CLIENT_DOCUMENT_MAX_FILE_SIZE_BYTES,
  CLIENT_DOCUMENT_ALLOWED_MIME_TYPES,
  CLIENT_DOCUMENT_EXTENSION_MIME_MAP,
  PAYMENT_RECEIPT_MAX_FILE_SIZE_BYTES,
  PAYMENT_RECEIPT_ALLOWED_MIME_TYPES,
  PAYMENT_RECEIPT_EXTENSION_MIME_MAP,
  GovernedFileValidationError,
  validateGovernedBase64FilePayload,
};
