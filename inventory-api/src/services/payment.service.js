const paymentRepository = require('../repositories/payment.repository');
const invoiceRepository = require('../repositories/invoice.repository');
const { createHttpError } = require('../lib/errors');
const { buildPaginatedResponse } = require('../lib/pagination');
const audit = require('../lib/audit');

function assertCompanyScope(auth) {
  if (!auth?.companyId) {
    throw createHttpError(403, 'Se requiere una empresa activa para revisar pagos', 'forbidden');
  }
  return BigInt(auth.companyId);
}

async function listPayments(auth, pagination = null) {
  const companyId = assertCompanyScope(auth);
  const payments = await paymentRepository.findCompanyPayments(companyId, pagination);
  if (!pagination) {
    return payments;
  }
  const paginatedPayments = /** @type {{ items: Array<any>, totalItems: number }} */ (payments);
  return buildPaginatedResponse(paginatedPayments.items, pagination, paginatedPayments.totalItems);
}

async function getPayment(id, auth) {
  const companyId = assertCompanyScope(auth);
  const payment = await paymentRepository.findCompanyPaymentById(id, companyId);
  if (!payment) throw createHttpError(404, 'Pago no encontrado', 'not_found');
  return payment;
}

async function validatePaymentInvoice(invoiceId, companyId) {
  const invoice = await invoiceRepository.findCompanyInvoiceById(invoiceId, companyId);
  if (!invoice) {
    throw createHttpError(400, 'La factura no pertenece a la empresa autenticada', 'validation_error');
  }
  return invoice;
}

async function createPayment(payload, auth, req = null) {
  const companyId = assertCompanyScope(auth);
  await validatePaymentInvoice(payload.invoiceId, companyId);
  const payment = await paymentRepository.createPayment(payload);
  await audit.recordAuditEventIfAvailable({
    req,
    action: 'payments.create',
    resourceType: 'payment',
    resourceId: payment.id,
    outcome: 'SUCCESS',
    afterState: {
      id: payment.id,
      invoiceId: payment.invoiceId,
      amount: payment.amount,
      status: payment.status || 'ACTIVE',
    },
  });
  return payment;
}

async function updatePayment(id, payload, auth, req = null) {
  const companyId = assertCompanyScope(auth);
  const existingPayment = await getPayment(id, auth);
  const invoiceId = payload.invoiceId ?? existingPayment.invoiceId;

  await validatePaymentInvoice(invoiceId, companyId);
  const updatedPayment = await paymentRepository.updateCompanyPayment(id, companyId, payload);
  await audit.recordAuditEventIfAvailable({
    req,
    action: 'payments.update',
    resourceType: 'payment',
    resourceId: id,
    outcome: 'SUCCESS',
    beforeState: {
      id: existingPayment.id,
      invoiceId: existingPayment.invoiceId,
      amount: existingPayment.amount,
      status: existingPayment.status || 'ACTIVE',
    },
    afterState: updatedPayment
      ? {
          id: updatedPayment.id,
          invoiceId: updatedPayment.invoiceId,
          amount: updatedPayment.amount,
          status: updatedPayment.status || 'ACTIVE',
        }
      : null,
  });
  return updatedPayment;
}

async function removePayment(id, auth, req = null) {
  const companyId = assertCompanyScope(auth);
  const existingPayment = await getPayment(id, auth);

  if (existingPayment.status === 'REVERSED') {
    throw createHttpError(409, 'El pago ya fue reversado', 'conflict');
  }

  const reversedAt = new Date();
  const reversedByUserId = auth?.sub ? BigInt(auth.sub) : null;
  const result = await paymentRepository.reverseCompanyPayment(id, companyId, {
    reversedAt,
    reversedByUserId,
    reversalReason: 'DELETE_COMPATIBILITY_FLOW',
  });

  if (!result || result.count === 0) {
    throw createHttpError(404, 'Pago no encontrado', 'not_found');
  }

  await audit.recordAuditEventIfAvailable({
    req,
    action: 'payments.reverse',
    resourceType: 'payment',
    resourceId: id,
    outcome: 'SUCCESS',
    beforeState: {
      id: existingPayment.id,
      invoiceId: existingPayment.invoiceId,
      amount: existingPayment.amount,
      status: existingPayment.status || 'ACTIVE',
    },
    afterState: {
      id,
      status: 'REVERSED',
      reversedAt,
      reversedByUserId,
      reversalReason: 'DELETE_COMPATIBILITY_FLOW',
    },
  });

  return result;
}

module.exports = { listPayments, getPayment, createPayment, updatePayment, removePayment };
