const paymentRepository = require('../repositories/payment.repository');
const invoiceRepository = require('../repositories/invoice.repository');
const { createHttpError } = require('../lib/errors');

function assertCompanyScope(auth) {
  if (!auth?.companyId) {
    throw createHttpError(403, 'Se requiere una empresa activa para revisar pagos', 'forbidden');
  }
  return BigInt(auth.companyId);
}

async function listPayments(auth) {
  const companyId = assertCompanyScope(auth);
  return paymentRepository.findCompanyPayments(companyId);
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

async function createPayment(payload, auth) {
  const companyId = assertCompanyScope(auth);
  await validatePaymentInvoice(payload.invoiceId, companyId);
  return paymentRepository.createPayment(payload);
}

async function updatePayment(id, payload, auth) {
  const companyId = assertCompanyScope(auth);
  const existingPayment = await getPayment(id, auth);
  const invoiceId = payload.invoiceId ?? existingPayment.invoiceId;

  await validatePaymentInvoice(invoiceId, companyId);
  return paymentRepository.updateCompanyPayment(id, companyId, payload);
}

async function removePayment(id, auth) {
  const companyId = assertCompanyScope(auth);
  await getPayment(id, auth);
  return paymentRepository.deleteCompanyPayment(id, companyId);
}

module.exports = { listPayments, getPayment, createPayment, updatePayment, removePayment };
