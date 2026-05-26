const prisma = require('../lib/prisma');

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

function createProduct(data) {
  return prisma.product.create({ data, include: { category: true, recipe: true } });
}

function updateProduct(id, data) {
  return prisma.product.update({ where: { id }, data, include: { category: true, recipe: true } });
}

function deleteProduct(id) {
  return prisma.product.delete({ where: { id } });
}

module.exports = { findAllProducts, findProductById, createProduct, updateProduct, deleteProduct };
