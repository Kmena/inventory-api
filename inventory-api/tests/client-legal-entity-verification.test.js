'use strict';

/**
 * RFR-TASK-202 tests — client-legal-entity-verification.service.js
 *
 * Tests:
 *   - Local identification validation (01/02/03/04 types + INVALID scenarios)
 *   - VERIFIED: activities synced, entity updated
 *   - INVALID: no Hacienda call, status persisted
 *   - NOT_FOUND: activities soft-removed, status NOT_FOUND
 *   - VERIFICATION_UNAVAILABLE: activities preserved, lastVerifiedAt NOT touched
 *   - Idempotency: no duplicate activities on re-verification
 *   - Tenant isolation: wrong companyId → 404
 *   - Identity completeness: missing fields → 400 IDENTITY_INCOMPLETE
 *
 * All tests: NO live Hacienda calls. taxpayerService is always mocked.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createVerificationService,
  normalizeIdentificationTypeCode,
  validateReceiverIdentification,
} = require('../src/services/client-legal-entity-verification.service');

// ─── In-memory Prisma mock ────────────────────────────────────────────────────

function createMockPrisma({ initialEntity = null, initialActivities = [] } = {}) {
  let entity = initialEntity ? { ...initialEntity } : null;
  let activities = initialActivities.map((a) => ({ ...a }));
  let nextId = BigInt(initialActivities.length + 1);

  const db = {
    $transaction: async (fn) => fn(db),
    clientLegalEntity: {
      findFirst: async ({ where } = {}) => {
        if (!entity) return null;
        if (where?.id !== undefined && entity.id !== where.id) return null;
        if (where?.companyId !== undefined && entity.companyId !== where.companyId) return null;
        return { ...entity };
      },
      update: async ({ data } = {}) => {
        Object.assign(entity, data);
        return { ...entity };
      },
    },
    clientEconomicActivity: {
      upsert: async ({ where, create, update } = {}) => {
        const { clientLegalEntityId, code } = where.client_economic_activities_entity_code_unique;
        const idx = activities.findIndex((a) => a.clientLegalEntityId === clientLegalEntityId && a.code === code);
        if (idx >= 0) {
          Object.assign(activities[idx], update);
          return { ...activities[idx] };
        }
        const newActivity = { id: nextId++, ...create };
        activities.push(newActivity);
        return { ...newActivity };
      },
      updateMany: async ({ where, data } = {}) => {
        activities = activities.map((a) => {
          if (where?.clientLegalEntityId !== undefined && a.clientLegalEntityId !== where.clientLegalEntityId) return a;
          if (where?.code?.notIn?.includes(a.code)) return a;
          return { ...a, ...data };
        });
        return { count: activities.length };
      },
      findMany: async ({ where } = {}) => activities
        .filter((a) => !where?.clientLegalEntityId || a.clientLegalEntityId === where.clientLegalEntityId)
        .map((a) => ({ ...a })),
    },
    _getEntity: () => ({ ...entity }),
    _getActivities: () => activities.map((a) => ({ ...a })),
  };
  return db;
}

function makeEntity(overrides = {}) {
  return {
    id: 100n,
    companyId: 42n,
    legalName: 'Demo Receptor S.A.',
    identificationType: '02',
    identificationNumber: '3101000001',
    verificationStatus: 'UNVERIFIED',
    lastVerifiedAt: null,
    taxpayerName: null,
    ...overrides,
  };
}

function makeTaxpayerResult(overrides = {}) {
  return {
    name: 'Demo Receptor S.A.',
    activities: [{ code: '6201', description: 'Desarrollo de software', haciendaStatus: 'A', haciendaType: 'P' }],
    ...overrides,
  };
}

function makeActivity(overrides = {}) {
  return {
    id: 1n,
    companyId: 42n,
    clientLegalEntityId: 100n,
    code: '6201',
    description: 'Desarrollo de software',
    haciendaStatus: 'A',
    haciendaType: 'P',
    isCurrentlyReturned: true,
    verifiedAt: new Date('2025-05-01'),
    createdAt: new Date('2025-05-01'),
    updatedAt: new Date('2025-05-01'),
    ...overrides,
  };
}

// ─── Pure function tests ────────────────────────────────────────────────────────

test('normalizeIdentificationTypeCode: canonical codes 01-04', () => {
  assert.strictEqual(normalizeIdentificationTypeCode('01'), '01');
  assert.strictEqual(normalizeIdentificationTypeCode('02'), '02');
  assert.strictEqual(normalizeIdentificationTypeCode('03'), '03');
  assert.strictEqual(normalizeIdentificationTypeCode('04'), '04');
});

test('normalizeIdentificationTypeCode: string aliases', () => {
  assert.strictEqual(normalizeIdentificationTypeCode('fisica'), '01');
  assert.strictEqual(normalizeIdentificationTypeCode('FISICA'), '01');
  assert.strictEqual(normalizeIdentificationTypeCode('cedula'), '01');
  assert.strictEqual(normalizeIdentificationTypeCode('juridica'), '02');
  assert.strictEqual(normalizeIdentificationTypeCode('JURIDICA'), '02');
  assert.strictEqual(normalizeIdentificationTypeCode('dimex'), '03');
  assert.strictEqual(normalizeIdentificationTypeCode('DIMEX'), '03');
  assert.strictEqual(normalizeIdentificationTypeCode('nite'), '04');
  assert.strictEqual(normalizeIdentificationTypeCode('NITE'), '04');
});

test('normalizeIdentificationTypeCode: unknown type returns null', () => {
  assert.strictEqual(normalizeIdentificationTypeCode('PASAPORTE'), null);
  assert.strictEqual(normalizeIdentificationTypeCode('CEDULA_EXTRANJERA'), null);
  assert.strictEqual(normalizeIdentificationTypeCode(''), null);
  assert.strictEqual(normalizeIdentificationTypeCode(null), null);
  assert.strictEqual(normalizeIdentificationTypeCode(undefined), null);
});

test('validateReceiverIdentification: valid 01 (9 digits)', () => {
  const r = validateReceiverIdentification('01', '123456789');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.digits, '123456789');
});

test('validateReceiverIdentification: valid 01 with dashes (stripped)', () => {
  const r = validateReceiverIdentification('01', '1-234-56789');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.digits, '123456789');
});

test('validateReceiverIdentification: valid 02 (10 digits)', () => {
  const r = validateReceiverIdentification('02', '3101000001');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.digits, '3101000001');
});

test('validateReceiverIdentification: valid 03 DIMEX 11 digits', () => {
  const r = validateReceiverIdentification('03', '10000000001');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.digits, '10000000001');
});

test('validateReceiverIdentification: valid 03 DIMEX 12 digits', () => {
  const r = validateReceiverIdentification('03', '100000000012');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.digits, '100000000012');
});

test('validateReceiverIdentification: valid 04 NITE (10 digits)', () => {
  const r = validateReceiverIdentification('04', '4000000001');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.digits, '4000000001');
});

test('validateReceiverIdentification: unknown type returns UNKNOWN_TYPE', () => {
  const r = validateReceiverIdentification('PASAPORTE', '123456789');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'UNKNOWN_TYPE');
});

test('validateReceiverIdentification: non-numeric returns NON_NUMERIC', () => {
  const r = validateReceiverIdentification('01', 'ABCDEFGHI');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'NON_NUMERIC');
});

test('validateReceiverIdentification: wrong length for 01 (8 digits) returns WRONG_LENGTH', () => {
  const r = validateReceiverIdentification('01', '12345678'); // 8 digits, expects 9
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'WRONG_LENGTH');
});

test('validateReceiverIdentification: wrong length for 02 (9 digits) returns WRONG_LENGTH', () => {
  const r = validateReceiverIdentification('02', '310100000'); // 9, expects 10
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'WRONG_LENGTH');
});

test('validateReceiverIdentification: wrong length for 03 (10 digits) returns WRONG_LENGTH', () => {
  const r = validateReceiverIdentification('03', '1000000000'); // 10, expects 11-12
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'WRONG_LENGTH');
});

test('validateReceiverIdentification: wrong length for 04 (9 digits) returns WRONG_LENGTH', () => {
  const r = validateReceiverIdentification('04', '400000001'); // 9, expects 10
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'WRONG_LENGTH');
});

// ─── Service tests ──────────────────────────────────────────────────────────────

test('[T-131] missing identificationNumber or identificationType → 400 IDENTITY_INCOMPLETE, no Hacienda call', async () => {
  for (const override of [{ identificationNumber: null }, { identificationType: null }]) {
    let haciendaCalled = false;
    const db = createMockPrisma({ initialEntity: makeEntity(override) });
    const svc = createVerificationService({ prisma: db, taxpayerService: { lookupTaxpayer: () => { haciendaCalled = true; } } });
    await assert.rejects(
      () => svc.verifyClientLegalEntityFiscalIdentity(100n, 42n),
      (err) => { assert.strictEqual(err.statusCode, 400); assert.strictEqual(err.code, 'IDENTITY_INCOMPLETE'); return true; },
    );
    assert.strictEqual(haciendaCalled, false);
  }
});

test('invalid identity does NOT call taxpayerService', async () => {
  const db = createMockPrisma({ initialEntity: makeEntity({ identificationType: '01', identificationNumber: '123' }) });
  let taxpayerCalled = false;
  const svc = createVerificationService({ prisma: db, taxpayerService: { lookupTaxpayer: () => { taxpayerCalled = true; } } });

  const result = await svc.verifyClientLegalEntityFiscalIdentity(100n, 42n);

  assert.strictEqual(result.status, 'INVALID');
  assert.strictEqual(taxpayerCalled, false, 'taxpayerService must NOT be called when identity is locally invalid');
});

test('INVALID status is persisted on entity', async () => {
  const db = createMockPrisma({ initialEntity: makeEntity({ identificationType: 'PASAPORTE', identificationNumber: '123456789' }) });
  const svc = createVerificationService({ prisma: db, taxpayerService: { lookupTaxpayer: () => {} } });

  await svc.verifyClientLegalEntityFiscalIdentity(100n, 42n);

  assert.strictEqual(db._getEntity().verificationStatus, 'INVALID');
});

test('INVALID: wrong length for type 02 → INVALID, no Hacienda call', async () => {
  const db = createMockPrisma({ initialEntity: makeEntity({ identificationType: '02', identificationNumber: '12345' }) });
  let called = false;
  const svc = createVerificationService({ prisma: db, taxpayerService: { lookupTaxpayer: () => { called = true; } } });

  const result = await svc.verifyClientLegalEntityFiscalIdentity(100n, 42n);

  assert.strictEqual(result.status, 'INVALID');
  assert.strictEqual(called, false);
});

test('[T-101] success: 1 activity → 1 ClientEconomicActivity created, isCurrentlyReturned=true', async () => {
  const db = createMockPrisma({ initialEntity: makeEntity() });
  const svc = createVerificationService({ prisma: db, taxpayerService: { lookupTaxpayer: async () => makeTaxpayerResult() } });

  const result = await svc.verifyClientLegalEntityFiscalIdentity(100n, 42n);

  assert.strictEqual(result.status, 'VERIFIED');
  const acts = db._getActivities();
  assert.strictEqual(acts.length, 1);
  assert.strictEqual(acts[0].code, '6201');
  assert.strictEqual(acts[0].isCurrentlyReturned, true);
});

test('[T-102] success: 2 activities → 2 records, all isCurrentlyReturned=true', async () => {
  const db = createMockPrisma({ initialEntity: makeEntity() });
  const svc = createVerificationService({
    prisma: db,
    taxpayerService: { lookupTaxpayer: async () => makeTaxpayerResult({
      activities: [
        { code: '6201', description: 'Software', haciendaStatus: 'A', haciendaType: 'P' },
        { code: '4711', description: 'Comercio', haciendaStatus: 'A', haciendaType: 'S' },
      ],
    }) },
  });

  const result = await svc.verifyClientLegalEntityFiscalIdentity(100n, 42n);

  assert.strictEqual(result.status, 'VERIFIED');
  const acts = db._getActivities();
  assert.strictEqual(acts.length, 2);
  assert.ok(acts.every((a) => a.isCurrentlyReturned === true));
});

test('[T-106] verificationStatus set to VERIFIED on success', async () => {
  const db = createMockPrisma({ initialEntity: makeEntity() });
  const svc = createVerificationService({ prisma: db, taxpayerService: { lookupTaxpayer: async () => makeTaxpayerResult() } });

  await svc.verifyClientLegalEntityFiscalIdentity(100n, 42n);

  assert.strictEqual(db._getEntity().verificationStatus, 'VERIFIED');
});

test('[T-107] lastVerifiedAt updated on success', async () => {
  const before = new Date();
  const db = createMockPrisma({ initialEntity: makeEntity() });
  const svc = createVerificationService({ prisma: db, taxpayerService: { lookupTaxpayer: async () => makeTaxpayerResult() } });

  await svc.verifyClientLegalEntityFiscalIdentity(100n, 42n);

  const updated = db._getEntity();
  assert.ok(updated.lastVerifiedAt instanceof Date);
  assert.ok(updated.lastVerifiedAt >= before, 'lastVerifiedAt should be set to now');
});

test('[T-108] taxpayerName stored from Hacienda response', async () => {
  const db = createMockPrisma({ initialEntity: makeEntity() });
  const svc = createVerificationService({ prisma: db, taxpayerService: { lookupTaxpayer: async () => makeTaxpayerResult({ name: 'Comercial Demo S.A.' }) } });

  await svc.verifyClientLegalEntityFiscalIdentity(100n, 42n);

  assert.strictEqual(db._getEntity().taxpayerName, 'Comercial Demo S.A.');
});

test('[T-103] re-verification: 3 previously, now 2 returned → 2 active, 1 soft-removed', async () => {
  const initialActs = [
    makeActivity({ id: 1n, code: '6201', isCurrentlyReturned: true }),
    makeActivity({ id: 2n, code: '4711', isCurrentlyReturned: true }),
    makeActivity({ id: 3n, code: '5610', isCurrentlyReturned: true }), // will be soft-removed
  ];
  const db = createMockPrisma({ initialEntity: makeEntity(), initialActivities: initialActs });
  const svc = createVerificationService({
    prisma: db,
    taxpayerService: { lookupTaxpayer: async () => makeTaxpayerResult({
      activities: [
        { code: '6201', description: 'Software', haciendaStatus: 'A', haciendaType: 'P' },
        { code: '4711', description: 'Comercio', haciendaStatus: 'A', haciendaType: 'S' },
      ],
    }) },
  });

  await svc.verifyClientLegalEntityFiscalIdentity(100n, 42n);

  const acts = db._getActivities();
  const returned = acts.filter((a) => a.isCurrentlyReturned);
  const removed = acts.filter((a) => !a.isCurrentlyReturned);
  assert.strictEqual(returned.length, 2);
  assert.strictEqual(removed.length, 1);
  assert.strictEqual(removed[0].code, '5610');
});

test('[T-104] idempotent: second verification with same data → no duplicates', async () => {
  const initialActs = [makeActivity()];
  const db = createMockPrisma({ initialEntity: makeEntity(), initialActivities: initialActs });
  const svc = createVerificationService({ prisma: db, taxpayerService: { lookupTaxpayer: async () => makeTaxpayerResult() } });

  await svc.verifyClientLegalEntityFiscalIdentity(100n, 42n);
  await svc.verifyClientLegalEntityFiscalIdentity(100n, 42n);

  assert.strictEqual(db._getActivities().length, 1, 'Must not create duplicate activities');
});

test('[T-105] re-verification adds NEW activity not previously stored', async () => {
  const initialActs = [makeActivity({ code: '6201' })];
  const db = createMockPrisma({ initialEntity: makeEntity(), initialActivities: initialActs });
  const svc = createVerificationService({
    prisma: db,
    taxpayerService: { lookupTaxpayer: async () => makeTaxpayerResult({
      activities: [
        { code: '6201', description: 'Software', haciendaStatus: 'A', haciendaType: 'P' },
        { code: '9999', description: 'New activity', haciendaStatus: 'A', haciendaType: 'S' },
      ],
    }) },
  });

  await svc.verifyClientLegalEntityFiscalIdentity(100n, 42n);

  const codes = db._getActivities().map((a) => a.code);
  assert.ok(codes.includes('9999'), 'New activity must be added');
  assert.ok(codes.includes('6201'), 'Existing activity must be preserved');
  assert.strictEqual(db._getActivities().length, 2);
});

test('VERIFIED: soft-removed activity restored when Hacienda returns it again', async () => {
  const initialActs = [makeActivity({ code: '6201', isCurrentlyReturned: false })];
  const db = createMockPrisma({ initialEntity: makeEntity(), initialActivities: initialActs });
  const svc = createVerificationService({ prisma: db, taxpayerService: { lookupTaxpayer: async () => makeTaxpayerResult() } });

  await svc.verifyClientLegalEntityFiscalIdentity(100n, 42n);

  const act = db._getActivities().find((a) => a.code === '6201');
  assert.strictEqual(act.isCurrentlyReturned, true, 'Previously removed activity must be restored');
});

test('VERIFIED: successful lookup with zero activities — not classified as NOT_FOUND', async () => {
  const initialActs = [makeActivity()];
  const db = createMockPrisma({ initialEntity: makeEntity(), initialActivities: initialActs });
  const svc = createVerificationService({ prisma: db, taxpayerService: { lookupTaxpayer: async () => makeTaxpayerResult({ activities: [] }) } });

  const result = await svc.verifyClientLegalEntityFiscalIdentity(100n, 42n);

  assert.strictEqual(result.status, 'VERIFIED', 'Zero activities ≠ NOT_FOUND');
  assert.strictEqual(db._getEntity().verificationStatus, 'VERIFIED');
  assert.strictEqual(db._getEntity().lastVerifiedAt !== null, true, 'lastVerifiedAt must be set');
});

test('VERIFIED empty activities: existing activities become isCurrentlyReturned=false', async () => {
  const initialActs = [
    makeActivity({ code: '6201', isCurrentlyReturned: true }),
    makeActivity({ id: 2n, code: '4711', isCurrentlyReturned: true }),
  ];
  const db = createMockPrisma({ initialEntity: makeEntity(), initialActivities: initialActs });
  const svc = createVerificationService({ prisma: db, taxpayerService: { lookupTaxpayer: async () => makeTaxpayerResult({ activities: [] }) } });

  await svc.verifyClientLegalEntityFiscalIdentity(100n, 42n);

  assert.ok(db._getActivities().every((a) => a.isCurrentlyReturned === false));
});

test('[T-110] NOT_FOUND from Hacienda → verificationStatus=NOT_FOUND', async () => {
  const db = createMockPrisma({ initialEntity: makeEntity() });
  const notFoundError = Object.assign(new Error('not found'), { statusCode: 404, code: 'not_found' });
  const svc = createVerificationService({ prisma: db, taxpayerService: { lookupTaxpayer: async () => { throw notFoundError; } } });

  const result = await svc.verifyClientLegalEntityFiscalIdentity(100n, 42n);

  assert.strictEqual(result.status, 'NOT_FOUND');
  assert.strictEqual(db._getEntity().verificationStatus, 'NOT_FOUND');
});

test('[T-111] NOT_FOUND: all existing activities have isCurrentlyReturned=false', async () => {
  const initialActs = [
    makeActivity({ code: '6201', isCurrentlyReturned: true }),
    makeActivity({ id: 2n, code: '4711', isCurrentlyReturned: true }),
  ];
  const db = createMockPrisma({ initialEntity: makeEntity(), initialActivities: initialActs });
  const err = Object.assign(new Error('not found'), { statusCode: 404, code: 'not_found' });
  const svc = createVerificationService({ prisma: db, taxpayerService: { lookupTaxpayer: async () => { throw err; } } });

  await svc.verifyClientLegalEntityFiscalIdentity(100n, 42n);

  assert.ok(db._getActivities().every((a) => a.isCurrentlyReturned === false));
});

test('[T-112] NOT_FOUND: entities are soft-removed, not deleted', async () => {
  const initialActs = [makeActivity()];
  const db = createMockPrisma({ initialEntity: makeEntity(), initialActivities: initialActs });
  const err = Object.assign(new Error('not found'), { statusCode: 404, code: 'not_found' });
  const svc = createVerificationService({ prisma: db, taxpayerService: { lookupTaxpayer: async () => { throw err; } } });

  await svc.verifyClientLegalEntityFiscalIdentity(100n, 42n);

  assert.strictEqual(db._getActivities().length, 1, 'Activity must still exist (not deleted)');
});

test('[T-120] 502/network error → verificationStatus=VERIFICATION_UNAVAILABLE', async () => {
  const db = createMockPrisma({ initialEntity: makeEntity() });
  const netErr = Object.assign(new Error('network'), { statusCode: 502, code: 'hacienda_unavailable' });
  const svc = createVerificationService({ prisma: db, taxpayerService: { lookupTaxpayer: async () => { throw netErr; } } });

  const result = await svc.verifyClientLegalEntityFiscalIdentity(100n, 42n);

  assert.strictEqual(result.status, 'VERIFICATION_UNAVAILABLE');
  assert.strictEqual(db._getEntity().verificationStatus, 'VERIFICATION_UNAVAILABLE');
});

test('[T-121] VERIFICATION_UNAVAILABLE: existing activities preserved (isCurrentlyReturned unchanged)', async () => {
  const initialActs = [
    makeActivity({ code: '6201', isCurrentlyReturned: true }),
    makeActivity({ id: 2n, code: '4711', isCurrentlyReturned: false }),
  ];
  const db = createMockPrisma({ initialEntity: makeEntity(), initialActivities: initialActs });
  const err = Object.assign(new Error('network'), { statusCode: 502, code: 'hacienda_unavailable' });
  const svc = createVerificationService({ prisma: db, taxpayerService: { lookupTaxpayer: async () => { throw err; } } });

  await svc.verifyClientLegalEntityFiscalIdentity(100n, 42n);

  const acts = db._getActivities();
  assert.strictEqual(acts.find((a) => a.code === '6201')?.isCurrentlyReturned, true, 'Must not be cleared');
  assert.strictEqual(acts.find((a) => a.code === '4711')?.isCurrentlyReturned, false, 'Must remain false');
});

test('[T-122] VERIFICATION_UNAVAILABLE: lastVerifiedAt NOT updated', async () => {
  const previousVerifiedAt = new Date('2025-05-01T10:00:00Z');
  const db = createMockPrisma({ initialEntity: makeEntity({ lastVerifiedAt: previousVerifiedAt }) });
  const err = Object.assign(new Error('timeout'), { statusCode: 502, code: 'hacienda_unavailable' });
  const svc = createVerificationService({ prisma: db, taxpayerService: { lookupTaxpayer: async () => { throw err; } } });

  await svc.verifyClientLegalEntityFiscalIdentity(100n, 42n);

  const entity = db._getEntity();
  assert.deepStrictEqual(entity.lastVerifiedAt, previousVerifiedAt,
    'lastVerifiedAt must NOT be overwritten on VERIFICATION_UNAVAILABLE');
});

test('[T-123] VERIFICATION_UNAVAILABLE does NOT set identity as invalid', async () => {
  const db = createMockPrisma({ initialEntity: makeEntity({ verificationStatus: 'VERIFIED' }) });
  const err = Object.assign(new Error('timeout'), { statusCode: 502, code: 'hacienda_unavailable' });
  const svc = createVerificationService({ prisma: db, taxpayerService: { lookupTaxpayer: async () => { throw err; } } });

  const result = await svc.verifyClientLegalEntityFiscalIdentity(100n, 42n);

  assert.strictEqual(result.status, 'VERIFICATION_UNAVAILABLE');
  // Must NOT be INVALID or NOT_FOUND
  assert.notStrictEqual(db._getEntity().verificationStatus, 'INVALID');
  assert.notStrictEqual(db._getEntity().verificationStatus, 'NOT_FOUND');
});

test('[T-130] wrong companyId → 404 (entity not in scope)', async () => {
  const db = createMockPrisma({ initialEntity: makeEntity({ companyId: 42n }) });
  const svc = createVerificationService({ prisma: db, taxpayerService: { lookupTaxpayer: () => {} } });

  await assert.rejects(
    () => svc.verifyClientLegalEntityFiscalIdentity(100n, 99n), // wrong companyId
    (err) => {
      assert.strictEqual(err.statusCode, 404);
      return true;
    },
  );
});

test('activity rows created during verification use entity companyId (not from browser)', async () => {
  const db = createMockPrisma({ initialEntity: makeEntity({ companyId: 42n }) });
  const svc = createVerificationService({ prisma: db, taxpayerService: { lookupTaxpayer: async () => makeTaxpayerResult() } });

  await svc.verifyClientLegalEntityFiscalIdentity(100n, 42n);

  const acts = db._getActivities();
  assert.ok(acts.every((a) => a.companyId === 42n), 'companyId must come from entity, never from request body');
});

test('listClientLegalEntityActivities: wrong companyId → 404', async () => {
  const db = createMockPrisma({ initialEntity: makeEntity({ companyId: 42n }) });
  const svc = createVerificationService({ prisma: db, taxpayerService: {} });

  await assert.rejects(
    () => svc.listClientLegalEntityActivities(100n, 99n),
    (err) => err.statusCode === 404,
  );
});

test('listClientLegalEntityActivities: does not call taxpayerService', async () => {
  const db = createMockPrisma({
    initialEntity: makeEntity(),
    initialActivities: [makeActivity()],
  });
  let taxpayerCalled = false;
  const svc = createVerificationService({ prisma: db, taxpayerService: { lookupTaxpayer: () => { taxpayerCalled = true; } } });

  await svc.listClientLegalEntityActivities(100n, 42n);

  assert.strictEqual(taxpayerCalled, false, 'GET activities must NEVER call Hacienda');
});

test('listClientLegalEntityActivities: returns activities with correct shape', async () => {
  const db = createMockPrisma({
    initialEntity: makeEntity({ verificationStatus: 'VERIFIED', lastVerifiedAt: new Date('2025-06-01') }),
    initialActivities: [makeActivity()],
  });
  const svc = createVerificationService({ prisma: db, taxpayerService: {} });

  const result = await svc.listClientLegalEntityActivities(100n, 42n);

  assert.strictEqual(result.clientLegalEntityId, '100');
  assert.strictEqual(result.verificationStatus, 'VERIFIED');
  assert.ok(result.lastVerifiedAt instanceof Date);
  assert.strictEqual(result.activities.length, 1);
  assert.strictEqual(result.activities[0].code, '6201');
  assert.ok('isCurrentlyReturned' in result.activities[0]);
  assert.ok('verifiedAt' in result.activities[0]);
});

test('listClientLegalEntityActivities: returns empty activities for unverified entity', async () => {
  const db = createMockPrisma({ initialEntity: makeEntity() });
  const svc = createVerificationService({ prisma: db, taxpayerService: {} });

  const result = await svc.listClientLegalEntityActivities(100n, 42n);

  assert.deepStrictEqual(result.activities, []);
  assert.strictEqual(result.verificationStatus, 'UNVERIFIED');
});
