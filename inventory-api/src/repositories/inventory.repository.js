const prisma = require('../lib/prisma');

/** @typedef {import('@prisma/client').Prisma.StockMovementOrderByWithRelationInput} StockMovementOrderByWithRelationInput */

function transaction(work) {
  return prisma.$transaction(work);
}

function findAllMovements(companyId, filters = {}, pagination = null) {
  const where = {
    companyId,
    ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}),
    ...(filters.productId ? { productId: filters.productId } : {}),
    ...(filters.lotId ? { lotId: filters.lotId } : {}),
  };
  const orderBy = /** @type {StockMovementOrderByWithRelationInput} */ ({ id: 'desc' });
  const include = {
    product: true,
    lot: true,
    warehouse: true,
    user: { select: { id: true, fullName: true, username: true } },
  };

  if (!pagination) {
    return prisma.stockMovement.findMany({
      where,
      orderBy,
      include,
    });
  }

  return prisma.$transaction([
    prisma.stockMovement.count({ where }),
    prisma.stockMovement.findMany({
      where,
      orderBy,
      skip: pagination.skip,
      take: pagination.take,
      include,
    }),
  ]).then(([totalItems, items]) => ({ totalItems, items }));
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
