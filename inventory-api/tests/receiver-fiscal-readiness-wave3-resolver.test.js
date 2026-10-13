'use strict';

/**
 * RFR-TASK-301 + RFR-TASK-802 — Pure resolver + preview DTO tests
 * No DB, no Hacienda, no Billing.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  resolveReceiverFiscalReadiness,
  isCompleteFiscalEntity,
  selectOrderReceiverLegalEntity,
  buildFiscalReadinessPreviewDto,
  buildBillingDisabledPreviewDto,
  resolveOrderReceiverFiscalData,
} = require('../src/services/receiver-fiscal-readiness.service');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEntity(overrides = {}) {
  return {
    id: 100n,
    companyId: 42n,
    legalName: 'Demo S.A.',
    identificationType: 'JURIDICA',
    identificationNumber: '3101000001',
    email: 'fiscal@demo.cr',   // required by resolveFiscalReceiver isCompleteFiscalIdentity
    verificationStatus: 'VERIFIED',
    lastVerifiedAt: new Date('2025-06-01'),
    taxpayerName: 'Demo S.A.',
    ...overrides,
  };
}

function makeActivity(overrides = {}) {
  return {
    id: 1n,
    clientLegalEntityId: 100n,
    companyId: 42n,
    code: '620100',
    description: 'Desarrollo de software',
    haciendaStatus: 'A',
    haciendaType: 'P',
    isCurrentlyReturned: true,
    verifiedAt: new Date('2025-06-01'),
    ...overrides,
  };
}

// ─── isCompleteFiscalEntity ───────────────────────────────────────────────────

test('isCompleteFiscalEntity: null → false', () => {
  assert.strictEqual(isCompleteFiscalEntity(null), false);
});

test('isCompleteFiscalEntity: full entity → true', () => {
  assert.strictEqual(isCompleteFiscalEntity(makeEntity()), true);
});

test('isCompleteFiscalEntity: missing legalName → false', () => {
  assert.strictEqual(isCompleteFiscalEntity(makeEntity({ legalName: null })), false);
  assert.strictEqual(isCompleteFiscalEntity(makeEntity({ legalName: '' })), false);
});

test('isCompleteFiscalEntity: missing identificationType → false', () => {
  assert.strictEqual(isCompleteFiscalEntity(makeEntity({ identificationType: null })), false);
});

test('isCompleteFiscalEntity: missing identificationNumber → false', () => {
  assert.strictEqual(isCompleteFiscalEntity(makeEntity({ identificationNumber: null })), false);
});

test('isCompleteFiscalEntity: missing billing email → false', () => {
  assert.strictEqual(isCompleteFiscalEntity(makeEntity({ email: null })), false);
});

// ─── resolveReceiverFiscalReadiness — blocking states ────────────────────────

test('null entity → IDENTITY_INCOMPLETE', () => {
  const r = resolveReceiverFiscalReadiness(null, []);
  assert.strictEqual(r.state, 'IDENTITY_INCOMPLETE');
  assert.deepStrictEqual(r.eligibleActivities, []);
});

test('incomplete entity (no legalName) → IDENTITY_INCOMPLETE', () => {
  const r = resolveReceiverFiscalReadiness(makeEntity({ legalName: null }), []);
  assert.strictEqual(r.state, 'IDENTITY_INCOMPLETE');
});

test('UNVERIFIED entity → UNVERIFIED', () => {
  const r = resolveReceiverFiscalReadiness(makeEntity({ verificationStatus: 'UNVERIFIED' }), []);
  assert.strictEqual(r.state, 'UNVERIFIED');
  assert.deepStrictEqual(r.eligibleActivities, []);
});

test('NOT_FOUND entity → NOT_FOUND', () => {
  const r = resolveReceiverFiscalReadiness(makeEntity({ verificationStatus: 'NOT_FOUND' }), []);
  assert.strictEqual(r.state, 'NOT_FOUND');
  assert.deepStrictEqual(r.eligibleActivities, []);
});

test('INVALID entity → IDENTITY_INVALID', () => {
  const r = resolveReceiverFiscalReadiness(makeEntity({ verificationStatus: 'INVALID' }), []);
  assert.strictEqual(r.state, 'IDENTITY_INVALID');
  assert.deepStrictEqual(r.eligibleActivities, []);
});

test('VERIFICATION_UNAVAILABLE entity → VERIFICATION_UNAVAILABLE', () => {
  const r = resolveReceiverFiscalReadiness(makeEntity({ verificationStatus: 'VERIFICATION_UNAVAILABLE' }), []);
  assert.strictEqual(r.state, 'VERIFICATION_UNAVAILABLE');
  assert.deepStrictEqual(r.eligibleActivities, []);
});

test('VERIFIED with no activities → ACTIVITIES_MISSING', () => {
  const r = resolveReceiverFiscalReadiness(makeEntity(), []);
  assert.strictEqual(r.state, 'ACTIVITIES_MISSING');
  assert.deepStrictEqual(r.eligibleActivities, []);
});

test('VERIFIED with only isCurrentlyReturned=false activities → ACTIVITIES_MISSING', () => {
  const acts = [makeActivity({ isCurrentlyReturned: false }), makeActivity({ id: 2n, code: '471100', isCurrentlyReturned: false })];
  const r = resolveReceiverFiscalReadiness(makeEntity(), acts);
  assert.strictEqual(r.state, 'ACTIVITIES_MISSING');
});

// ─── resolveReceiverFiscalReadiness — READY states ───────────────────────────

test('VERIFIED with 1 eligible activity → READY, 1 eligibleActivity', () => {
  const r = resolveReceiverFiscalReadiness(makeEntity(), [makeActivity()]);
  assert.strictEqual(r.state, 'READY');
  assert.strictEqual(r.eligibleActivities.length, 1);
});

test('VERIFIED with 3 eligible activities → READY, 3 eligibleActivities', () => {
  const acts = [
    makeActivity({ id: 1n, code: '620100' }),
    makeActivity({ id: 2n, code: '471100' }),
    makeActivity({ id: 3n, code: '560100' }),
  ];
  const r = resolveReceiverFiscalReadiness(makeEntity(), acts);
  assert.strictEqual(r.state, 'READY');
  assert.strictEqual(r.eligibleActivities.length, 3);
});

test('VERIFIED: mix of returned + not-returned → only returned are eligible', () => {
  const acts = [
    makeActivity({ id: 1n, code: '620100', isCurrentlyReturned: true }),
    makeActivity({ id: 2n, code: '471100', isCurrentlyReturned: false }),
    makeActivity({ id: 3n, code: '560100', isCurrentlyReturned: true }),
  ];
  const r = resolveReceiverFiscalReadiness(makeEntity(), acts);
  assert.strictEqual(r.state, 'READY');
  assert.strictEqual(r.eligibleActivities.length, 2);
  assert.ok(r.eligibleActivities.every((a) => a.isCurrentlyReturned));
});

// ─── RFR-TASK-802: 6-char length filter ──────────────────────────────────────

test('[RFR-802] activities with code.length !== 6 are excluded from eligible (XSD constraint)', () => {
  const acts = [
    makeActivity({ id: 1n, code: '6201', isCurrentlyReturned: true }),    // 4 chars — excluded
    makeActivity({ id: 2n, code: '620100', isCurrentlyReturned: true }),   // 6 chars — included
    makeActivity({ id: 3n, code: '47112345', isCurrentlyReturned: true }), // 8 chars — excluded
  ];
  const r = resolveReceiverFiscalReadiness(makeEntity(), acts);
  assert.strictEqual(r.eligibleActivities.length, 1);
  assert.strictEqual(r.eligibleActivities[0].code, '620100');
});

test('[RFR-802] "9609.0" (6 chars, non-numeric) is NOT excluded — XSD has no numeric-only restriction', () => {
  const acts = [makeActivity({ code: '9609.0', isCurrentlyReturned: true })];
  const r = resolveReceiverFiscalReadiness(makeEntity(), acts);
  assert.strictEqual(r.state, 'READY');
  assert.strictEqual(r.eligibleActivities.length, 1, '"9609.0" must NOT be excluded by the 6-char filter');
});

test('[RFR-802] all 4-char codes → ACTIVITIES_MISSING', () => {
  const acts = [makeActivity({ code: '6201', isCurrentlyReturned: true })];
  const r = resolveReceiverFiscalReadiness(makeEntity(), acts);
  assert.strictEqual(r.state, 'ACTIVITIES_MISSING');
});

// ─── buildFiscalReadinessPreviewDto ──────────────────────────────────────────

test('buildFiscalReadinessPreviewDto: READY with 1 activity → autoSelectedCode set', () => {
  const act = makeActivity({ code: '620100' });
  const dto = buildFiscalReadinessPreviewDto(100n, {
    state: 'READY',
    entity: makeEntity(),
    eligibleActivities: [act],
    allActivities: [act],
  });

  assert.strictEqual(dto.orderId, '100');
  assert.strictEqual(dto.fiscalBillingEnabled, true);
  assert.strictEqual(dto.receiverState, 'READY');
  assert.ok(dto.receiver, 'receiver must be present');
  assert.strictEqual(dto.receiver.legalName, 'Demo S.A.');
  assert.strictEqual(dto.receiver.identificationType, 'JURIDICA');
  assert.strictEqual(dto.receiver.identificationNumber, '3101000001');
  assert.strictEqual(dto.receiver.verificationStatus, 'VERIFIED');
  assert.ok(dto.receiver.lastVerifiedAt instanceof Date);
  assert.strictEqual(dto.eligibleActivities.length, 1);
  assert.strictEqual(dto.eligibleActivities[0].code, '620100');
  assert.strictEqual(dto.autoSelectedCode, '620100', 'exactly 1 activity → autoSelectedCode');
});

test('buildFiscalReadinessPreviewDto: READY with multiple activities → autoSelectedCode null', () => {
  const acts = [makeActivity({ code: '620100' }), makeActivity({ id: 2n, code: '471100' })];
  const dto = buildFiscalReadinessPreviewDto(101n, {
    state: 'READY',
    entity: makeEntity(),
    eligibleActivities: acts,
    allActivities: acts,
  });

  assert.strictEqual(dto.eligibleActivities.length, 2);
  assert.strictEqual(dto.autoSelectedCode, null, 'multiple activities → no auto-selection');
});

test('buildFiscalReadinessPreviewDto: blocking state → empty activities + no autoSelected', () => {
  const dto = buildFiscalReadinessPreviewDto(102n, {
    state: 'UNVERIFIED',
    entity: makeEntity({ verificationStatus: 'UNVERIFIED' }),
    eligibleActivities: [],
    allActivities: [],
  });

  assert.strictEqual(dto.receiverState, 'UNVERIFIED');
  assert.deepStrictEqual(dto.eligibleActivities, []);
  assert.strictEqual(dto.autoSelectedCode, null);
});

test('buildFiscalReadinessPreviewDto: IDENTITY_INCOMPLETE → receiver null', () => {
  const dto = buildFiscalReadinessPreviewDto(103n, {
    state: 'IDENTITY_INCOMPLETE',
    entity: null,
    eligibleActivities: [],
    allActivities: [],
  });

  assert.strictEqual(dto.receiver, null);
  assert.strictEqual(dto.receiverState, 'IDENTITY_INCOMPLETE');
});

test('buildFiscalReadinessPreviewDto: activity fields mapped correctly', () => {
  const act = makeActivity({ code: '620100', description: 'Software', haciendaStatus: 'A', haciendaType: 'P' });
  const dto = buildFiscalReadinessPreviewDto(104n, {
    state: 'READY', entity: makeEntity(), eligibleActivities: [act], allActivities: [act],
  });

  const actDto = dto.eligibleActivities[0];
  assert.strictEqual(actDto.code, '620100');
  assert.strictEqual(actDto.description, 'Software');
  assert.strictEqual(actDto.haciendaStatus, 'A');
  assert.strictEqual(actDto.haciendaType, 'P');
  // No internal fields exposed
  assert.ok(!('id' in actDto), 'id must not be in DTO');
  assert.ok(!('clientLegalEntityId' in actDto), 'clientLegalEntityId must not be in DTO');
  assert.ok(!('isCurrentlyReturned' in actDto), 'isCurrentlyReturned must not be in DTO');
});

test('buildBillingDisabledPreviewDto: all fiscal fields null/empty/false', () => {
  const dto = buildBillingDisabledPreviewDto(99n);
  assert.strictEqual(dto.orderId, '99');
  assert.strictEqual(dto.fiscalBillingEnabled, false);
  assert.strictEqual(dto.receiverState, null);
  assert.strictEqual(dto.receiver, null);
  assert.deepStrictEqual(dto.eligibleActivities, []);
  assert.strictEqual(dto.autoSelectedCode, null);
});

// ─── resolveOrderReceiverFiscalData — integration with mock DB ────────────────

function makeOrderWithLegalEntity(entityOverrides = {}) {
  const entity = makeEntity(entityOverrides);
  return {
    id: 10n,
    companyId: 42n,
    clientId: 1n,
    clientStoreId: null,
    client: { id: 1n, legalEntity: entity },
    clientStore: null,
  };
}

/** Order whose client has direct fiscal fields but NO ClientLegalEntity. */
function makeOrderDirectClientFields() {
  return {
    id: 10n, companyId: 42n,
    client: {
      id: 1n,
      legalName: 'Direct S.A.', identificationType: 'JURIDICA',
      identificationNumber: '3101000001', email: 'direct@test.cr',
      legalEntity: null,
    },
    clientStore: null,
  };
}

