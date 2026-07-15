const prisma = require('../lib/prisma');

function findCompanyWarehouses(companyId) {
  return prisma.warehouse.findMany({
    where: { companyId },
    orderBy: [
      { isActive: 'desc' },
      { warehouseType: 'asc' },
      { name: 'asc' },
    ],
  });
}

function createCompanyWarehouse(data) {
  return prisma.warehouse.create({ data });
}

module.exports = {
  findCompanyWarehouses,
  createCompanyWarehouse,
};
