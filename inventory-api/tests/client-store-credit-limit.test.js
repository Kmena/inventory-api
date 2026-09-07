'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { createClientStoreSchema } = require('../src/schemas/client.schema');

function loadClientServiceWithStubs({
  clientRepositoryOverrides = {},
  regionRepositoryOverrides = {},
  prismaOverrides = {},
} = {}) {
  const servicePath = path.join(__dirname, '..', 'src', 'services', 'client.service.js');
  const clientRepositoryPath = path.join(__dirname, '..', 'src', 'repositories', 'client.repository.js');
  const regionRepositoryPath = path.join(__dirname, '..', 'src', 'repositories', 'region.repository.js');
  const prismaPath = path.join(__dirname, '..', 'src', 'lib', 'prisma.js');

  const previousServiceModule = require.cache[servicePath];
  const previousClientRepositoryModule = require.cache[clientRepositoryPath];
  const previousRegionRepositoryModule = require.cache[regionRepositoryPath];
  const previousPrismaModule = require.cache[prismaPath];

  const clientRepositoryStub = {
    findCompanyClientById: async () => ({ id: 15n, legalEntityId: 88n }),
    countClientStores: async () => 0,
    createClientStore: async (payload) => payload,
    ...clientRepositoryOverrides,
  };
  const regionRepositoryStub = {
    findCompanySubregionById: async () => ({ id: 44n, companyId: 7n }),
    ...regionRepositoryOverrides,
  };

  require.cache[clientRepositoryPath] = {
    id: clientRepositoryPath,
    filename: clientRepositoryPath,
    loaded: true,
    exports: clientRepositoryStub,
  };
  require.cache[regionRepositoryPath] = {
    id: regionRepositoryPath,
    filename: regionRepositoryPath,
    loaded: true,
    exports: regionRepositoryStub,
  };
  require.cache[prismaPath] = {
    id: prismaPath,
    filename: prismaPath,
    loaded: true,
    exports: prismaOverrides,
  };
  delete require.cache[servicePath];

  const clientService = require(servicePath);

  function restore() {
    delete require.cache[servicePath];
    if (previousClientRepositoryModule) {
      require.cache[clientRepositoryPath] = previousClientRepositoryModule;
    } else {
      delete require.cache[clientRepositoryPath];
    }
    if (previousRegionRepositoryModule) {
      require.cache[regionRepositoryPath] = previousRegionRepositoryModule;
    } else {
      delete require.cache[regionRepositoryPath];
    }
    if (previousPrismaModule) {
      require.cache[prismaPath] = previousPrismaModule;
    } else {
      delete require.cache[prismaPath];
    }
    if (previousServiceModule) {
      require.cache[servicePath] = previousServiceModule;
    }
  }

  return {
    clientService,
    clientRepositoryStub,
    regionRepositoryStub,
    restore,
  };
}

test('createClientStoreSchema accepts optional creditLimit and currency with coercion', () => {
  const parsed = createClientStoreSchema.parse({
    subregionId: '44',
    name: 'Sucursal Centro',
    creditLimit: '1800.50',
    currency: 'USD',
  });

  assert.equal(parsed.subregionId, 44n);
  assert.equal(parsed.name, 'Sucursal Centro');
  assert.equal(parsed.creditLimit, 1800.5);
  assert.equal(parsed.currency, 'USD');
});

test('shared store payload builder omits zero creditLimit values', () => {
  const helpersPath = path.join(__dirname, '..', 'src', 'public', 'root', 'views', 'clients-admin.helpers.js');
  const fs = require('node:fs');
  const vm = require('node:vm');
  const source = fs.readFileSync(helpersPath, 'utf8');
  const browserWindow = {};
  const context = vm.createContext({ window: browserWindow });
  browserWindow.RootShell = {
    registry: new Map(),
    register(name, value) { this.registry.set(name, value); },
    require(name) { return this.registry.get(name); },
  };
  vm.runInContext(source, context, { filename: 'clients-admin.helpers.js' });
  const helpers = browserWindow.RootShell.require('views.clientsAdminHelpers');

  const payload = helpers.buildStorePayload({
    get(key) {
      if (key === 'name') return 'Sucursal Centro';
      if (key === 'subregionId') return '44';
      if (key === 'creditLimit') return '0';
      return null;
    },
  });

  assert.equal('creditLimit' in payload, false);
});

test('createClientStoreSchema rejects invalid currency', () => {
  assert.throws(() => {
    createClientStoreSchema.parse({
      subregionId: '44',
      name: 'Sucursal Centro',
      currency: 'GBP',
    });
  }, (error) => {
    assert.equal(error.name, 'ZodError');
    return true;
  });
});

test('createClientStoreSchema rejects negative creditLimit', () => {
  assert.throws(() => {
    createClientStoreSchema.parse({
      subregionId: '44',
      name: 'Sucursal Centro',
      creditLimit: -1,
    });
  }, (error) => {
    assert.equal(error.name, 'ZodError');
    return true;
  });
});

test('createCompanyClientStore persists creditLimit and currency during store creation', async () => {
  const capturedPayloads = [];
  const { clientService, restore } = loadClientServiceWithStubs({
    clientRepositoryOverrides: {
      createClientStore: async (payload) => {
        capturedPayloads.push(payload);
        return {
          id: 99n,
          ...payload,
        };
      },
    },
  });

  try {
    const result = await clientService.createCompanyClientStore(15n, {
      subregionId: 44n,
      name: 'Sucursal Centro',
      creditLimit: 1800.5,
      currency: 'USD',
    }, { companyId: '7' });

    assert.equal(capturedPayloads.length, 1);
    assert.equal(capturedPayloads[0].creditLimit, 1800.5);
    assert.equal(capturedPayloads[0].currency, 'USD');
    assert.equal(capturedPayloads[0].clientId, 15n);
    assert.equal(capturedPayloads[0].legalEntityId, 88n);
    assert.equal(capturedPayloads[0].isPrimary, true);
    assert.equal(result.creditLimit, 1800.5);
    assert.equal(result.currency, 'USD');
  } finally {
    restore();
  }
});
