const prisma = require('../lib/prisma');

/** @typedef {import('@prisma/client').Prisma.StockMovementOrderByWithRelationInput} StockMovementOrderByWithRelationInput */
/** @typedef {import('@prisma/client').Prisma.InventoryAlertOrderByWithRelationInput} InventoryAlertOrderByWithRelationInput */

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

function buildInventoryAlertWhere(companyId, filters = {}) {
  return {
    companyId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.alertType ? { alertType: filters.alertType } : {}),
    ...(filters.severity ? { severity: filters.severity } : {}),
    ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}),
    ...(filters.productId ? { productId: filters.productId } : {}),
    ...(filters.lotId ? { lotId: filters.lotId } : {}),
  };
}

function buildInventoryAlertInclude() {
  return {
    product: {
      select: {
        id: true,
        code: true,
        name: true,
      },
    },
    lot: {
      select: {
        id: true,
        internalLotNumber: true,
        manufacturerLotNumber: true,
        expirationDate: true,
        status: true,
        qaStatus: true,
      },
    },
    warehouse: {
      select: {
        id: true,
        name: true,
        warehouseType: true,
      },
    },
  };
}

function findInventoryAlerts(companyId, filters = {}, pagination = null, db = prisma) {
  const where = buildInventoryAlertWhere(companyId, filters);
  const orderBy = /** @type {InventoryAlertOrderByWithRelationInput[]} */ ([{ createdAt: 'desc' }, { id: 'desc' }]);
  const include = buildInventoryAlertInclude();

  if (!pagination) {
    return db.inventoryAlert.findMany({
      where,
      orderBy,
      include,
    });
  }

  return db.$transaction([
    db.inventoryAlert.count({ where }),
    db.inventoryAlert.findMany({
      where,
      orderBy,
      skip: pagination.skip,
      take: pagination.take,
      include,
    }),
  ]).then(([totalItems, items]) => ({ totalItems, items }));
}

function findInventoryAlertById(id, companyId, db = prisma) {
  return db.inventoryAlert.findFirst({
    where: {
      id,
      companyId,
    },
    include: buildInventoryAlertInclude(),
  });
}

async function updateInventoryAlert(id, companyId, data, db = prisma) {
  const result = await db.inventoryAlert.updateMany({
    where: {
      id,
      companyId,
    },
    data,
  });

  if (result.count === 0) {
    return null;
  }

  return findInventoryAlertById(id, companyId, db);
}

module.exports = {
  transaction,
  findAllMovements,
  findWarehouseStocks,
  findWarehouseLotStocks,
  findInventoryAlerts,
  findInventoryAlertById,
  updateInventoryAlert,
};
