const prisma = require('../lib/prisma');

function transaction(work) {
  return prisma.$transaction(work);
}

function findAllMovements(companyId, filters = {}) {
  return prisma.stockMovement.findMany({
    where: {
      companyId,
      ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}),
      ...(filters.productId ? { productId: filters.productId } : {}),
      ...(filters.lotId ? { lotId: filters.lotId } : {}),
    },
    orderBy: { id: 'desc' },
    include: {
      product: true,
      lot: true,
      warehouse: true,
      user: { select: { id: true, fullName: true, username: true } },
    },
  });
}

function findWarehouseStocks(companyId, filters = {}) {
  return prisma.warehouseStock.findMany({
    where: {
      warehouse: { companyId },
      ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}),
      ...(filters.productId ? { productId: filters.productId } : {}),
    },
    orderBy: [
      { warehouse: { name: 'asc' } },
      { product: { name: 'asc' } },
    ],
    include: {
      warehouse: true,
      product: true,
    },
  });
}

function findWarehouseLotStocks(companyId, filters = {}) {
  return prisma.warehouseLotStock.findMany({
    where: {
      warehouse: { companyId },
      ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}),
      ...(filters.productId ? { productId: filters.productId } : {}),
    },
    orderBy: [{ warehouseId: 'asc' }, { productId: 'asc' }, { lotId: 'asc' }],
    include: { warehouse: true, product: true, lot: true },
  });
}

module.exports = {
  transaction,
  findAllMovements,
  findWarehouseStocks,
  findWarehouseLotStocks,
};
