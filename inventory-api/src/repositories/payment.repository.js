const prisma = require('../lib/prisma');

/** @typedef {import('@prisma/client').Prisma.PaymentOrderByWithRelationInput} PaymentOrderByWithRelationInput */

function findCompanyPayments(companyId, pagination = null) {
  const where = {
    invoice: {
      client: { companyId },
    },
  };
  const orderBy = /** @type {PaymentOrderByWithRelationInput} */ ({ id: 'asc' });
  const include = { invoice: true };

  if (!pagination) {
    return prisma.payment.findMany({
      where,
      orderBy,
      include,
    });
  }

  return prisma.$transaction([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      orderBy,
      skip: pagination.skip,
      take: pagination.take,
      include,
    }),
  ]).then(([totalItems, items]) => ({ totalItems, items }));
}

function findCompanyPaymentById(id, companyId) {
  return prisma.payment.findFirst({
    where: {
      id,
      invoice: {
        client: { companyId },
      },
    },
    include: { invoice: true },
  });
}

function createPayment(data) {
  return prisma.payment.create({
    data,
    include: { invoice: true },
  });
}

async function updateCompanyPayment(id, companyId, data) {
  const result = await prisma.payment.updateMany({
    where: {
      id,
      invoice: {
        client: { companyId },
      },
    },
    data,
  });

  if (result.count === 0) {
    return null;
  }

  return prisma.payment.findFirst({
    where: {
      id,
      invoice: {
        client: { companyId },
      },
    },
    include: { invoice: true },
  });
}

function reverseCompanyPayment(id, companyId, { reversedAt, reversedByUserId, reversalReason = null }) {
  return prisma.payment.updateMany({
    where: {
      id,
      status: 'ACTIVE',
      invoice: {
        client: { companyId },
      },
    },
    data: {
      status: 'REVERSED',
      reversedAt,
      reversedByUserId,
      reversalReason,
    },
  });
}

module.exports = { findCompanyPayments, findCompanyPaymentById, createPayment, updateCompanyPayment, reverseCompanyPayment };
