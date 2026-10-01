'use strict';

/**
 * Bug regression: editing a client resets verificationStatus to UNVERIFIED.
 *
 * Root cause: updateClient always called findOrCreateLegalEntity which searches
 * by identificationNumber. If that lookup failed for any reason (legacy null
 * identificationNumber, data inconsistency, etc.) it created a FRESH entity —
 * silently discarding the existing VERIFIED one.
 *
 * Fix: when legalId has NOT changed and the client already has a legalEntityId,
 * update the existing entity in-place (by ID) via updateLegalEntityInPlace.
 * Only fall back to findOrCreateLegalEntity when legalId actually changes.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const clientRepository = require('../src/repositories/client.repository');
const clientService = require('../src/services/client.service');

/** Temporarily replaces functions on clientRepository, restores after test. */
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

// ---------------------------------------------------------------------------
// Happy path — no legalId change → entity updated in place, verificationStatus
// preserved (updateLegalEntityInPlace is called, findOrCreateLegalEntity is NOT)
// ---------------------------------------------------------------------------

test('updateClient preserves verificationStatus when legalId is unchanged', async () => {
  const calls = { updateInPlace: 0, findOrCreate: 0, updateClient: 0 };

  const verifiedEntity = {
    id: 42n,
    companyId: 10n,
    identificationNumber: '207530251',
    verificationStatus: 'VERIFIED',
    lastVerifiedAt: new Date('2026-01-01'),
    taxpayerName: 'EMPRESA DEMO SA',
  };

  const existingClient = {
    id: 5n,
    companyId: 10n,
    legalEntityId: 42n,
    legalId: '207530251',
    legalEntity: verifiedEntity,
    name: 'Demo',
    documentType: '02',
    phone: '88887777',
    address: 'San José',
    emailBilling: 'demo@example.com',
    economicActivityCode: '9609.0',
    economicActivityName: 'Otras actividades de servicios',
  };

  await withRepositoryStubs(
    {
      findCompanyClientById: async () => existingClient,
      updateLegalEntityInPlace: async (entityId, companyId, payload) => {
        calls.updateInPlace++;
        assert.equal(entityId, 42n, 'should update the existing entity by its ID');
        assert.equal(companyId, 10n);
        assert.equal(payload.phone, '99996666', 'new phone should be passed through');
        return { ...verifiedEntity, phone: payload.phone };
      },
      findOrCreateLegalEntity: async () => {
        calls.findOrCreate++;
        throw new Error('findOrCreateLegalEntity must NOT be called when legalId is unchanged');
      },
      updateCompanyClient: async (clientId, companyId, data) => {
        calls.updateClient++;
        // legalEntityId must NOT be changed when legalId is unchanged
        assert.equal('legalEntityId' in data, false, 'legalEntityId must not change when legalId is unchanged');
        return { ...existingClient, ...data };
      },
      findCompanyClassificationById: async () => null,
    },
    () => clientService.updateClient(
      5n,
      { phone: '99996666' },
      { companyId: '10', permissions: ['clients.view.all'] },
    ),
  );

  assert.equal(calls.updateInPlace, 1, 'updateLegalEntityInPlace should be called once');
  assert.equal(calls.findOrCreate, 0, 'findOrCreateLegalEntity must NOT be called');
  assert.equal(calls.updateClient, 1, 'updateCompanyClient should be called once');
});

// ---------------------------------------------------------------------------
// legalId changed → findOrCreateLegalEntity is called (new identity flow)
// ---------------------------------------------------------------------------

