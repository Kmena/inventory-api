const prisma = require('../lib/prisma');

function findCompanyRegions(companyId) {
  return prisma.region.findMany({
    where: { companyId },
    orderBy: { name: 'asc' },
    include: { subregions: { orderBy: { name: 'asc' } } },
  });
}

function findCompanyRegionById(id, companyId) {
  return prisma.region.findFirst({
    where: { id, companyId },
    include: { subregions: { orderBy: { name: 'asc' } } },
  });
}

function createCompanyRegion(data) {
  return prisma.region.create({
    data,
    include: { subregions: true },
  });
}

function createSubregion(data) {
  return prisma.subregion.create({ data });
}

module.exports = {
  findCompanyRegions,
  findCompanyRegionById,
  createCompanyRegion,
  createSubregion,
};
