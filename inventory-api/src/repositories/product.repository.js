const prisma = require('../lib/prisma');

function transaction(work) {
  return prisma.$transaction(work);
}

function findAllProducts() {
  return prisma.product.findMany({
    orderBy: { id: 'asc' },
    include: { category: true, recipe: true, supplierLinks: { include: { supplier: true } } },
  });
}

function findProductById(id) {
  return prisma.product.findUnique({
    where: { id },
    include: { category: true, recipe: true, supplierLinks: { include: { supplier: true } } },
  });
}

function findProductsByIds(ids) {
  return prisma.product.findMany({
    where: { id: { in: ids } },
    include: { category: true },
  });
}

function createProduct(data) {
  return prisma.product.create({ data, include: { category: true, recipe: true } });
}

function updateProduct(id, data) {
  return prisma.product.update({ where: { id }, data, include: { category: true, recipe: true } });
}

function deleteProduct(id) {
  return prisma.product.delete({ where: { id } });
}

module.exports = {
  transaction,
  findAllProducts,
  findProductById,
  findProductsByIds,
  createProduct,
  updateProduct,
  deleteProduct,
};
