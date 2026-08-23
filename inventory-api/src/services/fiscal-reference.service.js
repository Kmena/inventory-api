/**
 * FiscalDocumentReference service.
 *
 * Inventory stores pending fiscal reference metadata pointing to a future
 * Billing/Hacienda handoff. This service does NOT call any external Billing
 * or Hacienda API (DEC-003: external API is pending/not implemented).
 *
 * The status defaults to PENDING, which is the correct representation of the
 * current state: the fiscal document has not yet been processed because the
 * external Billing API does not yet exist.
 */

const { createHttpError } = require('../lib/errors');
const fiscalReferenceRepository = require('../repositories/fiscal-reference.repository');

function assertCompanyScope(auth) {
  if (!auth?.companyId) {
    throw createHttpError(403, 'El usuario debe pertenecer a una empresa', 'forbidden');
  }

  return {
    companyId: BigInt(auth.companyId),
    actorUserId: auth.sub ? BigInt(auth.sub) : null,
  };
}

function normalizeOptionalText(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

/**
 * Create a fiscal document reference for a purchase receipt.
 * Status is always PENDING: the Billing/Hacienda API is not yet implemented.
 * Inventory records this reference only to preserve the handoff boundary.
 */
async function createFiscalReferenceForReceipt(receiptId, payload, auth) {
  const scope = assertCompanyScope(auth);

  const receipt = await fiscalReferenceRepository.findReceiptByIdForCompany(receiptId, scope.companyId);
  if (!receipt) {
    throw createHttpError(404, 'Documento de recepción no encontrado para la empresa autenticada', 'not_found');
  }
  if (receipt.status !== 'CONFIRMED') {
    throw createHttpError(409, 'Solo se puede registrar referencia fiscal en recepciones confirmadas', 'conflict');
  }

  const reference = await fiscalReferenceRepository.createFiscalDocumentReference({
    companyId: scope.companyId,
    purchaseReceiptId: receiptId,
    purchaseOrderId: null,
    createdByUserId: scope.actorUserId,
    documentType: payload.documentType,
    // Status always starts as PENDING — Billing/Hacienda API is not implemented yet (DEC-003).
    status: 'PENDING',
    externalReference: normalizeOptionalText(payload.externalReference),
    simplifiedRegime: payload.simplifiedRegime ?? false,
    metadata: payload.metadata ?? null,
    notes: normalizeOptionalText(payload.notes),
  });

  return reference;
}

/**
 * List all fiscal document references for a purchase receipt.
 */
async function listFiscalReferencesForReceipt(receiptId, auth) {
  const scope = assertCompanyScope(auth);

  const receipt = await fiscalReferenceRepository.findReceiptByIdForCompany(receiptId, scope.companyId);
  if (!receipt) {
    throw createHttpError(404, 'Documento de recepción no encontrado para la empresa autenticada', 'not_found');
  }

  return fiscalReferenceRepository.findFiscalReferencesByReceiptForCompany(receiptId, scope.companyId);
}

/**
 * List all fiscal document references for the authenticated company.
 * Returns references across all receipts, ordered by createdAt DESC.
 * Each entry includes the linked purchaseReceipt with supplier.
 */
async function listAllFiscalReferences(auth) {
  const scope = assertCompanyScope(auth);
  return fiscalReferenceRepository.listAllFiscalReferencesForCompany(scope.companyId);
}

module.exports = {
  createFiscalReferenceForReceipt,
  listFiscalReferencesForReceipt,
  listAllFiscalReferences,
};
