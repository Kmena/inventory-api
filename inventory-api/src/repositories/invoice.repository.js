const prisma = require('../lib/prisma');

function findCompanyInvoices(companyId) {
  return prisma.invoice.findMany({
    where: {
      client: { companyId },
    },
    orderBy: { id: 'asc' },
    include: { client: true, order: true, payments: true },
  });
}

function findCompanyInvoiceById(id, companyId) {
  return prisma.invoice.findFirst({
    where: {
      id,
      client: { companyId },
    },
    include: { client: true, order: true, payments: true },
  });
}

function findInvoicesForDebtReview(companyId) {
  return prisma.invoice.findMany({
    where: {
      client: { companyId },
    },
    orderBy: [{ issuedAt: 'desc' }, { id: 'desc' }],
    include: {
      client: true,
      order: {
        include: {
          clientStore: true,
        },
      },
      payments: true,
    },
  });
}

function createInvoice(data) {
  return prisma.invoice.create({
    data,
    include: { client: true, order: true, payments: true },
  });
}

async function updateCompanyInvoice(id, companyId, data) {
  const result = await prisma.invoice.updateMany({
    where: {
      id,
      client: { companyId },
    },
    data,
  });

  if (result.count === 0) {
    return null;
  }

  return prisma.invoice.findFirst({
    where: {
      id,
      client: { companyId },
    },
    include: { client: true, order: true, payments: true },
  });
}

function deleteCompanyInvoice(id, companyId) {
  return prisma.invoice.deleteMany({
    where: {
      id,
      client: { companyId },
    },
  });
}

module.exports = {
  findCompanyInvoices,
  findCompanyInvoiceById,
  findInvoicesForDebtReview,
  createInvoice,
  updateCompanyInvoice,
  deleteCompanyInvoice,
};
