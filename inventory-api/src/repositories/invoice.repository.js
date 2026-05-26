const prisma = require('../lib/prisma');

function findAllInvoices() {
  return prisma.invoice.findMany({
    orderBy: { id: 'asc' },
    include: { client: true, order: true, payments: true },
  });
}

function findInvoiceById(id) {
  return prisma.invoice.findUnique({
    where: { id },
    include: { client: true, order: true, payments: true },
  });
}

function createInvoice(data) {
  return prisma.invoice.create({
    data,
    include: { client: true, order: true, payments: true },
  });
}

function updateInvoice(id, data) {
  return prisma.invoice.update({
    where: { id },
    data,
    include: { client: true, order: true, payments: true },
  });
}

function deleteInvoice(id) {
  return prisma.invoice.delete({ where: { id } });
}

module.exports = { findAllInvoices, findInvoiceById, createInvoice, updateInvoice, deleteInvoice };
