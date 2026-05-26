const paymentRepository = require('../repositories/payment.repository');
const { createHttpError } = require('../lib/errors');

async function listPayments() {
  return paymentRepository.findAllPayments();
}

async function getPayment(id) {
  const payment = await paymentRepository.findPaymentById(id);
  if (!payment) throw createHttpError(404, 'Pago no encontrado', 'not_found');
  return payment;
}

async function createPayment(payload) {
  return paymentRepository.createPayment(payload);
}

async function updatePayment(id, payload) {
  await getPayment(id);
  return paymentRepository.updatePayment(id, payload);
}

async function removePayment(id) {
  await getPayment(id);
  return paymentRepository.deletePayment(id);
}

module.exports = { listPayments, getPayment, createPayment, updatePayment, removePayment };