function makeMockDb(entity, activities = []) {
  return {
    order: {
      findFirst: async ({ where }) => {
        if (where.id === 10n && where.companyId === 42n) {
          return makeOrderWithLegalEntity();
        }
        return null;
      },
    },
    clientLegalEntity: {
      findFirst: async () => entity,
    },
    clientEconomicActivity: {
      findMany: async () => activities,
    },
  };
}

test('resolveOrderReceiverFiscalData: READY entity + 1 activity → READY', async () => {
  const order = makeOrderWithLegalEntity();
  const entity = makeEntity();
  const acts = [makeActivity()];
  const db = makeMockDb(entity, acts);

  const result = await resolveOrderReceiverFiscalData(order, 42n, db);
  assert.strictEqual(result.state, 'READY');
  assert.ok(result.entity);
  assert.strictEqual(result.eligibleActivities.length, 1);
});

test('resolveOrderReceiverFiscalData: no clientLegalEntity (direct client fields only) → IDENTITY_INCOMPLETE', async () => {
  const db = makeMockDb(null, []);
  const result = await resolveOrderReceiverFiscalData(makeOrderDirectClientFields(), 42n, db);
  assert.strictEqual(result.state, 'IDENTITY_INCOMPLETE', 'direct Client fields without legalEntity must be IDENTITY_INCOMPLETE');
});

