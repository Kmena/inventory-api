const invoiceRepository = require('../repositories/invoice.repository');
const { createHttpError } = require('../lib/errors');

function normalizeInvoicePayload(payload) {
  return {
    ...payload,
    dueAt: payload.dueAt ? new Date(payload.dueAt) : payload.dueAt,
    paidAt: payload.paidAt ? new Date(payload.paidAt) : payload.paidAt,
  };
}

async function listInvoices() {
  return invoiceRepository.findAllInvoices();
}

async function getInvoice(id) {
  const invoice = await invoiceRepository.findInvoiceById(id);
  if (!invoice) throw createHttpError(404, 'Factura no encontrada', 'not_found');
  return invoice;
}

async function createInvoice(payload) {
  return invoiceRepository.createInvoice(normalizeInvoicePayload(payload));
}

async function updateInvoice(id, payload) {
  await getInvoice(id);
  return invoiceRepository.updateInvoice(id, normalizeInvoicePayload(payload));
}

async function removeInvoice(id) {
  await getInvoice(id);
  return invoiceRepository.deleteInvoice(id);
}

module.exports = { listInvoices, getInvoice, createInvoice, updateInvoice, removeInvoice };
