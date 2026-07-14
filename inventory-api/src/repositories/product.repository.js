// @ts-nocheck -- Prisma nested orderBy literals require repository-specific typing not introduced in this P0 gate.
const prisma = require('../lib/prisma');

const productInclude = {
  category: true,
  subcategory: true,
  recipe: true,
  createdByUser: {
    select: {
      id: true,
      fullName: true,
      username: true,
      companyId: true,
      roleId: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  prices: {
    where: { isActive: true },
    orderBy: [{ priceType: 'asc' }, { validFrom: 'desc' }],
  },
  supplierLinks: {
    include: { supplier: true },
  },
  warehouseStocks: {
    include: { warehouse: true },
    orderBy: { warehouseId: 'asc' },
  },
  warehouseLotStocks: {
    include: { warehouse: true, lot: true },
    orderBy: [{ warehouseId: 'asc' }, { lotId: 'asc' }],
  },
};

function transaction(work) {
  return prisma.$transaction(work);
}

function findAllProducts(companyId) {
  return prisma.product.findMany({
    where: { companyId },
    orderBy: { id: 'asc' },
    include: productInclude,
  });
}

function findProductById(id, companyId) {
  return prisma.product.findFirst({
    where: { id, companyId },
    include: productInclude,
  });
}

function findProductsByIds(ids, companyId) {
  return prisma.product.findMany({
    where: { id: { in: ids }, companyId },
    include: { category: true, subcategory: true, prices: true },
  });
}

function createProduct(data) {
  return prisma.product.create({ data, include: productInclude });
}

function updateProduct(id, data) {
  return prisma.product.update({ where: { id }, data, include: productInclude });
}

function deleteProduct(id) {
  return prisma.product.delete({ where: { id } });
}

module.exports = {
  transaction,
  productInclude,
  findAllProducts,
  findProductById,
  findProductsByIds,
  createProduct,
  updateProduct,
  deleteProduct,
};