test('resolveOrderReceiverFiscalData: inherited store with missing email explains blocked field', async () => {
  const entity = makeEntity({ email: null });
  const order = {
    id: 10n,
    companyId: 42n,
    client: { id: 1n, legalEntity: entity },
    clientStore: { id: 2n, legalEntity: null },
  };
  const db = makeMockDb(entity, [makeActivity()]);

  const result = await resolveOrderReceiverFiscalData(order, 42n, db);
  assert.strictEqual(result.state, 'IDENTITY_INCOMPLETE');
  assert.strictEqual(result.entity.id, entity.id);
  assert.deepStrictEqual(result.eligibleActivities, []);
  assert.ok(result.blockingReasons.some((reason) => reason.field === 'email'));
});

test('selectOrderReceiverLegalEntity: store legal entity takes precedence over client entity', () => {
  const clientEntity = makeEntity({ id: 100n, legalName: 'Cliente SA' });
  const storeEntity = makeEntity({ id: 200n, legalName: 'Sucursal SA' });
  const selected = selectOrderReceiverLegalEntity({
    client: { legalEntity: clientEntity },
    clientStore: { legalEntity: storeEntity },
  });

  assert.strictEqual(selected.sourceType, 'CLIENT_STORE_LEGAL_ENTITY');
  assert.strictEqual(selected.entity.id, 200n);
});

