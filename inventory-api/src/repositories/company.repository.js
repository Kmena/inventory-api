const prisma = require('../lib/prisma');

async function findAllCompanies() {
  return prisma.company.findMany({
    orderBy: { id: 'asc' },
  });
}

async function createCompany(data) {
  return prisma.company.create({ data });
}

module.exports = {
  findAllCompanies,
  createCompany,
};
