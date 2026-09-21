const prisma = require('../lib/prisma');

function buildWarehouseWhere(companyId) {
  return { companyId };
}

function warehouseOrderBy() {
  /** @type {[{ isActive: 'desc' }, { warehouseType: 'asc' }, { name: 'asc' }]} */
  const orderBy = [
    { isActive: 'desc' },
    { warehouseType: 'asc' },
    { name: 'asc' },
  ];
  return orderBy;
}

async function buildWarehouseSummary(where) {
  const [total, active, virtual, sellable] = await prisma.$transaction([
    prisma.warehouse.count({ where }),
    prisma.warehouse.count({ where: { ...where, isActive: true } }),
    prisma.warehouse.count({ where: { ...where, isVirtual: true } }),
    prisma.warehouse.count({ where: { ...where, isSellableSource: true } }),
  ]);

  return { total, active, virtual, sellable };
}

async function findCompanyWarehouses(companyId, pagination = null) {
  const where = buildWarehouseWhere(companyId);
  const orderBy = warehouseOrderBy();
  if (!pagination) {
    return prisma.warehouse.findMany({
      where,
      orderBy,
    });
  }

  const [summary, items] = await Promise.all([
    buildWarehouseSummary(where),
    prisma.warehouse.findMany({
      where,
      orderBy,
      skip: pagination.skip,
      take: pagination.take,
    }),
  ]);

  return {
    totalItems: summary.total,
    items,
    summary,
  };
}

function findCompanyWarehouseById(id, companyId, db = prisma) {
  return db.warehouse.findFirst({ where: { id, companyId } });
}

function createCompanyWarehouse(data) {
  return prisma.warehouse.create({ data });
}

async function updateCompanyWarehouse(id, companyId, data, db = prisma) {
  const result = await db.warehouse.updateMany({ where: { id, companyId }, data });
  if (result.count === 0) return null;
  return findCompanyWarehouseById(id, companyId, db);
}

function getWarehouseInventoryUsage(id, companyId, db = prisma) {
  return Promise.all([
    db.warehouseStock.count({ where: { warehouseId: id, warehouse: { companyId }, OR: [{ quantity: { not: 0 } }, { reservedQuantity: { not: 0 } }] } }),
    db.warehouseLotStock.count({ where: { warehouseId: id, warehouse: { companyId }, OR: [{ quantity: { not: 0 } }, { reservedQuantity: { not: 0 } }] } }),
    db.stockMovement.count({ where: { warehouseId: id, companyId } }),
    db.order.count({ where: { warehouseId: id, companyId, status: { in: ['APPROVED'] } } }),
  ]).then(([stockCount, lotStockCount, movementCount, pendingOrderCount]) => ({ stockCount, lotStockCount, movementCount, pendingOrderCount }));
}

module.exports = {
  findCompanyWarehouses,
  findCompanyWarehouseById,
  createCompanyWarehouse,
  updateCompanyWarehouse,
  getWarehouseInventoryUsage,
};
