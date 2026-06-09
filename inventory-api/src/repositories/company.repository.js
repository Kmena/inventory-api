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
      fiscalConfig: true,
      users: {
        where: {
          role: { code: 'admin' },
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

async function updateCompanyStatus(companyId, isActive) {
  return prisma.company.update({
    where: { id: companyId },
    data: { isActive },
  });
}

async function findCompanyExecutiveDashboard(companyId) {
  const [company, employeesCount] = await prisma.$transaction([
    prisma.company.findUnique({
      where: { id: companyId },
      include: { fiscalConfig: true },
    }),
    prisma.user.count({
      where: { companyId },
    }),
  ]);

  return { company, employeesCount };
}

module.exports = {
  findAllCompanies,
  findAllCompaniesForRoot,
  createCompany,
  updateCompanyStatus,
  findCompanyExecutiveDashboard,
};
