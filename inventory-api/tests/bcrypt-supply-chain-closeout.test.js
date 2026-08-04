const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcrypt');

process.env.NODE_ENV = 'test';
process.env.BROWSER_SESSION_STORE_MODE = 'memory';

const authService = require('../src/services/auth.service');
const userService = require('../src/services/user.service');
const companyService = require('../src/services/company.service');
const userRepository = require('../src/repositories/user.repository');
const roleRepository = require('../src/repositories/role.repository');
const companyRepository = require('../src/repositories/company.repository');
const audit = require('../src/lib/audit');
const browserSessionService = require('../src/services/browser-session.service');

const bcryptFiveFixturePassword = 'Compat123!';
const bcryptFiveFixtureHash = '$2b$04$tMWhPalTuZHPAZK0b6db/.ICR3ciLZS8CWpx0PLgP6Fg2aPR2KSc6';

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

test('bcrypt 6 verifies a stored bcrypt 5.1.1 fixture hash and preserves token login semantics', async () => {
  const recordedEvents = [];

  const result = await withStubs(
    [
      [userRepository, {
        findUserByUsernameWithRelations: async (username) => ({
          id: 21n,
          username,
          fullName: 'Compatibility Admin',
          passwordHash: bcryptFiveFixtureHash,
          status: 'ACTIVE',
          companyId: 8n,
          role: { code: 'admin', isActive: true, rolePermissions: [] },
          company: { id: 8n, isActive: true },
        }),
      }],
      [audit, {
        recordAuditEventIfAvailable: async (payload) => {
          recordedEvents.push(payload);
        },
      }],
    ],
    () => authService.login({ username: 'compat-admin', password: bcryptFiveFixturePassword }),
  );

  assert.equal(await bcrypt.compare(bcryptFiveFixturePassword, bcryptFiveFixtureHash), true);
  assert.equal(typeof result.token, 'string');
  assert.equal(result.user.username, 'compat-admin');
  assert.equal(result.user.id, '21');
  assert.equal(result.user.companyId, '8');
  assert.equal(recordedEvents.at(-1)?.outcome, 'SUCCESS');
});

test('bcrypt-backed browser-session login continues to accept the bcrypt 5.1.1 fixture hash', async () => {
  let sessionCreationCall = null;

  const result = await withStubs(
    [
      [userRepository, {
        findUserByUsernameWithRelations: async () => ({
          id: 22n,
          username: 'compat-browser',
          fullName: 'Compatibility Browser User',
          passwordHash: bcryptFiveFixtureHash,
          status: 'ACTIVE',
          companyId: 9n,
          role: { code: 'admin', isActive: true, rolePermissions: [] },
          company: { id: 9n, isActive: true },
        }),
      }],
      [browserSessionService, {
        createBrowserSession: async (userId) => {
          sessionCreationCall = userId;
          return {
            sessionId: 'session-bcrypt-compat',
            expiresAt: Date.now() + 60_000,
          };
        },
      }],
      [audit, {
        recordAuditEventIfAvailable: async () => {},
      }],
    ],
    () => authService.login(
      { username: 'compat-browser', password: bcryptFiveFixturePassword },
      null,
      { issueBrowserSession: true },
    ),
  );

  assert.equal(sessionCreationCall, 22n);
  assert.equal(result.user.username, 'compat-browser');
  assert.equal(result.browserSession.sessionId, 'session-bcrypt-compat');
  assert.equal(Object.hasOwn(result, 'token'), false);
});

test('userService.registerCompanyUser still generates bcrypt hashes that validate the submitted password', async () => {
  let createdUserPayload = null;

  const result = await withStubs(
    [
      [userRepository, {
        findUserByUsername: async () => null,
        createUser: async (payload) => {
          createdUserPayload = payload;
          return {
            id: 31n,
            username: payload.username,
            companyId: payload.companyId,
            roleId: payload.roleId,
            status: payload.status,
            passwordHash: payload.passwordHash,
          };
        },
      }],
      [roleRepository, {
        findRoleById: async (roleId) => ({
          id: roleId,
          code: 'warehouse',
          companyId: 7n,
          isActive: true,
        }),
      }],
      [audit, {
        recordAuditEventIfAvailable: async () => {},
      }],
    ],
    () => userService.registerCompanyUser(
      { username: 'worker-compat', password: 'WorkerPass123!', roleId: 5n },
      { companyId: '7' },
    ),
  );

  assert.equal(result.username, 'worker-compat');
  assert.equal(createdUserPayload.companyId, 7n);
  assert.equal(createdUserPayload.passwordHash === 'WorkerPass123!', false);
  assert.equal(await bcrypt.compare('WorkerPass123!', createdUserPayload.passwordHash), true);
});

test('companyService.registerRootCompany still hashes the bootstrap password before persistence', async () => {
  let bootstrapPayload = null;

  const result = await withStubs(
    [
      [companyRepository, {
        findUserByUsername: async () => null,
        registerRootCompanyBootstrap: async (payload) => {
          bootstrapPayload = payload;
          return {
            company: { id: 41n, name: payload.company.name },
            fiscalConfig: { companyId: 41n },
            rootUser: {
              id: 51n,
              username: payload.rootUser.username,
              companyId: 41n,
              role: { code: 'admin' },
            },
          };
        },
      }],
      [audit, {
        recordAuditEventIfAvailable: async () => {},
      }],
    ],
    () => companyService.registerRootCompany(
      {
        company: {
          name: 'Compat Corp',
          legalId: '3-101-123456',
          email: 'empresa@example.com',
          phone: '2222-2222',
          address: 'San Jose',
        },
        fiscalConfig: {
          legalName: 'Compat Corp S.A.',
          commercialName: 'Compat Corp',
          identificationNumber: '3-101-123456',
          defaultBranchCode: '001',
          defaultTerminalCode: '00001',
          email: 'fiscal@example.com',
          phone: '2222-2222',
          address: 'San Jose',
        },
        rootUser: {
          fullName: 'Compat Root',
          email: 'root@example.com',
          username: 'compat-root',
          password: 'RootPass123!',
          phone: '8888-9999',
        },
      },
      { role: 'root', companyId: null },
    ),
  );

  assert.equal(result.company.id, 41n);
  assert.equal(bootstrapPayload.rootUser.password, 'RootPass123!');
  assert.equal(typeof bootstrapPayload.rootUser.passwordHash, 'string');
  assert.equal(bootstrapPayload.rootUser.passwordHash === 'RootPass123!', false);
  assert.equal(await bcrypt.compare('RootPass123!', bootstrapPayload.rootUser.passwordHash), true);
});

test('seed flow remains bcrypt-hash based and the upgraded runtime still round-trips seed-style hashes', async () => {
  const seedSource = fs.readFileSync(path.join(__dirname, '..', 'prisma', 'seed.js'), 'utf8');
  const rounds = 4;
  const seedStyleHash = await bcrypt.hash('SeedCompat123!', rounds);

  assert.match(seedSource, /const bcrypt = require\('bcrypt'\);/);
  assert.match(seedSource, /await bcrypt\.hash\(seedPasswords\.root, rounds\)/);
  assert.match(seedSource, /await bcrypt\.hash\(seedPasswords\.admin, rounds\)/);
  assert.equal(await bcrypt.compare('SeedCompat123!', seedStyleHash), true);
});
