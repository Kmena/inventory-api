const test = require('node:test');
const assert = require('node:assert/strict');

const clientRepository = require('../src/repositories/client.repository');
const clientService = require('../src/services/client.service');
const { createCompanyClientSchema, updateClientSchema } = require('../src/schemas/client.schema');

function withRepositoryStubs(stubs, run) {
  const originals = new Map();

  for (const [key, value] of Object.entries(stubs)) {
    originals.set(key, clientRepository[key]);
    clientRepository[key] = value;
  }

  return Promise.resolve()
    .then(run)
    .finally(() => {
      for (const [key, value] of originals.entries()) {
        clientRepository[key] = value;
      }
    });
}

test('listClients rejects authenticated roots without company scope', async () => {
  await assert.rejects(
    () => clientService.listClients({ companyId: null }),
    (error) => {
      assert.equal(error.statusCode, 403);
      assert.equal(error.code, 'forbidden');
      return true;
    },
  );
});

test('listClients returns only company-scoped clients', async () => {
  let receivedCompanyId = null;

  const clients = await withRepositoryStubs(
    {
      findCompanyClients: async (companyId) => {
        receivedCompanyId = companyId;
        return [{ id: 7n, name: 'Cliente A', _count: { stores: 2 } }];
      },
    },
    () => clientService.listClients({ companyId: '15' }),
  );

  assert.equal(receivedCompanyId, 15n);
  assert.deepEqual(clients, [{ id: 7n, name: 'Cliente A', _count: { stores: 2 }, storesCount: 2 }]);
});

test('createCompanyClient forces companyId from authenticated context', async () => {
  let createdPayload = null;

  const createdClient = await withRepositoryStubs(
    {
      findOrCreateLegalEntity: async () => ({ id: 44n }),
      createClient: async (payload) => {
        createdPayload = payload;
        return { id: 1n, ...payload, _count: { stores: 0 } };
      },
    },
    () => clientService.createCompanyClient({ companyId: 999n, name: 'Cliente creado' }, { companyId: '21' }),
  );

  assert.equal(createdPayload.companyId, 21n);
  assert.equal(createdPayload.legalEntityId, 44n);
  assert.equal(createdClient.companyId, 21n);
});

test('getClient returns not found when the client is outside the authenticated company', async () => {
  await withRepositoryStubs(
    {
      findCompanyClientById: async () => null,
    },
    async () => {
      await assert.rejects(
        () => clientService.getClient(10n, { companyId: '22' }),
        (error) => {
          assert.equal(error.statusCode, 404);
          assert.equal(error.code, 'not_found');
          return true;
        },
      );
    },
  );
});

test('legacy client schemas ignore arbitrary companyId from payload', () => {
  const createResult = createCompanyClientSchema.safeParse({
    companyId: '999',
    name: 'Cliente nuevo',
  });
  assert.equal(createResult.success, true);
  assert.equal('companyId' in createResult.data, false);

  const updateResult = updateClientSchema.safeParse({
    companyId: '888',
    name: 'Cliente actualizado',
  });
  assert.equal(updateResult.success, true);
  assert.equal('companyId' in updateResult.data, false);
});

test('updateClient scopes writes to the authenticated company', async () => {
  let receivedLookup = null;
  let receivedUpdate = null;

  const updatedClient = await withRepositoryStubs(
    {
      findCompanyClientById: async (clientId, companyId) => {
        receivedLookup = { clientId, companyId };
        return { id: clientId, companyId };
      },
      updateCompanyClient: async (clientId, companyId, payload) => {
        receivedUpdate = { clientId, companyId, payload };
        return { id: clientId, companyId, ...payload };
      },
    },
    () => clientService.updateClient(9n, { name: 'Actualizado', companyId: 999n }, { companyId: '30' }),
  );

  assert.deepEqual(receivedLookup, { clientId: 9n, companyId: 30n });
  assert.deepEqual(receivedUpdate, { clientId: 9n, companyId: 30n, payload: { name: 'Actualizado' } });
  assert.deepEqual(updatedClient, { id: 9n, companyId: 30n, name: 'Actualizado' });
});

test('removeClient rejects deleting a client from another company', async () => {
  let deleteCalled = false;

  await withRepositoryStubs(
    {
      findCompanyClientById: async () => null,
      softDeleteCompanyClient: async () => {
        deleteCalled = true;
      },
    },
    async () => {
      await assert.rejects(
        () => clientService.removeClient(11n, { companyId: '31' }),
        (error) => {
          assert.equal(error.statusCode, 404);
          assert.equal(error.code, 'not_found');
          return true;
        },
      );
    },
  );

  assert.equal(deleteCalled, false);
});

test('removeClient converts DELETE compatibility flow into soft delete', async () => {
  let receivedSoftDelete = null;

  const result = await withRepositoryStubs(
    {
      findCompanyClientById: async (clientId, companyId) => ({ id: clientId, companyId, deletedAt: null }),
      softDeleteCompanyClient: async (clientId, companyId) => {
        receivedSoftDelete = { clientId, companyId };
        return { count: 1 };
      },
    },
    () => clientService.removeClient(21n, { companyId: '31' }),
  );

  assert.deepEqual(receivedSoftDelete, { clientId: 21n, companyId: 31n });
  assert.deepEqual(result, { count: 1 });
});

// ---------------------------------------------------------------------------
// TEST-005: getClientLedger tenant isolation
// ---------------------------------------------------------------------------

test('getClientLedger rejects cross-tenant access (returns 404)', async () => {
  const _COMPANY_A = '101';
  const COMPANY_B = '202';
  const CLIENT_ID = '777';

  await withRepositoryStubs(
    {
      findClientLedger: async (_clientId, companyId) => {
        // Simulate DB-level tenant isolation: client 777 belongs to company 101
        if (Number(companyId) === Number(COMPANY_B)) return null;
        return {
          id: 777n, code: 'TEST', name: 'Test Client',
          creditLimit: 0, creditBalance: 0, paymentType: 'CASH', paymentDays: null,
          invoices: [],
        };
      },
    },
    async () => {
      // Cross-tenant: company B requesting client from company A → 404
      await assert.rejects(
        () => clientService.getClientLedger(CLIENT_ID, { companyId: COMPANY_B, sub: '1', permissions: [] }),
        (error) => {
          assert.equal(error.statusCode, 404);
          assert.equal(error.code, 'not_found');
          return true;
        },
      );
    },
  );
});

test('getClientLedger returns ledger for same-tenant access', async () => {
  const COMPANY_A = '101';
  const CLIENT_ID = '777';

  const result = await withRepositoryStubs(
    {
      findClientLedger: async (_clientId, companyId) => {
        if (Number(companyId) === Number(COMPANY_A)) {
          return {
            id: 777n, code: 'TEST', name: 'Test Client',
            creditLimit: 1000, creditBalance: 250, paymentType: 'CREDIT', paymentDays: 30,
            invoices: [
              { id: 1n, number: 'INV-1', amount: 500, status: 'PENDING', paidAt: null, payments: [] },
            ],
          };
        }
        return null;
      },
    },
    () => clientService.getClientLedger(CLIENT_ID, { companyId: COMPANY_A, sub: '1', permissions: [] }),
  );

  assert.ok(result.client);
  assert.equal(Number(result.client.id), 777);
  assert.equal(result.client.name, 'Test Client');
  assert.equal(result.invoices.length, 1);
});
