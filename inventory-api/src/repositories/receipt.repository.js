const prisma = require('../lib/prisma');

const purchaseReceiptInclude = {
  supplier: true,
  warehouse: true,
  purchaseOrder: {
    include: {
      supplier: true,
      items: {
        include: { product: true },
      },
    },
  },
  items: {
    include: {
      product: true,
      substituteProduct: true,
      purchaseOrderItem: true,
      confirmedLot: true,
      inspections: true,
    },
  },
  inspections: true,
};

function findPurchaseOrderByIdForCompany(id, companyId, db = prisma) {
  return db.purchaseOrder.findFirst({
    where: { id, companyId },
    include: {
      supplier: true,
      items: { include: { product: true } },
    },
  });
}

function findSupplierByIdForCompany(id, companyId, db = prisma) {
  return db.supplier.findFirst({ where: { id, companyId } });
}

function findWarehouseByIdForCompany(id, companyId, db = prisma) {
  return db.warehouse.findFirst({ where: { id, companyId, isActive: true } });
}

function findProductByIdForCompany(id, companyId, db = prisma) {
  return db.product.findFirst({ where: { id, companyId, isActive: true } });
}

function createPurchaseReceipt(data, db = prisma) {
  return db.purchaseReceipt.create({
    data,
    include: purchaseReceiptInclude,
  });
}

function listPurchaseReceipts(companyId, statusFilter = null, db = prisma) {
  return db.purchaseReceipt.findMany({
    where: {
      companyId,
      ...(statusFilter?.length ? { status: { in: statusFilter } } : {}),
    },
    include: purchaseReceiptInclude,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
}

function findPurchaseReceiptByIdForCompany(id, companyId, db = prisma) {
  return db.purchaseReceipt.findFirst({
    where: { id, companyId },
    include: purchaseReceiptInclude,
  });
}

function createReceiptInspection(data, db = prisma) {
  return db.receiptInspection.create({
    data,
    include: {
      receipt: true,
      receiptItem: true,
      product: true,
    },
  });
}

function updatePurchaseReceipt(id, data, db = prisma) {
  return db.purchaseReceipt.update({
    where: { id },
    data,
    include: purchaseReceiptInclude,
  });
}

function findPurchaseReceiptByIdForCompanyInTransaction(id, companyId, tx) {
  return tx.purchaseReceipt.findFirst({
    where: { id, companyId },
    include: purchaseReceiptInclude,
  });
}

function updatePurchaseReceiptInTransaction(id, data, tx) {
  return tx.purchaseReceipt.update({
    where: { id },
    data,
    include: purchaseReceiptInclude,
  });
}

function updatePurchaseReceiptItemConfirmedLot(itemId, confirmedLotId, tx) {
  return tx.purchaseReceiptItem.update({
    where: { id: itemId },
    data: { confirmedLotId },
  });
}

/**
 * Lists purchase orders available to create a warehouse receipt.
 * Only ISSUED orders without a CONFIRMED receipt are shown:
 * - DRAFT  → still being prepared
 * - CANCELLED → closed
 * - ISSUED + already has a CONFIRMED receipt → fully received, no longer pending
 *
 * @param {bigint} companyId
 * @param {import('@prisma/client').PrismaClient} db
 */
function listPurchaseOrdersForReceipt(companyId, db = prisma) {
  return db.purchaseOrder.findMany({
    where: {
      companyId,
      status: 'ISSUED',
      receipts: { none: { status: 'CONFIRMED' } },
    },
    include: {
      supplier: true,
      items: { include: { product: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

module.exports = {
  findPurchaseOrderByIdForCompany,
  findSupplierByIdForCompany,
  findWarehouseByIdForCompany,
  findProductByIdForCompany,
  createPurchaseReceipt,
  listPurchaseReceipts,
  findPurchaseReceiptByIdForCompany,
  createReceiptInspection,
  updatePurchaseReceipt,
  findPurchaseReceiptByIdForCompanyInTransaction,
  updatePurchaseReceiptInTransaction,
  updatePurchaseReceiptItemConfirmedLot,
  listPurchaseOrdersForReceipt,
};
