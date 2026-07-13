const prisma = require('../lib/prisma');

function findCompanyPayments(companyId) {
  return prisma.payment.findMany({
    where: {
      invoice: {
        client: { companyId },
      },
    },
    orderBy: { id: 'asc' },
    include: { invoice: true },
  });
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

function deleteCompanyPayment(id, companyId) {
  return prisma.payment.deleteMany({
    where: {
      id,
      invoice: {
        client: { companyId },
      },
    },
  });
}

module.exports = { findCompanyPayments, findCompanyPaymentById, createPayment, updateCompanyPayment, deleteCompanyPayment };
