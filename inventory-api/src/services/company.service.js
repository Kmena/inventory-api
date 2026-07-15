const bcrypt = require('bcrypt');

const { bcryptRounds } = require('../config');
const prisma = require('../lib/prisma');
const { createHttpError } = require('../lib/errors');
const companyRepository = require('../repositories/company.repository');

async function listCompanies() {
  return companyRepository.findAllCompanies();
}

function assertRootCreator(auth) {
  if (auth.companyId) {
    throw createHttpError(403, 'Solo el root principal puede crear o listar empresas', 'forbidden');
  }
}

async function listCompaniesForRoot(auth) {
  assertRootCreator(auth);
  return companyRepository.findAllCompaniesForRoot();
}

async function registerCompany(payload) {
  return companyRepository.createCompany(payload);
}

async function updateRootCompanyStatus(companyId, payload, auth) {
  assertRootCreator(auth);

  try {
    return await companyRepository.updateCompanyStatus(companyId, payload.isActive);
  } catch (error) {
    if (error.code === 'P2025') {
      throw createHttpError(404, 'Empresa no encontrada', 'not_found');
    }
    throw error;
  }
}

function buildCompanyDescription(company) {
  const fiscalConfig = company.fiscalConfig;
  const legalName = fiscalConfig?.legalName || company.name;
  const commercialName = fiscalConfig?.commercialName;
  const identification = fiscalConfig?.identificationNumber || company.legalId;
  const contact = company.email || company.phone;
  const location = company.address || fiscalConfig?.address;

  return [
    commercialName && commercialName !== legalName ? `${commercialName}, registrada como ${legalName}` : legalName,
    identification ? `identificacion ${identification}` : null,
    contact ? `contacto ${contact}` : null,
    location ? `ubicada en ${location}` : null,
  ]
    .filter(Boolean)
    .join(', ');
}

async function getExecutiveDashboard(auth) {
  if (!auth.companyId) {
    throw createHttpError(403, 'Este dashboard es solo para roots de empresa', 'forbidden');
  }

  const companyId = BigInt(auth.companyId);
  const { company, employeesCount } = await companyRepository.findCompanyExecutiveDashboard(companyId);
  if (!company) {
    throw createHttpError(404, 'Empresa no encontrada', 'not_found');
  }

  return {
    company: {
      id: company.id,
      name: company.name,
      legalId: company.legalId,
      phone: company.phone,
      email: company.email,
      address: company.address,
      isActive: company.isActive,
      createdAt: company.createdAt,
      fiscalConfig: company.fiscalConfig,
      description: buildCompanyDescription(company),
    },
    metrics: {
      employeesCount,
    },
  };
}

async function registerRootCompany(payload, auth) {
  assertRootCreator(auth);

  const existingUser = await prisma.user.findUnique({
    where: { username: payload.rootUser.username },
  });
  if (existingUser) {
    throw createHttpError(409, 'El usuario administrador ya existe', 'conflict');
  }

  const passwordHash = await bcrypt.hash(payload.rootUser.password, bcryptRounds);

  return prisma.$transaction(async (tx) => {
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
      data: companyRepository.defaultClientClassifications(company.id),
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
  updateRootCompanyStatus,
  getExecutiveDashboard,
  registerRootCompany,
};
