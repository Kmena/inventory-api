const invoiceRepository = require('../repositories/invoice.repository');
const clientRepository = require('../repositories/client.repository');
const orderRepository = require('../repositories/order.repository');
const { createHttpError } = require('../lib/errors');

function normalizeInvoicePayload(payload) {
  return {
    ...payload,
    dueAt: payload.dueAt ? new Date(payload.dueAt) : payload.dueAt,
    paidAt: payload.paidAt ? new Date(payload.paidAt) : payload.paidAt,
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

function getAppliedAmount(invoice) {
  return Number((invoice.payments || []).reduce((total, payment) => total + Number(payment.amount || 0), 0).toFixed(2));
}

function getPendingAmount(invoice, appliedAmount = getAppliedAmount(invoice)) {
  return Number(Math.max(0, Number(invoice.amount || 0) - appliedAmount).toFixed(2));
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

  const pendingAmount = getPendingAmount(invoice);
  if (pendingAmount <= 0) {
    return null;
  }

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

async function listInvoices(auth) {
  const companyId = assertCompanyScope(auth);
  return invoiceRepository.findCompanyInvoices(companyId);
}

async function getInvoice(id, auth) {
  const companyId = assertCompanyScope(auth);
  const invoice = await invoiceRepository.findCompanyInvoiceById(id, companyId);
  if (!invoice) throw createHttpError(404, 'Factura no encontrada', 'not_found');
  return invoice;
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

async function createInvoice(payload, auth) {
  const companyId = assertCompanyScope(auth);
  await validateInvoiceReferences(payload, companyId);
  return invoiceRepository.createInvoice(normalizeInvoicePayload(payload));
}

async function updateInvoice(id, payload, auth) {
  const companyId = assertCompanyScope(auth);
  const existingInvoice = await getInvoice(id, auth);
  const nextPayload = {
    clientId: payload.clientId ?? existingInvoice.clientId,
    orderId: payload.orderId === undefined ? existingInvoice.orderId : payload.orderId,
  };

  await validateInvoiceReferences(nextPayload, companyId);
  return invoiceRepository.updateCompanyInvoice(id, companyId, normalizeInvoicePayload(payload));
}

async function removeInvoice(id, auth) {
  const companyId = assertCompanyScope(auth);
  await getInvoice(id, auth);
  return invoiceRepository.deleteCompanyInvoice(id, companyId);
}

module.exports = {
  listInvoices,
  getInvoice,
  listInvoiceDebtInconsistencies,
  createInvoice,
  updateInvoice,
  removeInvoice,
};
