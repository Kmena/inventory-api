const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const companyService = require('../src/services/company.service');
const companyRepository = require('../src/repositories/company.repository');
const audit = require('../src/lib/audit');

function withStubs(stubsByModule, run) {
  const originals = [];

  for (const [moduleRef, stubs] of stubsByModule) {
    for (const [key, value] of Object.entries(stubs)) {
      originals.push([moduleRef, key, moduleRef[key]]);
      moduleRef[key] = value;
    }
  }

  return Promise.resolve()
    .then(run)
    .finally(() => {
      for (const [moduleRef, key, value] of originals) {
        moduleRef[key] = value;
      }
    });
}

function buildPayload() {
  return {
    company: {
      name: 'Acme Root Bootstrap',
      legalId: '3-101-999999',
      email: 'empresa@example.com',
      phone: '2222-2222',
      address: 'San Jose',
    },
    fiscalConfig: {
      legalName: 'Acme Root Bootstrap S.A.',
      commercialName: 'Acme Root',
      identificationNumber: '3-101-999999',
      defaultBranchCode: '001',
      defaultTerminalCode: '00001',
      email: 'fiscal@example.com',
      phone: '2222-2222',
      address: 'San Jose',
    },
    rootUser: {
      fullName: 'Root Admin',
      email: 'root@example.com',
      username: 'root-acme',
      password: 'Secret123!',
      phone: '8888-9999',
    },
  };
}

test('registerRootCompany keeps duplicate username conflict behavior without bootstrapping side effects', async () => {
  let bootstrapCalled = false;

  await withStubs(
    [[companyRepository, {
      findUserByUsername: async () => ({ id: 99n, username: 'root-acme' }),
      registerRootCompanyBootstrap: async () => {
        bootstrapCalled = true;
        throw new Error('bootstrap should not run for duplicate username');
      },
    }]],
    async () => {
      await assert.rejects(
        () => companyService.registerRootCompany(buildPayload(), { role: 'root', companyId: null }),
        (error) => {
          assert.equal(error.statusCode, 409);
          assert.equal(error.code, 'conflict');
          assert.equal(bootstrapCalled, false);
          return true;
        },
      );
    },
  );
});

test('registerRootCompany delegates bootstrap persistence to the repository and preserves audit semantics', async () => {
  const payload = buildPayload();
  let bootstrapCall = null;
  let auditCall = null;

  const result = await withStubs(
    [
      [companyRepository, {
        findUserByUsername: async () => null,
        registerRootCompanyBootstrap: async (bootstrapPayload, options) => {
          bootstrapCall = { bootstrapPayload, hasOnSuccess: typeof options.onSuccess === 'function' };
          const repositoryResult = {
            company: { id: 41n, name: payload.company.name },
            fiscalConfig: { companyId: 41n, defaultBranchCode: '001' },
            rootUser: {
              id: 51n,
              companyId: 41n,
              username: payload.rootUser.username,
              role: { code: 'admin' },
            },
          };
          await options.onSuccess(repositoryResult, { kind: 'tx-root-bootstrap' });
          return repositoryResult;
        },
      }],
      [audit, {
        recordAuditEventIfAvailable: async (auditPayload, options) => {
          auditCall = { auditPayload, options };
        },
      }],
    ],
    () => companyService.registerRootCompany(payload, { role: 'root', companyId: null }, { requestContext: { requestId: 'req-root-bootstrap-1' } }),
  );

  assert.equal(bootstrapCall.hasOnSuccess, true);
  assert.equal(bootstrapCall.bootstrapPayload.rootUser.username, payload.rootUser.username);
  assert.equal(bootstrapCall.bootstrapPayload.rootUser.password, payload.rootUser.password);
  assert.equal(typeof bootstrapCall.bootstrapPayload.rootUser.passwordHash, 'string');
  assert.notEqual(bootstrapCall.bootstrapPayload.rootUser.passwordHash, payload.rootUser.password);
  assert.equal(result.company.id, 41n);
  assert.equal(result.rootUser.username, payload.rootUser.username);
  assert.equal(Object.hasOwn(result.rootUser, 'passwordHash'), false);
  assert.equal(auditCall.auditPayload.action, 'companies.root.create');
  assert.equal(auditCall.auditPayload.resourceId, 41n);
  assert.equal(auditCall.auditPayload.afterState.rootUserId, 51n);
  assert.equal(auditCall.options.prismaClient.kind, 'tx-root-bootstrap');
});

test('company service source keeps registerRootCompany free of direct Prisma usage', async () => {
  const serviceSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'services', 'company.service.js'), 'utf8');

  assert.equal(serviceSource.includes('prisma.user.findUnique'), false);
  assert.equal(serviceSource.includes('prisma.$transaction'), false);
  assert.match(serviceSource, /companyRepository\.findUserByUsername/);
  assert.match(serviceSource, /companyRepository\.registerRootCompanyBootstrap/);
});