test('resolveOrderReceiverFiscalData: VERIFIED entity with no returned activities → ACTIVITIES_MISSING', async () => {
  const order = makeOrderWithLegalEntity();
  const entity = makeEntity();
  const acts = [makeActivity({ isCurrentlyReturned: false })];
  const db = makeMockDb(entity, acts);

  const result = await resolveOrderReceiverFiscalData(order, 42n, db);
  assert.strictEqual(result.state, 'ACTIVITIES_MISSING');
  assert.deepStrictEqual(result.eligibleActivities, []);
});

test('resolveOrderReceiverFiscalData: UNVERIFIED entity → UNVERIFIED', async () => {
  const entity = makeEntity({ verificationStatus: 'UNVERIFIED' });
  const order = {
    id: 10n, companyId: 42n,
    client: { id: 1n, legalEntity: entity },
    clientStore: null,
  };
  const db = makeMockDb(entity, []);

  const result = await resolveOrderReceiverFiscalData(order, 42n, db);
  assert.strictEqual(result.state, 'UNVERIFIED');
});

test('resolveOrderReceiverFiscalData: does not call Hacienda (mock db has no Hacienda method)', async () => {
  // If Hacienda were called, the test would throw because there's no hacienda method on db
  const order = makeOrderWithLegalEntity();
  const entity = makeEntity();
  const db = makeMockDb(entity, [makeActivity()]);
  // Would throw if any live Hacienda fetch attempt was made
  const result = await resolveOrderReceiverFiscalData(order, 42n, db);
  assert.strictEqual(result.state, 'READY', 'Must resolve without Hacienda');
});

test('resolveOrderReceiverFiscalData: does not mutate entity or activities', async () => {
  const order = makeOrderWithLegalEntity();
  const entity = makeEntity();
  const originalStatus = entity.verificationStatus;
  const acts = [makeActivity()];
  const db = makeMockDb(entity, acts);

  await resolveOrderReceiverFiscalData(order, 42n, db);

  assert.strictEqual(entity.verificationStatus, originalStatus, 'entity must not be mutated');
  assert.strictEqual(acts[0].isCurrentlyReturned, true, 'activities must not be mutated');
});
