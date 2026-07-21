const prisma = require('../lib/prisma');

/** @typedef {import('@prisma/client').Prisma.InvoiceOrderByWithRelationInput} InvoiceOrderByWithRelationInput */

function transaction(work) {
  return prisma.$transaction(work);
}

function findCompanyInvoices(companyId, pagination = null, db = prisma) {
  const where = {
    client: { companyId },
  };
  const orderBy = /** @type {InvoiceOrderByWithRelationInput} */ ({ id: 'asc' });
  const include = { client: true, order: true, payments: true };

  if (!pagination) {
    return db.invoice.findMany({
      where,
      orderBy,
      include,
    });
  }

  return db.$transaction([
    db.invoice.count({ where }),
    db.invoice.findMany({
      where,
      orderBy,
      skip: pagination.skip,
      take: pagination.take,
      include,
    }),
  ]).then(([totalItems, items]) => ({ totalItems, items }));
}

function findCompanyInvoiceById(id, companyId, db = prisma) {
  return db.invoice.findFirst({
    where: {
      id,
      client: { companyId },
    },
    include: { client: true, order: true, payments: true },
  });
}

function findInvoicesForDebtReview(companyId, db = prisma) {
  return db.invoice.findMany({
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

function createInvoice(data, db = prisma) {
  return db.invoice.create({
    data,
    include: { client: true, order: true, payments: true },
  });
}

async function updateCompanyInvoice(id, companyId, data, db = prisma) {
  const result = await db.invoice.updateMany({
    where: {
      id,
      client: { companyId },
    },
    data,
  });

  if (result.count === 0) {
    return null;
  }

  return db.invoice.findFirst({
    where: {
      id,
      client: { companyId },
    },
    include: { client: true, order: true, payments: true },
  });
}

function cancelCompanyInvoice(id, companyId, db = prisma) {
  return db.invoice.updateMany({
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

function findCompanyInvoiceForFinancialSync(id, companyId, db = prisma) {
  return db.invoice.findFirst({
    where: {
      id,
      client: { companyId },
    },
    include: {
      client: true,
      order: true,
      payments: {
        orderBy: [{ approvedAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      },
    },
  });
}

async function updateCompanyInvoiceFinancialState(id, companyId, data, db = prisma) {
  const result = await db.invoice.updateMany({
    where: {
      id,
      client: { companyId },
    },
    data: {
      status: data.status,
      paidAt: data.paidAt,
    },
  });

  if (result.count === 0) {
    return null;
  }

  return findCompanyInvoiceForFinancialSync(id, companyId, db);
}

module.exports = {
  transaction,
  findCompanyInvoices,
  findCompanyInvoiceById,
  findInvoicesForDebtReview,
  findCompanyInvoiceForFinancialSync,
  createInvoice,
  updateCompanyInvoice,
  updateCompanyInvoiceFinancialState,
  cancelCompanyInvoice,
};
