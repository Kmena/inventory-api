const invoiceRepository = require('../repositories/invoice.repository');
const clientRepository = require('../repositories/client.repository');
const orderRepository = require('../repositories/order.repository');
const { createHttpError } = require('../lib/errors');
const { buildPaginatedResponse } = require('../lib/pagination');
const audit = require('../lib/audit');
const { getPendingAmount, getPendingAmountDecimal } = require('./invoice-financial-state');

// ─── Fiscal DTO — browser-safe serialization layer ───────────────────────────
// These functions construct EXPLICIT plain objects containing only approved
// fields. They MUST NOT spread the raw InvoiceFiscalIntent Prisma record.
// Any new field added to the Prisma model will NOT appear in responses unless
// explicitly added here. See specs/inventori-fiscal-invoice-history-and-detail/

/**
 * Extracts and validates `acceptedAt` from the fiscal intent metadata blob.
 * Returns a normalized ISO timestamp string, or null if absent/invalid.
 * ONLY called when intent.status === 'ACCEPTED' (enforced by buildFiscalDtoDetail).
 * @param {any} intent
 * @returns {string | null}
 */
function resolveAcceptedAt(intent) {
  const raw = intent?.metadata?.billingAcceptedAt;
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

/**
 * Builds the browser-safe fiscal sub-object for LIST responses.
 * Contains only `status`. Returns null when no intent exists.
 * Fields excluded by construction — intent is never spread.
 * @param {any | null} intent
 * @returns {{ status: string } | null}
 */
function buildFiscalDto(intent) {
  if (!intent) return null;
  return {
    status: intent.status,
  };
}

/**
 * Builds the browser-safe fiscal sub-object for DETAIL responses.
 * Contains status, clave, consecutive, acceptedAt.
 * `acceptedAt` is ONLY populated when status === 'ACCEPTED'; null for all others.
 * Fields excluded by construction — intent is never spread.
 * @param {any | null} intent
 * @returns {{ status: string, clave: string | null, consecutive: string | null, acceptedAt: string | null } | null}
 */
function buildFiscalDtoDetail(intent) {
  if (!intent) return null;
  return {
    status: intent.status,
    clave: intent.clave || null,
    consecutive: intent.consecutive || null,
    acceptedAt: intent.status === 'ACCEPTED' ? resolveAcceptedAt(intent) : null,
  };
}

/**
 * Serializes a payment record for inclusion in invoice DTOs.
 * Explicit field list — never spreads the Prisma payment object.
 * @param {any} payment
 * @returns {object}
 */
function serializePaymentForDto(payment) {
  return {
    id: payment.id,
    paymentMethod: payment.paymentMethod ?? null,
    amount: payment.amount ?? null,
    status: payment.status ?? null,
    reference: payment.reference ?? null,
    approvedAt: payment.approvedAt ?? null,
    createdAt: payment.createdAt ?? null,
  };
}

/**
 * Serializes a raw Invoice Prisma record to the browser-safe LIST DTO.
 * Adds `invoiceNumber` (from invoice.number) and a minimal `fiscal` sub-object.
 * All InvoiceFiscalIntent internal fields are excluded by construction.
 * @param {any} invoice
 * @returns {object}
 */
function serializeInvoiceForList(invoice) {
  return {
    id: invoice.id,
    invoiceNumber: invoice.number ?? null,
    clientId: invoice.clientId ?? null,
    clientName: invoice.client?.name ?? null,
    client: invoice.client ? { id: invoice.client.id, name: invoice.client.name } : null,
    orderId: invoice.orderId ?? null,
    amount: invoice.amount ?? null,
    pendingAmount: getPendingAmount(invoice),
    status: invoice.status ?? null,
    issuedAt: invoice.issuedAt ?? null,
    dueAt: invoice.dueAt ?? null,
    payments: (invoice.payments || []).map(serializePaymentForDto),
    fiscal: buildFiscalDto(invoice.fiscalIntent ?? null),
  };
}

/**
 * Serializes a raw Invoice Prisma record to the browser-safe DETAIL DTO.
 * Extends the list shape with paidAt, structured order, and full fiscal detail.
 * @param {any} invoice
 * @returns {object}
 */
function serializeInvoiceForDetail(invoice) {
  const base = serializeInvoiceForList(invoice);
  return {
    ...base,
    paidAt: invoice.paidAt ?? null,
    order: invoice.order
      ? {
          id: invoice.order.id,
          clientStoreId: invoice.order.clientStoreId ?? null,
          clientStoreName: invoice.order.clientStore?.name ?? null,
        }
      : null,
    fiscal: buildFiscalDtoDetail(invoice.fiscalIntent ?? null),
  };
}

// ─── End fiscal DTO ───────────────────────────────────────────────────────────

function normalizeInvoicePayload(payload) {
  const { status: _ignoredStatus, paidAt: _ignoredPaidAt, ...safePayload } = payload;
  return {
    ...safePayload,
    dueAt: safePayload.dueAt ? new Date(safePayload.dueAt) : safePayload.dueAt,
  };
}

function isSameId(left, right) {
  return left !== null && left !== undefined && right !== null && right !== undefined && left.toString() === right.toString();
}

function assertCompanyScope(auth) {
  if (!auth?.companyId) {
    throw createHttpError(403, 'Se requiere una empresa activa para revisar facturas', 'forbidden');
  }
  return BigInt(auth.companyId);
}


function hasAssignmentInconsistency(invoice) {
  const order = invoice.order;
  const store = order?.clientStore;

  if (!order || !order.clientStoreId || !store) {
    return true;
  }

  if (!isSameId(invoice.clientId, order.clientId)) {
    return true;
  }

  if (store.clientId !== null && store.clientId !== undefined && !isSameId(store.clientId, invoice.clientId)) {
    return true;
  }

  return false;
}

function serializeInconsistency(invoice) {
  if (invoice.status === 'CANCELLED') {
    return null;
  }

  const pendingAmountDecimal = getPendingAmountDecimal(invoice);
  if (pendingAmountDecimal.lte(0)) {
     return null;
   }

   const pendingAmount = getPendingAmount(invoice);
  const inconsistencyTypes = [];
  if (hasAssignmentInconsistency(invoice)) {
    inconsistencyTypes.push('ASIGNACION_TIENDA');
  }

  if (!inconsistencyTypes.length) {
    return null;
  }

  return {
    id: invoice.id,
    number: invoice.number,
    amount: Number(invoice.amount || 0),
    pendingAmount,
    status: invoice.status,
    issuedAt: invoice.issuedAt,
    dueAt: invoice.dueAt,
    client: invoice.client
      ? {
          id: invoice.client.id,
          code: invoice.client.code,
          name: invoice.client.name,
        }
      : null,
    order: invoice.order
      ? {
          id: invoice.order.id,
          clientStoreId: invoice.order.clientStoreId,
          clientStoreName: invoice.order.clientStore?.name || null,
        }
      : null,
    inconsistencyTypes,
  };
}

async function listInvoices(auth, pagination = null, filters = {}) {
  const companyId = assertCompanyScope(auth);
  const invoices = await invoiceRepository.findCompanyInvoices(companyId, pagination, filters);
  if (!pagination) {
    return /** @type {any[]} */ (invoices).map(serializeInvoiceForList);
  }
  const paginatedInvoices = /** @type {{ items: Array<any>, totalItems: number }} */ (invoices);
  const serializedItems = paginatedInvoices.items.map(serializeInvoiceForList);
  return buildPaginatedResponse(serializedItems, pagination, paginatedInvoices.totalItems);
}

async function getInvoice(id, auth) {
  const companyId = assertCompanyScope(auth);
  const invoice = await invoiceRepository.findCompanyInvoiceById(id, companyId);
  if (!invoice) throw createHttpError(404, 'Factura no encontrada', 'not_found');
  return serializeInvoiceForDetail(invoice);
}

async function listInvoiceDebtInconsistencies(auth) {
  const companyId = assertCompanyScope(auth);
  const invoices = await invoiceRepository.findInvoicesForDebtReview(companyId);
  const rows = invoices.map(serializeInconsistency).filter(Boolean);

  return {
    summary: {
      total: rows.length,
      assignmentInconsistencies: rows.filter((row) => row.inconsistencyTypes.includes('ASIGNACION_TIENDA')).length,
    },
    invoices: rows,
  };
}

async function validateInvoiceReferences(payload, companyId) {
  if (payload.clientId !== undefined && payload.clientId !== null) {
    const client = await clientRepository.findCompanyClientById(payload.clientId, companyId);
    if (!client) {
      throw createHttpError(400, 'El cliente no pertenece a la empresa autenticada', 'validation_error');
    }
  }

  if (payload.orderId !== undefined && payload.orderId !== null) {
    const order = await orderRepository.findOrderById(payload.orderId, companyId);
    if (!order) {
      throw createHttpError(400, 'El pedido no pertenece a la empresa autenticada', 'validation_error');
    }
  }
}

async function createInvoice(payload, auth, req = null) {
  const companyId = assertCompanyScope(auth);
  await validateInvoiceReferences(payload, companyId);
  const invoice = await invoiceRepository.createInvoice(normalizeInvoicePayload(payload));
  await audit.recordAuditEventIfAvailable({
    req,
    action: 'invoices.create',
    resourceType: 'invoice',
    resourceId: invoice.id,
    outcome: 'SUCCESS',
    afterState: {
      id: invoice.id,
      clientId: invoice.clientId,
      orderId: invoice.orderId,
      amount: invoice.amount,
      status: invoice.status,
    },
  });
  return invoice;
}

async function updateInvoice(id, payload, auth, req = null) {
  const companyId = assertCompanyScope(auth);
  const existingInvoice = await getInvoice(id, auth);
  const nextPayload = {
    clientId: payload.clientId ?? existingInvoice.clientId,
    orderId: payload.orderId === undefined ? existingInvoice.orderId : payload.orderId,
  };

  await validateInvoiceReferences(nextPayload, companyId);
  const updatedInvoice = await invoiceRepository.updateCompanyInvoice(id, companyId, normalizeInvoicePayload(payload));
  await audit.recordAuditEventIfAvailable({
    req,
    action: 'invoices.update',
    resourceType: 'invoice',
    resourceId: id,
    outcome: 'SUCCESS',
    beforeState: {
      id: existingInvoice.id,
      clientId: existingInvoice.clientId,
      orderId: existingInvoice.orderId,
      amount: existingInvoice.amount,
      status: existingInvoice.status,
    },
    afterState: updatedInvoice
      ? {
          id: updatedInvoice.id,
          clientId: updatedInvoice.clientId,
          orderId: updatedInvoice.orderId,
          amount: updatedInvoice.amount,
          status: updatedInvoice.status,
        }
      : null,
  });
  return updatedInvoice;
}

async function removeInvoice(id, auth, req = null) {
  const companyId = assertCompanyScope(auth);
  const invoice = await getInvoice(id, auth);

  if (invoice.status === 'CANCELLED') {
    throw createHttpError(409, 'La factura ya fue cancelada', 'conflict');
  }

  const result = await invoiceRepository.cancelCompanyInvoice(id, companyId);
  if (!result || result.count === 0) {
    throw createHttpError(404, 'Factura no encontrada', 'not_found');
  }

  await audit.recordAuditEventIfAvailable({
    req,
    action: 'invoices.cancel',
    resourceType: 'invoice',
    resourceId: id,
    outcome: 'SUCCESS',
    beforeState: {
      id: invoice.id,
      clientId: invoice.clientId,
      orderId: invoice.orderId,
      amount: invoice.amount,
      status: invoice.status,
    },
    afterState: {
      id,
      status: 'CANCELLED',
    },
  });

  return result;
}

module.exports = {
  // Public service API
  listInvoices,
  getInvoice,
  listInvoiceDebtInconsistencies,
  createInvoice,
  updateInvoice,
  removeInvoice,
  // Exported for unit testing (Wave 1 fiscal DTO)
  buildFiscalDto,
  buildFiscalDtoDetail,
  serializeInvoiceForList,
  serializeInvoiceForDetail,
};
