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

function acquireCompanyInventoryAdvisoryLock(companyId, db = prisma) {
  return db.$executeRaw`SELECT pg_advisory_xact_lock(${companyId})`;
}

async function tryAcquireCompanyInventoryAdvisoryLock(companyId, db = prisma) {
  const rows = await db.$queryRaw`SELECT pg_try_advisory_xact_lock(${companyId}) AS acquired`;
  return Boolean(rows?.[0]?.acquired);
}

function loadInventoryContext(companyId, warehouseId, productId, db = prisma) {
  return Promise.all([
    db.inventory.findUnique({ where: { companyId } }),
    db.warehouse.findFirst({ where: { id: warehouseId, companyId } }),
    db.product.findFirst({ where: { id: productId, companyId } }),
  ]).then(([inventory, warehouse, product]) => ({ inventory, warehouse, product }));
}

function findWarehouseStockRecord(warehouseId, productId, db = prisma) {
  return db.warehouseStock.findUnique({
    where: {
      warehouseId_productId: {
        warehouseId,
        productId,
      },
    },
  });
}

function createWarehouseStockRecord(data, db = prisma) {
  return db.warehouseStock.create({ data });
}

function updateWarehouseStockRecord(where, data, db = prisma) {
  return db.warehouseStock.updateMany({ where, data });
}

function findWarehouseStockRecordById(id, db = prisma) {
  return db.warehouseStock.findUnique({ where: { id } });
}

function findWarehouseLotStockRecord(warehouseId, lotId, db = prisma) {
  return db.warehouseLotStock.findUnique({
    where: {
      warehouseId_lotId: {
        warehouseId,
        lotId,
      },
    },
  });
}

function createWarehouseLotStockRecord(data, db = prisma) {
  return db.warehouseLotStock.create({ data });
}

function updateWarehouseLotStockRecord(where, data, db = prisma) {
  return db.warehouseLotStock.updateMany({ where, data });
}

function findWarehouseLotStockRecordById(id, db = prisma) {
  return db.warehouseLotStock.findUnique({ where: { id } });
}

function createStockMovementRecord(data, db = prisma) {
  return db.stockMovement.create({
    data,
    include: { product: true, lot: true, warehouse: true },
  });
}

function findLotByInternalNumber(companyId, internalLotNumber, db = prisma) {
  return db.lot.findFirst({
    where: {
      internalLotNumber,
      product: { companyId },
    },
    select: { id: true },
  });
}

function findReservableLotStocks(warehouseId, productId, db = prisma) {
  return db.warehouseLotStock.findMany({
    where: {
      warehouseId,
      productId,
      quantity: { gt: 0 },
      lot: {
        status: 'AVAILABLE',
        qaStatus: 'APPROVED',
      },
    },
    include: { lot: true },
  });
}

function findWarehouseStocksByProductIds(companyId, warehouseId, productIds, db = prisma) {
  if (!Array.isArray(productIds) || productIds.length === 0) {
    return Promise.resolve([]);
  }

  return db.warehouseStock.findMany({
    where: {
      warehouseId,
      productId: { in: productIds },
      warehouse: { companyId },
    },
    include: {
      product: {
        select: {
          id: true,
          code: true,
          name: true,
          unit: true,
          requiresLot: true,
          requiresExpiration: true,
        },
      },
    },
  });
}

function findOrderAllocations(companyId, warehouseId, orderId, db = prisma) {
  return db.stockMovement.findMany({
    where: {
      companyId,
      warehouseId,
      sourceType: 'order',
      sourceId: orderId,
      movementType: { in: ['RESERVE', 'RELEASE', 'OUT'] },
    },
    orderBy: { id: 'asc' },
  });
}

function createLot(data, db = prisma) {
  return db.lot.create({ data });
}

function createInventoryAlert(data, db = prisma) {
  return db.inventoryAlert.create({ data });
}

async function updateProductById(id, companyId, data, db = prisma) {
  const result = await db.product.updateMany({
    where: { id, companyId, isActive: true },
    data,
  });

  if (result.count === 0) {
    return null;
  }

  return db.product.findFirst({
    where: { id, companyId, isActive: true },
  });
}

function findLotForCompanyWithActiveWarehouseStocks(lotId, companyId, db = prisma) {
  return db.lot.findFirst({
    where: { id: lotId, companyId },
    include: {
      warehouseLotStocks: {
        where: { quantity: { gt: 0 } },
        include: { warehouse: true },
      },
    },
  });
}

function updateLotById(id, data, db = prisma) {
  return db.lot.update({ where: { id }, data });
}

function updateLotByIdWithWarehouseStocks(id, data, db = prisma) {
  return db.lot.update({
    where: { id },
    data,
    include: { warehouseLotStocks: { include: { warehouse: true } } },
  });
}

function createLotStatusHistory(data, db = prisma) {
  return db.lotStatusHistory.create({ data });
}

function resolveOpenLotAlerts(companyId, lotId, resolvedAt, db = prisma) {
  return db.inventoryAlert.updateMany({
    where: {
      companyId,
      lotId,
      status: 'OPEN',
      alertType: { in: ['QA_FAILURE', 'LOT_BLOCKED'] },
    },
    data: { status: 'RESOLVED', resolvedAt },
  });
}

function findLotForProduct(lotId, productId, db = prisma) {
  return db.lot.findFirst({
    where: { id: lotId, productId },
  });
}

function findOrderForCompany(orderId, companyId, include = {}, db = prisma) {
  return db.order.findFirst({
    where: { id: orderId, companyId },
    include,
  });
}

function updateOrderById(orderId, data, include = {}, db = prisma) {
  return db.order.update({
    where: { id: orderId },
    data,
    include,
  });
}

function findLotById(id, db = prisma) {
  return db.lot.findUnique({ where: { id } });
}

function findFirstSellableWarehouse(companyId, db = prisma) {
  return db.warehouse.findFirst({
    where: {
      companyId,
      isActive: true,
      isVirtual: false,
      isSellableSource: true,
    },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  });
}

module.exports = {
  transaction,
  findAllMovements,
  findWarehouseStocks,
  findWarehouseLotStocks,
  findInventoryAlerts,
  findInventoryAlertById,
  updateInventoryAlert,
  acquireCompanyInventoryAdvisoryLock,
  tryAcquireCompanyInventoryAdvisoryLock,
  loadInventoryContext,
  findWarehouseStockRecord,
  createWarehouseStockRecord,
  updateWarehouseStockRecord,
  findWarehouseStockRecordById,
  findWarehouseLotStockRecord,
  createWarehouseLotStockRecord,
  updateWarehouseLotStockRecord,
  findWarehouseLotStockRecordById,
  createStockMovementRecord,
  findLotByInternalNumber,
  findReservableLotStocks,
  findWarehouseStocksByProductIds,
  findOrderAllocations,
  createLot,
  createInventoryAlert,
  updateProductById,
  findLotForCompanyWithActiveWarehouseStocks,
  updateLotById,
  updateLotByIdWithWarehouseStocks,
  createLotStatusHistory,
  resolveOpenLotAlerts,
  findFirstSellableWarehouse,
  findLotForProduct,
  findOrderForCompany,
  updateOrderById,
  findLotById,
};
