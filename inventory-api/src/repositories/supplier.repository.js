const prisma = require('../lib/prisma');

function findAllByCompanyId(companyId, db = prisma) {
  return db.supplier.findMany({
    where: { companyId },
    include: {
      _count: {
        select: { products: true },
      },
    },
    orderBy: [{ name: 'asc' }],
  });
}

function findByIdForCompany(id, companyId, db = prisma) {
  return db.supplier.findFirst({
    where: { id, companyId },
    include: {
      products: {
        include: {
          product: {
            select: { id: true, code: true, name: true, unit: true, price: true },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
      },
    },
  });
}

function findByNameForCompany(name, companyId, db = prisma) {
  return db.supplier.findFirst({
    where: { name, companyId },
  });
}

function create(data, db = prisma) {
  return db.supplier.create({ data });
}

function update(id, companyId, data, db = prisma) {
  return db.supplier.updateMany({
    where: { id, companyId },
    data,
  });
}

function findByIdForCompanyRaw(id, companyId, db = prisma) {
  return db.supplier.findFirst({
    where: { id, companyId },
  });
}

function remove(id, companyId, db = prisma) {
  return db.supplier.deleteMany({
    where: { id, companyId },
  });
}

function findProductByIdForCompany(productId, companyId, db = prisma) {
  return db.product.findFirst({
    where: { id: productId, companyId, isActive: true },
  });
}

function createProductSupplier(data, db = prisma) {
  return db.productSupplier.create({ data });
}

function removeProductSupplier(productId, supplierId, db = prisma) {
  return db.productSupplier.delete({
    where: {
      productId_supplierId: { productId, supplierId },
    },
  });
}

async function countDependencies(supplierId, companyId, db = prisma) {
  const [quotations, purchaseOrders, purchaseReceipts] = await Promise.all([
    db.supplierQuotation.count({ where: { supplierId, companyId } }),
    db.purchaseOrder.count({ where: { supplierId, companyId } }),
    db.purchaseReceipt.count({ where: { supplierId, companyId } }),
  ]);

  return { quotations, purchaseOrders, purchaseReceipts, total: quotations + purchaseOrders + purchaseReceipts };
}

module.exports = {
  findAllByCompanyId,
  findByIdForCompany,
  findByNameForCompany,
  findByIdForCompanyRaw,
  create,
  update,
  remove,
  findProductByIdForCompany,
  createProductSupplier,
  removeProductSupplier,
  countDependencies,
};
