const bcrypt = require('bcrypt');

const { bcryptRounds } = require('../config');
const { createHttpError } = require('../lib/errors');
const companyRepository = require('../repositories/company.repository');
const audit = require('../lib/audit');
const {
  evaluateGovernanceOperation,
  isGlobalRootActor,
} = require('../security/permission-governance.service');

async function listCompanies(auth) {
  assertRootCreator(auth);
  return companyRepository.findAllCompanies();
}

function assertRootCreator(auth) {
  if (!isGlobalRootActor(auth)) {
    throw createHttpError(403, 'Solo el root global puede crear o listar empresas', 'forbidden');
  }
}

function assertCompanyCreationAllowed(auth) {
  const governanceDecision = evaluateGovernanceOperation('company.create', { auth });
  if (governanceDecision.decision === 'deny') {
    throw createHttpError(403, governanceDecision.denial.message, governanceDecision.denial.code);
  }
}

async function listCompaniesForRoot(auth) {
  assertRootCreator(auth);
  return companyRepository.findAllCompaniesForRoot();
}

async function registerCompany(payload, auth, req = null) {
  assertRootCreator(auth);
  assertCompanyCreationAllowed(auth);

  const company = await companyRepository.createCompany(payload);
  await audit.recordAuditEventIfAvailable({
    req,
    action: 'companies.create',
    resourceType: 'company',
    resourceId: company.id,
    outcome: 'SUCCESS',
    afterState: {
      id: company.id,
      name: company.name,
      legalId: company.legalId,
      isActive: company.isActive,
    },
  });
  return company;
}

async function updateRootCompanyStatus(companyId, payload, auth, req = null) {
  assertRootCreator(auth);

  try {
    const company = await companyRepository.updateCompanyStatus(companyId, payload.isActive);
    await audit.recordAuditEventIfAvailable({
      req,
      action: 'companies.root.status.update',
      resourceType: 'company',
      resourceId: companyId,
      outcome: 'SUCCESS',
      afterState: {
        id: company.id,
        isActive: company.isActive,
      },
    });
    return company;
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

async function registerRootCompany(payload, auth, req = null) {
  assertRootCreator(auth);
  assertCompanyCreationAllowed(auth);

  const existingUser = await companyRepository.findUserByUsername(payload.rootUser.username);
  if (existingUser) {
    throw createHttpError(409, 'El usuario administrador ya existe', 'conflict');
  }

  const passwordHash = await bcrypt.hash(payload.rootUser.password, bcryptRounds);

  return companyRepository.registerRootCompanyBootstrap({
    company: payload.company,
    fiscalConfig: payload.fiscalConfig,
    rootUser: {
      ...payload.rootUser,
      passwordHash,
    },
  }, {
    onSuccess: async (result, tx) => {
      await audit.recordAuditEventIfAvailable({
        req,
        action: 'companies.root.create',
        resourceType: 'company',
        resourceId: result.company.id,
        outcome: 'SUCCESS',
        afterState: {
          companyId: result.company.id,
          companyName: result.company.name,
          rootUserId: result.rootUser.id,
          rootUsername: result.rootUser.username,
        },
      }, { prismaClient: tx });
    },
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
