const prisma = require('../lib/prisma');

async function findAllCompanies() {
  return prisma.company.findMany({
    orderBy: { id: 'asc' },
  });
}

async function findAllCompaniesForRoot() {
  return prisma.company.findMany({
    orderBy: { id: 'asc' },
    include: {
      fiscalConfigs: {
        orderBy: { id: 'asc' },
      },
      users: {
        where: {
          role: { code: 'root' },
        },
        select: {
          id: true,
          companyId: true,
          roleId: true,
          fullName: true,
          email: true,
          username: true,
          phone: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          role: true,
        },
        orderBy: { id: 'asc' },
      },
    },
  });
}

async function createCompany(data) {
  return prisma.company.create({ data });
}

module.exports = {
  findAllCompanies,
  findAllCompaniesForRoot,
  createCompany,
};
