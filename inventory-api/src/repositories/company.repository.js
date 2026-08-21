const prisma = require('../lib/prisma');

function findUserByUsername(username, db = prisma) {
  return db.user.findUnique({
    where: { username },
  });
}

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

async function registerRootCompanyBootstrap(payload, options = {}, db = prisma) {
  const { onSuccess } = options;

  return db.$transaction(async (tx) => {
    const adminRole = await tx.role.upsert({
      where: { code: 'admin' },
      update: { name: 'Administrador', companyId: null, isActive: true },
      create: { code: 'admin', name: 'Administrador', companyId: null, isActive: true },
    });

    const company = await tx.company.create({
      data: {
        ...payload.company,
        isActive: true,
        companyConfig: {
          create: {
            taxPercentage: 13,
            currency: 'CRC',
            pricingMode: 'standard',
            allowBackorder: false,
          },
        },
      },
    });

    await tx.clientClassification.createMany({
      data: defaultClientClassifications(company.id),
      skipDuplicates: true,
    });

    const fiscalConfig = await tx.companyFiscalConfig.create({
      data: {
        companyId: company.id,
        ...payload.fiscalConfig,
        commercialName: payload.fiscalConfig.commercialName || payload.company.name,
        email: payload.fiscalConfig.email || payload.company.email,
        phone: payload.fiscalConfig.phone || payload.company.phone,
        address: payload.fiscalConfig.address || payload.company.address,
      },
    });

    const rootUser = await tx.user.create({
      data: {
        companyId: company.id,
        roleId: adminRole.id,
        fullName: payload.rootUser.fullName,
        email: payload.rootUser.email,
        username: payload.rootUser.username,
        passwordHash: payload.rootUser.passwordHash,
        phone: payload.rootUser.phone,
        status: 'ACTIVE',
      },
      include: { role: true },
    });

    for (const documentType of ['FACTURA_ELECTRONICA', 'TIQUETE_ELECTRONICO', 'NOTA_CREDITO_ELECTRONICA']) {
      await tx.fiscalSequence.create({
        data: {
          companyId: company.id,
          documentType,
          branchCode: payload.fiscalConfig.defaultBranchCode,
          terminalCode: payload.fiscalConfig.defaultTerminalCode,
          currentNumber: 0,
          nextNumber: 1,
          isActive: true,
        },
      });
    }

    const { passwordHash: _passwordHash, ...safeRootUser } = rootUser;
    const result = { company, fiscalConfig, rootUser: safeRootUser };

    if (typeof onSuccess === 'function') {
      await onSuccess(result, tx);
    }

    return result;
  });
}

/**
 * Returns the production consumption tolerance percent for a given company.
 * This replaces the hardcoded CONSUMPTION_TOLERANCE_PERCENT = 0.05 constant
 * (DEC-002: tolerancia persistida en companies).
 *
 * @param {bigint} companyId
 * @param {import('@prisma/client').PrismaClient} [db]
 * @returns {Promise<number>} Tolerance as a percentage (e.g. 5.00 means 5%)
 */
async function getProductionConsumptionTolerance(companyId, db = prisma) {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { productionConsumptionTolerancePercent: true },
  });

  const rawValue = company?.productionConsumptionTolerancePercent;
  if (rawValue === null || rawValue === undefined) {
    return 5.00;
  }

  const numericValue = Number(rawValue);
  return Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : 5.00;
}

module.exports = {
  defaultClientClassifications,
  findUserByUsername,
  findAllCompanies,
  findAllCompaniesForRoot,
  createCompany,
  updateCompanyStatus,
  findCompanyExecutiveDashboard,
  registerRootCompanyBootstrap,
  getProductionConsumptionTolerance,
};
