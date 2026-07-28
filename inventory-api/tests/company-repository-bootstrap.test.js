const test = require('node:test');
const assert = require('node:assert/strict');

const prisma = require('../src/lib/prisma');
const companyRepository = require('../src/repositories/company.repository');

function buildPayload() {
  return {
    company: {
      name: 'Acme Bootstrap',
      legalId: '3-101-111111',
      email: 'company@example.com',
      phone: '2222-0000',
      address: 'Heredia',
    },
    fiscalConfig: {
      legalName: 'Acme Bootstrap S.A.',
      commercialName: '',
      identificationNumber: '3-101-111111',
      defaultBranchCode: '001',
      defaultTerminalCode: '00001',
      email: '',
      phone: '',
      address: '',
    },
    rootUser: {
      fullName: 'Bootstrap Admin',
      email: 'root@example.com',
      username: 'bootstrap-admin',
      phone: '8888-7777',
      passwordHash: 'hashed-password',
    },
  };
}

test('registerRootCompanyBootstrap keeps transaction ownership and creates the expected bootstrap artifacts', async () => {
  const operations = [];
  const originalTransaction = prisma.$transaction;

  prisma.$transaction = async (callback) => callback({
    role: {
      upsert: async (query) => {
        operations.push({ step: 'role.upsert', query });
        return { id: 2n, code: 'admin' };
      },
    },
    company: {
      create: async (query) => {
        operations.push({ step: 'company.create', query });
        return { id: 10n, name: query.data.name };
      },
    },
    clientClassification: {
      createMany: async (query) => {
        operations.push({ step: 'clientClassification.createMany', query });
        return { count: query.data.length };
      },
    },
    companyFiscalConfig: {
      create: async (query) => {
        operations.push({ step: 'companyFiscalConfig.create', query });
        return { id: 11n, companyId: query.data.companyId, commercialName: query.data.commercialName };
      },
    },
    user: {
      create: async (query) => {
        operations.push({ step: 'user.create', query });
        return {
          id: 12n,
          companyId: query.data.companyId,
          username: query.data.username,
          passwordHash: query.data.passwordHash,
          role: { code: 'admin' },
        };
      },
    },
    fiscalSequence: {
      create: async (query) => {
        operations.push({ step: 'fiscalSequence.create', query });
        return { id: BigInt(operations.length) };
      },
    },
  });

  try {
    let onSuccessCall = null;
    const result = await companyRepository.registerRootCompanyBootstrap(buildPayload(), {
      onSuccess: async (repositoryResult, tx) => {
        onSuccessCall = { repositoryResult, tx };
      },
    });

    assert.equal(result.company.id, 10n);
    assert.equal(result.fiscalConfig.companyId, 10n);
    assert.equal(result.rootUser.username, 'bootstrap-admin');
    assert.equal(Object.hasOwn(result.rootUser, 'passwordHash'), false);
    assert.equal(operations.filter((entry) => entry.step === 'fiscalSequence.create').length, 3);
    assert.equal(operations.find((entry) => entry.step === 'companyFiscalConfig.create').query.data.commercialName, 'Acme Bootstrap');
    assert.equal(operations.find((entry) => entry.step === 'companyFiscalConfig.create').query.data.email, 'company@example.com');
    assert.equal(operations.find((entry) => entry.step === 'companyFiscalConfig.create').query.data.phone, '2222-0000');
    assert.equal(onSuccessCall.repositoryResult.company.id, 10n);
    assert.equal(typeof onSuccessCall.tx.role.upsert, 'function');
  } finally {
    prisma.$transaction = originalTransaction;
  }
});

test('findUserByUsername delegates the duplicate lookup to the repository boundary', async () => {
  let receivedQuery = null;
  const originalFindUnique = prisma.user.findUnique;
  prisma.user.findUnique = async (query) => {
    receivedQuery = query;
    return null;
  };

  try {
    await companyRepository.findUserByUsername('root-admin');
  } finally {
    prisma.user.findUnique = originalFindUnique;
  }

  assert.deepEqual(receivedQuery, {
    where: { username: 'root-admin' },
  });
});
