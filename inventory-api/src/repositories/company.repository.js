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
  return prisma.$transaction(async (tx) => {
    const company = await tx.company.create({ data });
    await tx.clientClassification.createMany({
      data: defaultClientClassifications(company.id),
      skipDuplicates: true,
    });
    return company;
  });
}

function defaultClientClassifications(companyId) {
  return [
    { companyId, code: 'GENERAL', name: 'General', isActive: true },
    { companyId, code: 'MAYORISTA', name: 'Mayorista', isActive: true },
    { companyId, code: 'MINORISTA', name: 'Minorista', isActive: true },
  ];
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
  defaultClientClassifications,
  findAllCompanies,
  findAllCompaniesForRoot,
  createCompany,
  updateCompanyStatus,
  findCompanyExecutiveDashboard,
};
