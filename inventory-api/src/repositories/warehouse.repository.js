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

function createCompanyWarehouse(data) {
  return prisma.warehouse.create({ data });
}

module.exports = {
  findCompanyWarehouses,
  createCompanyWarehouse,
};
