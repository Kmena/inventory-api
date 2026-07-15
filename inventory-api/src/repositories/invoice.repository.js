const prisma = require('../lib/prisma');

/** @typedef {import('@prisma/client').Prisma.InvoiceOrderByWithRelationInput} InvoiceOrderByWithRelationInput */

function findCompanyInvoices(companyId, pagination = null) {
  const where = {
    client: { companyId },
  };
  const orderBy = /** @type {InvoiceOrderByWithRelationInput} */ ({ id: 'asc' });
  const include = { client: true, order: true, payments: true };

  if (!pagination) {
    return prisma.invoice.findMany({
      where,
      orderBy,
      include,
    });
  }

  return prisma.$transaction([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      orderBy,
      skip: pagination.skip,
      take: pagination.take,
      include,
    }),
  ]).then(([totalItems, items]) => ({ totalItems, items }));
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

function cancelCompanyInvoice(id, companyId) {
  return prisma.invoice.updateMany({
    where: {
      id,
      status: { not: 'CANCELLED' },
      client: { companyId },
    },
    data: {
      status: 'CANCELLED',
    },
  });
}

module.exports = {
  findCompanyInvoices,
  findCompanyInvoiceById,
  findInvoicesForDebtReview,
  createInvoice,
  updateCompanyInvoice,
  cancelCompanyInvoice,
};
