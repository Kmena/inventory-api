const prisma = require('../lib/prisma');

function findAllPayments() {
  return prisma.payment.findMany({
    orderBy: { id: 'asc' },
    include: { invoice: true },
  });
}

function findPaymentById(id) {
  return prisma.payment.findUnique({
    where: { id },
    include: { invoice: true },
  });
}

function createPayment(data) {
  return prisma.payment.create({
    data,
    include: { invoice: true },
  });
}

function updatePayment(id, data) {
  return prisma.payment.update({
    where: { id },
    data,
    include: { invoice: true },
  });
}

function deletePayment(id) {
  return prisma.payment.delete({ where: { id } });
}

module.exports = { findAllPayments, findPaymentById, createPayment, updatePayment, deletePayment };
