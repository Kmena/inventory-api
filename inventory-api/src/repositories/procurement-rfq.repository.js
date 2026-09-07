'use strict';

const prisma = require('../lib/prisma');

const invitationInclude = {
  supplier: true,
  purchaseRequest: {
    include: {
      items: { include: { product: true } },
    },
  },
  quotation: true,
  createdByUser: true,
};

function transaction(work) {
  return prisma.$transaction(work);
}

function createInvitation(data, db = prisma) {
  return db.supplierQuotationInvitation.create({
    data,
    include: invitationInclude,
  });
}

function findInvitationById(id, companyId, db = prisma) {
  return db.supplierQuotationInvitation.findFirst({
    where: { id, companyId },
    include: invitationInclude,
  });
}

function findInvitationByTokenHash(tokenHash, db = prisma) {
  return db.supplierQuotationInvitation.findUnique({
    where: { tokenHash },
    include: invitationInclude,
  });
}

function listInvitationsForRequest(purchaseRequestId, companyId, db = prisma) {
  return db.supplierQuotationInvitation.findMany({
    where: { purchaseRequestId, companyId },
    include: invitationInclude,
    orderBy: { createdAt: 'desc' },
  });
}

function findActiveInvitationForSupplier(purchaseRequestId, supplierId, companyId, db = prisma) {
  return db.supplierQuotationInvitation.findFirst({
    where: {
      purchaseRequestId,
      supplierId,
      companyId,
      status: { in: ['PENDING', 'PREPARED'] },
    },
  });
}

function updateInvitation(id, data, db = prisma) {
  return db.supplierQuotationInvitation.update({
    where: { id },
    data,
    include: invitationInclude,
  });
}

function findPurchaseRequestForCompany(purchaseRequestId, companyId, db = prisma) {
  return db.purchaseRequest.findFirst({
    where: { id: purchaseRequestId, companyId },
    include: {
      items: { include: { product: true } },
    },
  });
}

function findSupplierForCompany(supplierId, companyId, db = prisma) {
  return db.supplier.findFirst({
    where: { id: supplierId, companyId },
  });
}

function createSupplierQuotation(data, db = prisma) {
  return db.supplierQuotation.create({
    data,
    include: {
      supplier: true,
      items: { include: { product: true } },
    },
  });
}

/**
 * Returns ProductSupplier links for the given supplier and product IDs scoped to the company.
 * Used to determine which request items a supplier is eligible to quote.
 * @param {bigint} companyId
 * @param {bigint} supplierId
 * @param {bigint[]} productIds
 * @param {object} [db]
 */
function listEligibleProductSupplierLinks(companyId, supplierId, productIds, db = prisma) {
  const uniqueIds = [...new Set((productIds || []).map((id) => BigInt(id).toString()))]
    .map((id) => BigInt(id));
  if (!uniqueIds.length) return Promise.resolve([]);
  return db.productSupplier.findMany({
    where: { supplierId, productId: { in: uniqueIds }, product: { companyId } },
    select: { productId: true },
  });
}

function listRfqTrackingSummary(companyId, db = prisma) {
  return db.purchaseRequest.findMany({
    where: {
      companyId,
      status: 'OPEN',
      OR: [
        { rfqInvitations: { some: {} } },
        { quotations: { some: {} } },
      ],
    },
    include: {
      items: { include: { product: true } },
      rfqInvitations: {
        include: {
          supplier: true,
          quotation: {
            include: {
              items: { include: { product: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      quotations: {
        include: {
          supplier: true,
          items: { include: { product: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
}

module.exports = {
  transaction,
  createInvitation,
  findInvitationById,
  findInvitationByTokenHash,
  listInvitationsForRequest,
  findActiveInvitationForSupplier,
  updateInvitation,
  findPurchaseRequestForCompany,
  findSupplierForCompany,
  createSupplierQuotation,
  listEligibleProductSupplierLinks,
  listRfqTrackingSummary,
};