test('updateClient calls findOrCreateLegalEntity when legalId changes', async () => {
  const calls = { updateInPlace: 0, findOrCreate: 0 };

  const existingClient = {
    id: 5n,
    companyId: 10n,
    legalEntityId: 42n,
    legalId: '207530251',
    legalEntity: {
      id: 42n,
      companyId: 10n,
      identificationNumber: '207530251',
      verificationStatus: 'VERIFIED',
    },
    name: 'Demo',
    documentType: '02',
    phone: null,
    address: null,
    emailBilling: null,
    economicActivityCode: null,
    economicActivityName: null,
  };

  const newEntity = { id: 99n, companyId: 10n, identificationNumber: '116560486', verificationStatus: 'UNVERIFIED' };

  await withRepositoryStubs(
    {
      findCompanyClientById: async () => existingClient,
      updateLegalEntityInPlace: async () => {
        calls.updateInPlace++;
        throw new Error('updateLegalEntityInPlace must NOT be called when legalId changes');
      },
      findOrCreateLegalEntity: async (companyId, payload) => {
        calls.findOrCreate++;
        assert.equal(payload.identificationNumber, '116560486', 'must search with the new legalId');
        return newEntity;
      },
      updateCompanyClient: async (_clientId, _companyId, data) => {
        assert.equal(data.legalEntityId, 99n, 'client must be re-linked to the new entity');
        return { ...existingClient, ...data };
      },
      findCompanyClassificationById: async () => null,
    },
    () => clientService.updateClient(
      5n,
      { legalId: '116560486' },
      { companyId: '10', permissions: ['clients.view.all'] },
    ),
  );

  assert.equal(calls.findOrCreate, 1, 'findOrCreateLegalEntity must be called for legalId change');
  assert.equal(calls.updateInPlace, 0, 'updateLegalEntityInPlace must NOT be called for legalId change');
});

// ---------------------------------------------------------------------------
// No existing entity → findOrCreateLegalEntity creates one
// ---------------------------------------------------------------------------

test('updateClient creates entity via findOrCreateLegalEntity when client has no legalEntityId', async () => {
  const calls = { findOrCreate: 0 };

  const existingClient = {
    id: 5n,
    companyId: 10n,
    legalEntityId: null,   // no entity yet
    legalEntity: null,
    legalId: '207530251',
    name: 'Demo',
    documentType: '02',
    phone: '88887777',
    address: null,
    emailBilling: null,
    economicActivityCode: null,
    economicActivityName: null,
  };

  const freshEntity = { id: 77n, companyId: 10n, identificationNumber: '207530251', verificationStatus: 'UNVERIFIED' };

  await withRepositoryStubs(
    {
      findCompanyClientById: async () => existingClient,
      findOrCreateLegalEntity: async (companyId, payload) => {
        calls.findOrCreate++;
        assert.equal(payload.identificationNumber, '207530251');
        return freshEntity;
      },
      updateCompanyClient: async (_clientId, _companyId, data) => {
        assert.equal(data.legalEntityId, 77n, 'new entity should be linked');
        return { ...existingClient, ...data };
      },
      findCompanyClassificationById: async () => null,
    },
    () => clientService.updateClient(
      5n,
      { phone: '88887777' },
      { companyId: '10', permissions: ['clients.view.all'] },
    ),
  );

  assert.equal(calls.findOrCreate, 1);
});

// ---------------------------------------------------------------------------
// legalId unchanged but legalId explicitly provided in payload (same value)
// → still uses updateLegalEntityInPlace (not a real change)
// ---------------------------------------------------------------------------

test('updateClient uses updateLegalEntityInPlace when legalId in payload matches existing', async () => {
  const calls = { updateInPlace: 0, findOrCreate: 0 };

  const existingClient = {
    id: 5n,
    companyId: 10n,
    legalEntityId: 42n,
    legalId: '207530251',
    legalEntity: {
      id: 42n,
      companyId: 10n,
      identificationNumber: '207530251',
      verificationStatus: 'VERIFIED',
    },
    name: 'Demo',
    documentType: '02',
    phone: null,
    address: 'San José',
    emailBilling: null,
    economicActivityCode: null,
    economicActivityName: null,
  };

  await withRepositoryStubs(
    {
      findCompanyClientById: async () => existingClient,
      updateLegalEntityInPlace: async () => {
        calls.updateInPlace++;
        return existingClient.legalEntity;
      },
      findOrCreateLegalEntity: async () => {
        calls.findOrCreate++;
        throw new Error('findOrCreateLegalEntity must NOT be called when legalId is the same');
      },
      updateCompanyClient: async (_id, _companyId, data) => {
        // legalEntityId must remain unchanged
        assert.equal('legalEntityId' in data, false);
        return { ...existingClient, ...data };
      },
      findCompanyClassificationById: async () => null,
    },
    () => clientService.updateClient(
      5n,
      // legalId explicitly in payload but same as existing value
      { legalId: '207530251', address: 'San José, Costa Rica' },
      { companyId: '10', permissions: ['clients.view.all'] },
    ),
  );

  assert.equal(calls.updateInPlace, 1);
  assert.equal(calls.findOrCreate, 0);
});
