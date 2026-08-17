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

function listPurchaseReceipts(companyId, db = prisma) {
  return db.purchaseReceipt.findMany({
    where: { companyId },
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
};
