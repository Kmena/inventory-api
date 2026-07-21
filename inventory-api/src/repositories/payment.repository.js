const prisma = require('../lib/prisma');

/** @typedef {import('@prisma/client').Prisma.PaymentInclude} PaymentInclude */
/** @typedef {import('@prisma/client').Prisma.PaymentOrderByWithRelationInput} PaymentOrderByWithRelationInput */
/** @typedef {import('@prisma/client').Prisma.PaymentReceiptOrderByWithRelationInput} PaymentReceiptOrderByWithRelationInput */

function transaction(work) {
  return prisma.$transaction(work);
}

function buildReceiptsOrderBy() {
  return /** @type {PaymentReceiptOrderByWithRelationInput[]} */ ([{ uploadedAt: 'desc' }, { id: 'desc' }]);
}

function buildPaymentInclude() {
  return /** @type {PaymentInclude} */ ({
    invoice: {
      include: {
        client: true,
      },
    },
    receipts: {
      orderBy: buildReceiptsOrderBy(),
    },
  });
}

function buildCompanyPaymentWhere(companyId, options = {}) {
  return {
    invoice: {
      client: { companyId },
    },
    ...(options.submittedByUserId ? { submittedByUserId: options.submittedByUserId } : {}),
  };
}

function findCompanyPayments(companyId, pagination = null, options = {}, db = prisma) {
  const where = buildCompanyPaymentWhere(companyId, options);
  const orderBy = /** @type {PaymentOrderByWithRelationInput} */ ({ id: 'asc' });
  const include = buildPaymentInclude();

  if (!pagination) {
    return db.payment.findMany({
      where,
      orderBy,
      include,
    });
  }

  return db.$transaction([
    db.payment.count({ where }),
    db.payment.findMany({
      where,
      orderBy,
      skip: pagination.skip,
      take: pagination.take,
      include,
    }),
  ]).then(([totalItems, items]) => ({ totalItems, items }));
}

function findCompanyPaymentById(id, companyId, options = {}, db = prisma) {
  return db.payment.findFirst({
    where: {
      id,
      ...buildCompanyPaymentWhere(companyId, options),
    },
    include: buildPaymentInclude(),
  });
}

function createPayment(data, db = prisma) {
  return db.payment.create({
    data,
    include: buildPaymentInclude(),
  });
}

function deleteCompanyPayment(id, companyId, db = prisma) {
  return db.payment.deleteMany({
    where: {
      id,
      ...buildCompanyPaymentWhere(companyId),
    },
  });
}

async function updateCompanyPayment(id, companyId, data, db = prisma) {
  const result = await db.payment.updateMany({
    where: {
      id,
      ...buildCompanyPaymentWhere(companyId),
    },
    data,
  });

  if (result.count === 0) {
    return null;
  }

  return findCompanyPaymentById(id, companyId, {}, db);
}

async function markPaymentUnderReview(id, companyId, data, db = prisma) {
  const result = await db.payment.updateMany({
    where: {
      id,
      status: 'PENDING_APPROVAL',
      ...buildCompanyPaymentWhere(companyId),
    },
    data: {
      status: 'UNDER_REVIEW',
      underReviewAt: data.underReviewAt,
      underReviewByUserId: data.underReviewByUserId,
      reviewReason: data.reviewReason,
    },
  });

  if (result.count === 0) {
    return null;
  }

  return findCompanyPaymentById(id, companyId, {}, db);
}

async function approveCompanyPayment(id, companyId, data, db = prisma) {
  const result = await db.payment.updateMany({
    where: {
      id,
      status: { in: ['PENDING_APPROVAL', 'UNDER_REVIEW'] },
      ...buildCompanyPaymentWhere(companyId),
    },
    data: {
      status: 'APPROVED',
      approvedAt: data.approvedAt,
      approvedByUserId: data.approvedByUserId,
      reviewReason: data.reviewReason ?? null,
    },
  });

  if (result.count === 0) {
    return null;
  }

  return findCompanyPaymentById(id, companyId, {}, db);
}

async function rejectCompanyPayment(id, companyId, data, db = prisma) {
  const result = await db.payment.updateMany({
    where: {
      id,
      status: { in: ['PENDING_APPROVAL', 'UNDER_REVIEW'] },
      ...buildCompanyPaymentWhere(companyId),
    },
    data: {
      status: 'REJECTED',
      rejectedAt: data.rejectedAt,
      rejectedByUserId: data.rejectedByUserId,
      rejectionReason: data.rejectionReason,
    },
  });

  if (result.count === 0) {
    return null;
  }

  return findCompanyPaymentById(id, companyId, {}, db);
}

function reverseCompanyPayment(id, companyId, { reversedAt, reversedByUserId, reversalReason = null }, db = prisma) {
  return db.payment.updateMany({
    where: {
      id,
      status: 'APPROVED',
      ...buildCompanyPaymentWhere(companyId),
    },
    data: {
      status: 'REVERSED',
      reversedAt,
      reversedByUserId,
      reversalReason,
    },
  });
}

function markPaymentReceiptsAsReplaced(paymentId, replacedAt, db = prisma) {
  return db.paymentReceipt.updateMany({
    where: {
      paymentId,
      isCurrent: true,
    },
    data: {
      isCurrent: false,
      replacedAt,
    },
  });
}

function createPaymentReceipt(data, db = prisma) {
  return db.paymentReceipt.create({
    data,
  });
}

function findCompanyPaymentReceiptById(paymentId, receiptId, companyId, db = prisma) {
  return db.paymentReceipt.findFirst({
    where: {
      id: receiptId,
      paymentId,
      payment: {
        invoice: {
          client: { companyId },
        },
      },
    },
    include: {
      payment: {
        include: {
          invoice: true,
        },
      },
    },
  });
}

module.exports = {
  transaction,
  findCompanyPayments,
  findCompanyPaymentById,
  findCompanyPaymentReceiptById,
  createPayment,
  deleteCompanyPayment,
  updateCompanyPayment,
  markPaymentUnderReview,
  approveCompanyPayment,
  rejectCompanyPayment,
  reverseCompanyPayment,
  markPaymentReceiptsAsReplaced,
  createPaymentReceipt,
};
