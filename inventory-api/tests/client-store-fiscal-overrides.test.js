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
    restore,
  };
}

test('createClientStoreSchema accepts optional store fiscal override fields', () => {
  const parsed = createClientStoreSchema.parse({
    subregionId: '44',
    name: 'Sucursal Fiscal',
    legalName: 'Sucursal Fiscal SA',
    commercialName: 'Sucursal Fiscal',
    legalId: '3-101-123456',
    documentType: 'JURIDICA',
    emailBilling: 'facturacion@sucursal.test',
    economicActivityCode: '6201',
    economicActivityName: 'Servicios',
  });

  assert.equal(parsed.legalName, 'Sucursal Fiscal SA');
  assert.equal(parsed.commercialName, 'Sucursal Fiscal');
  assert.equal(parsed.legalId, '3-101-123456');
  assert.equal(parsed.documentType, 'JURIDICA');
  assert.equal(parsed.emailBilling, 'facturacion@sucursal.test');
  assert.equal(parsed.economicActivityCode, '6201');
  assert.equal(parsed.economicActivityName, 'Servicios');
});

test('createClientStoreSchema rejects invalid override billing email', () => {
  assert.throws(() => {
    createClientStoreSchema.parse({
      subregionId: '44',
      name: 'Sucursal Fiscal',
      emailBilling: 'correo-invalido',
    });
  }, (error) => {
    assert.equal(error.name, 'ZodError');
    return true;
  });
});

test('createCompanyClientStore persists override fiscal fields when provided', async () => {
  const capturedPayloads = [];
  const { clientService, restore } = loadClientServiceWithStubs({
    clientRepositoryOverrides: {
      createClientStore: async (payload) => {
        capturedPayloads.push(payload);
        return payload;
      },
    },
  });

  try {
    await clientService.createCompanyClientStore(15n, {
      subregionId: 44n,
      name: 'Sucursal Fiscal',
      legalName: 'Sucursal Fiscal SA',
      commercialName: 'Sucursal Fiscal',
      legalId: '3-101-123456',
      documentType: 'JURIDICA',
      emailBilling: 'facturacion@sucursal.test',
      economicActivityCode: '6201',
      economicActivityName: 'Servicios',
    }, { companyId: '7' });

    assert.equal(capturedPayloads.length, 1);
    assert.equal(capturedPayloads[0].legalName, 'Sucursal Fiscal SA');
    assert.equal(capturedPayloads[0].commercialName, 'Sucursal Fiscal');
    assert.equal(capturedPayloads[0].legalId, '3-101-123456');
    assert.equal(capturedPayloads[0].documentType, 'JURIDICA');
    assert.equal(capturedPayloads[0].emailBilling, 'facturacion@sucursal.test');
    assert.equal(capturedPayloads[0].economicActivityCode, '6201');
    assert.equal(capturedPayloads[0].economicActivityName, 'Servicios');
  } finally {
    restore();
  }
});

test('createCompanyClientStore preserves inherit semantics when override fields are omitted', async () => {
  const capturedPayloads = [];
  const { clientService, restore } = loadClientServiceWithStubs({
    clientRepositoryOverrides: {
      createClientStore: async (payload) => {
        capturedPayloads.push(payload);
        return payload;
      },
    },
  });

  try {
    await clientService.createCompanyClientStore(15n, {
      subregionId: 44n,
      name: 'Sucursal Heredada',
    }, { companyId: '7' });

    assert.equal(capturedPayloads.length, 1);
    assert.equal('legalName' in capturedPayloads[0], false);
    assert.equal('commercialName' in capturedPayloads[0], false);
    assert.equal('legalId' in capturedPayloads[0], false);
    assert.equal('documentType' in capturedPayloads[0], false);
    assert.equal('emailBilling' in capturedPayloads[0], false);
    assert.equal('economicActivityCode' in capturedPayloads[0], false);
    assert.equal('economicActivityName' in capturedPayloads[0], false);
  } finally {
    restore();
  }
});
