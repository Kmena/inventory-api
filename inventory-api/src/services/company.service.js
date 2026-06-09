const bcrypt = require('bcrypt');

const { bcryptRounds } = require('../config');
const prisma = require('../lib/prisma');
const { createHttpError } = require('../lib/errors');
const companyRepository = require('../repositories/company.repository');

async function listCompanies() {
  return companyRepository.findAllCompanies();
}

async function listCompaniesForRoot() {
  return companyRepository.findAllCompaniesForRoot();
}

async function registerCompany(payload) {
  return companyRepository.createCompany(payload);
}

async function registerRootCompany(payload) {
  const existingUser = await prisma.user.findUnique({
    where: { username: payload.rootUser.username },
  });
  if (existingUser) {
    throw createHttpError(409, 'El usuario root ya existe', 'conflict');
  }

  const passwordHash = await bcrypt.hash(payload.rootUser.password, bcryptRounds);

  return prisma.$transaction(async (tx) => {
    const rootRole = await tx.role.upsert({
      where: { code: 'root' },
      update: { name: 'Root', isActive: true },
      create: { code: 'root', name: 'Root', isActive: true },
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

    const fiscalConfig = await tx.companyFiscalConfig.create({
      data: {
        companyId: company.id,
        ...payload.fiscalConfig,
        commercialName: payload.fiscalConfig.commercialName || payload.company.name,
        email: payload.fiscalConfig.email || payload.company.email,
        phone: payload.fiscalConfig.phone || payload.company.phone,
        address: payload.fiscalConfig.address || payload.company.address,
        isActive: true,
      },
    });

    const rootUser = await tx.user.create({
      data: {
        companyId: company.id,
        roleId: rootRole.id,
        fullName: payload.rootUser.fullName,
        email: payload.rootUser.email,
        username: payload.rootUser.username,
        passwordHash,
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
    return { company, fiscalConfig, rootUser: safeRootUser };
  });
}

module.exports = {
  listCompanies,
  listCompaniesForRoot,
  registerCompany,
  registerRootCompany,
};
