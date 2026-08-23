const prisma = require('../lib/prisma');

function createFiscalDocumentReference(data, db = prisma) {
  return db.fiscalDocumentReference.create({
    data,
    include: { company: false, purchaseReceipt: true, purchaseOrder: true },
  });
}

function findFiscalReferencesByReceiptForCompany(purchaseReceiptId, companyId, db = prisma) {
  return db.fiscalDocumentReference.findMany({
    where: { purchaseReceiptId, companyId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
}

function findFiscalReferencesByOrderForCompany(purchaseOrderId, companyId, db = prisma) {
  return db.fiscalDocumentReference.findMany({
    where: { purchaseOrderId, companyId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
}

function findReceiptByIdForCompany(id, companyId, db = prisma) {
  return db.purchaseReceipt.findFirst({ where: { id, companyId } });
}

function listAllFiscalReferencesForCompany(companyId, db = prisma) {
  return db.fiscalDocumentReference.findMany({
    where: { companyId },
    include: {
      purchaseReceipt: {
        include: { supplier: true },
      },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
}

module.exports = {
  createFiscalDocumentReference,
  findFiscalReferencesByReceiptForCompany,
  findFiscalReferencesByOrderForCompany,
  findReceiptByIdForCompany,
  listAllFiscalReferencesForCompany,
};
