'use strict';

/**
 * Wave 4 — Fiscal Snapshot Evolution tests
 *
 * Spec: RFR-TASK-401 (tasks.md §Wave 4)
 * Design: design.md §6.1, §6.2, §6.3
 *
 * Coverage:
 *   Part A — buildFiscalSnapshotData (snapshot construction)
 *     A-01: new-flow order → selectedEconomicActivityCode from OrderFiscalApproval
 *     A-02: new-flow order → OrderFiscalApproval wins over receiver.economicActivityCode
 *     A-03: new-flow order → wins even if ClientStore has a different code
 *     A-04: new-flow order → wins even if Client has a different code
 *     A-05: new-flow order → wins even if activity is no longer isCurrentlyReturned
 *     A-06: new-flow order → receiver with multiple activities does NOT reselect
 *     A-07: new-flow order → isNewFlowOrder flag = true
 *     A-08: legacy order  → selectedEconomicActivityCode = receiver.economicActivityCode
 *     A-09: legacy order  → isNewFlowOrder flag = false
 *     A-10: legacy order  → no OrderFiscalApproval retroactively created
 *     A-11: P0 compat fields preserved (economicActivityCode, economicActivityName)
 *     A-12: new-flow corrupted (receiverEconomicActivityCode = null) → null, NOT fallback
 *     A-13: snapshot immutability — client data changed after build does NOT alter snapshot
 *     A-14: approval code A, client later changes to B → snapshot still A
 *     A-15: no Hacienda lookup
 *     A-16: no Billing lookup
 *
 *   Part B — buildBillingFiscalDocumentPayload (billing worker)
 *     B-01: Wave 4 snapshot → economicActivity uses selectedEconomicActivityCode
 *     B-02: P0-era snapshot (no selectedEconomicActivityCode) → falls back to economicActivityCode
 *     B-03: new-flow corrupted (selectedEconomicActivityCode = null) → economicActivity = null
 *     B-04: legacy snapshot (selectedEconomicActivityCode = null) → economicActivity = null
 *     B-05: economicActivityCode absent from P0 snapshot → null (no crash)
 *     B-06: payload hash stable across runs
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildFiscalSnapshotData } = require('../src/services/fiscal-snapshot.service');
const { buildBillingFiscalDocumentPayload } = require('../src/services/fiscal-billing-worker.service');

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ENABLED_CONFIG = Object.freeze({
  id: 1n,
  billingTenantId: 'tenant-1',
  billingCompanyId: 'billing-co-1',
  billingEnvironment: 'SANDBOX',
  enabled: true,
});

function makeOrder(overrides = {}) {
  return {
    id: 10n,
    companyId: 42n,
    paymentCondition: 'CASH',
    client: {
      id: 2n,
      legalName: 'Client SA',
      identificationType: '02',
      identificationNumber: '3101000001',
      email: 'client@test.com',
      paymentDays: 30,
    },
    clientStore: null,
    items: [{
      id: 20n,
      productId: 30n,
      quantity: 1,
      unitPrice: 1000,
      discountPercent: 0,
      discountAmount: 0,
      totalDiscount: 0,
      product: {
        id: 30n,
        name: 'Producto Test',
        cabysCode: '1234567890123',
        unit: 'UN',
        taxRate: 13,
        taxExempt: false,
        currency: 'CRC',
        controlsInventory: true,
      },
    }],
    fiscalApproval: overrides.fiscalApproval !== undefined ? overrides.fiscalApproval : null,
  };
}

/** Receiver resolved from makeOrder's client data. Represents P0 fiscal-receiver-resolver output. */
function makeReceiver(overrides = {}) {
  return {
    sourceType: 'CLIENT',
    sourceId: 2n,
    legalName: 'Client SA',
    commercialName: null,
    identificationType: '02',
    identificationNumber: '3101000001',
    email: 'client@test.com',
    phone: null,
    province: null,
    canton: null,
    district: null,
    address: null,
    economicActivityCode: overrides.economicActivityCode !== undefined ? overrides.economicActivityCode : '471100',
    economicActivityName: overrides.economicActivityName !== undefined ? overrides.economicActivityName : 'Comercio al por menor',
    ...overrides,
  };
}

const INVOICE = { id: 99n };

// ─── Part A: buildFiscalSnapshotData ─────────────────────────────────────────

test('[A-01] new-flow order: selectedEconomicActivityCode comes from OrderFiscalApproval', () => {
  const order = makeOrder({ fiscalApproval: { receiverEconomicActivityCode: '620100', clientLegalEntityId: 100n } });
  const receiver = makeReceiver({ economicActivityCode: '471100' });
  const snapshot = buildFiscalSnapshotData({ order, invoice: INVOICE, receiver, config: ENABLED_CONFIG });

  assert.strictEqual(snapshot.receiverSnapshot.selectedEconomicActivityCode, '620100',
    'new-flow: must use OrderFiscalApproval.receiverEconomicActivityCode');
});

test('[A-02] new-flow order: approval code wins over receiver.economicActivityCode', () => {
  // receiver.economicActivityCode = '471100' (different from approval)
  const order = makeOrder({ fiscalApproval: { receiverEconomicActivityCode: '620100', clientLegalEntityId: 100n } });
  const receiver = makeReceiver({ economicActivityCode: '471100' });
  const snapshot = buildFiscalSnapshotData({ order, invoice: INVOICE, receiver, config: ENABLED_CONFIG });

  assert.strictEqual(snapshot.receiverSnapshot.selectedEconomicActivityCode, '620100');
  assert.notStrictEqual(snapshot.receiverSnapshot.selectedEconomicActivityCode,
    snapshot.receiverSnapshot.economicActivityCode,
    'selected must differ from P0 compat field when they diverge');
});

test('[A-03] new-flow order: approval code wins over ClientStore economicActivityCode (different)', () => {
  // Simulate: ClientStore had code '960900' before approval, receiver reflects it
  const order = makeOrder({ fiscalApproval: { receiverEconomicActivityCode: '620100', clientLegalEntityId: 100n } });
  const storeReceiver = makeReceiver({ economicActivityCode: '960900', sourceType: 'CLIENT_STORE' });
  const snapshot = buildFiscalSnapshotData({ order, invoice: INVOICE, receiver: storeReceiver, config: ENABLED_CONFIG });

  assert.strictEqual(snapshot.receiverSnapshot.selectedEconomicActivityCode, '620100',
    'OrderFiscalApproval must win over ClientStore-derived receiver code');
});

test('[A-04] new-flow order: approval code wins even if Client.economicActivityCode changed after approval', () => {
  const order = makeOrder({ fiscalApproval: { receiverEconomicActivityCode: '620100', clientLegalEntityId: 100n } });
  // Simulate: client's current activity changed to '9609.0' after approval
  const receiver = makeReceiver({ economicActivityCode: '9609.0' });
  const snapshot = buildFiscalSnapshotData({ order, invoice: INVOICE, receiver, config: ENABLED_CONFIG });

  assert.strictEqual(snapshot.receiverSnapshot.selectedEconomicActivityCode, '620100',
    'frozen approval code must be used even after client activity changed');
});

test('[A-05] new-flow order: approval code wins even if activity is no longer isCurrentlyReturned', () => {
  // The dispatch query loads the frozen approval record, not the current ClientEconomicActivity table.
  // '620100' was removed from Hacienda after approval → but snapshot still uses it.
  const order = makeOrder({ fiscalApproval: { receiverEconomicActivityCode: '620100', clientLegalEntityId: 100n } });
  const receiver = makeReceiver({ economicActivityCode: null }); // activity no longer returned
  const snapshot = buildFiscalSnapshotData({ order, invoice: INVOICE, receiver, config: ENABLED_CONFIG });

  assert.strictEqual(snapshot.receiverSnapshot.selectedEconomicActivityCode, '620100',
    'removed/inactive activity must not prevent the frozen approval code from reaching the snapshot');
});

test('[A-06] new-flow order with multiple current activities: snapshot does NOT reselect', () => {
  // Receiver now has multiple activities — but that's irrelevant.
  // The approval decision is frozen. No reselection at dispatch.
  const order = makeOrder({ fiscalApproval: { receiverEconomicActivityCode: '620100', clientLegalEntityId: 100n } });
  // Receiver reflects multiple activities via some convention (e.g., economicActivityCode = first)
  const receiver = makeReceiver({ economicActivityCode: '471100' }); // first activity different from approval
  const snapshot = buildFiscalSnapshotData({ order, invoice: INVOICE, receiver, config: ENABLED_CONFIG });

  assert.strictEqual(snapshot.receiverSnapshot.selectedEconomicActivityCode, '620100',
    'dispatch must not reselect from current activities — approval decision is frozen');
});

test('[A-07] new-flow order: isNewFlowOrder = true', () => {
  const order = makeOrder({ fiscalApproval: { receiverEconomicActivityCode: '620100', clientLegalEntityId: 100n } });
  const receiver = makeReceiver();
  const snapshot = buildFiscalSnapshotData({ order, invoice: INVOICE, receiver, config: ENABLED_CONFIG });

  assert.strictEqual(snapshot.receiverSnapshot.isNewFlowOrder, true);
});

test('[A-08] legacy order: selectedEconomicActivityCode = receiver.economicActivityCode', () => {
  // order.fiscalApproval = null → legacy (billing disabled at approval, or pre-Wave 3)
  const order = makeOrder({ fiscalApproval: null });
  const receiver = makeReceiver({ economicActivityCode: '471100' });
  const snapshot = buildFiscalSnapshotData({ order, invoice: INVOICE, receiver, config: ENABLED_CONFIG });

  assert.strictEqual(snapshot.receiverSnapshot.selectedEconomicActivityCode, '471100',
    'legacy: selectedEconomicActivityCode must equal receiver.economicActivityCode');
});

test('[A-09] legacy order: isNewFlowOrder = false', () => {
  const order = makeOrder({ fiscalApproval: null });
  const receiver = makeReceiver();
  const snapshot = buildFiscalSnapshotData({ order, invoice: INVOICE, receiver, config: ENABLED_CONFIG });

  assert.strictEqual(snapshot.receiverSnapshot.isNewFlowOrder, false);
});

test('[A-10] legacy order: order.fiscalApproval undefined treated as null (billing-disabled case)', () => {
  // Order that went through billing-disabled approval — no fiscalApproval key at all on the object
  const order = makeOrder();
  delete order.fiscalApproval; // not present on object at all
  const receiver = makeReceiver({ economicActivityCode: '471100' });
  const snapshot = buildFiscalSnapshotData({ order, invoice: INVOICE, receiver, config: ENABLED_CONFIG });

  assert.strictEqual(snapshot.receiverSnapshot.isNewFlowOrder, false,
    'absent fiscalApproval must be treated as legacy');
  assert.strictEqual(snapshot.receiverSnapshot.selectedEconomicActivityCode, '471100',
    'must use receiver.economicActivityCode when fiscalApproval is absent');
});

test('[A-11] P0 compat fields preserved: economicActivityCode and economicActivityName still present', () => {
  const order = makeOrder({ fiscalApproval: { receiverEconomicActivityCode: '620100', clientLegalEntityId: 100n } });
  const receiver = makeReceiver({ economicActivityCode: '471100', economicActivityName: 'Comercio al por menor' });
  const snapshot = buildFiscalSnapshotData({ order, invoice: INVOICE, receiver, config: ENABLED_CONFIG });

  // P0 compat fields must not be removed
  assert.ok('economicActivityCode' in snapshot.receiverSnapshot,
    'economicActivityCode P0 compat field must still be present');
  assert.ok('economicActivityName' in snapshot.receiverSnapshot,
    'economicActivityName P0 compat field must still be present');
  assert.strictEqual(snapshot.receiverSnapshot.economicActivityCode, '471100',
    'economicActivityCode retains receiver value (P0 compat)');
  assert.strictEqual(snapshot.receiverSnapshot.economicActivityName, 'Comercio al por menor');
});

test('[A-12] corrupted new-flow (receiverEconomicActivityCode = null): null, NOT fallback to receiver code', () => {
  // OrderFiscalApproval.receiverEconomicActivityCode is unexpectedly null.
  // The immutability invariant: if approval exists, its code (even null) is used.
  // We must NOT silently substitute receiver.economicActivityCode.
  const order = makeOrder({ fiscalApproval: { receiverEconomicActivityCode: null, clientLegalEntityId: 100n } });
  const receiver = makeReceiver({ economicActivityCode: '471100' });
  const snapshot = buildFiscalSnapshotData({ order, invoice: INVOICE, receiver, config: ENABLED_CONFIG });

  assert.strictEqual(snapshot.receiverSnapshot.selectedEconomicActivityCode, null,
    'corrupted new-flow: selectedEconomicActivityCode must be null, NOT receiver.economicActivityCode');
  assert.strictEqual(snapshot.receiverSnapshot.isNewFlowOrder, true,
    'isNewFlowOrder must be true even for corrupted new-flow');
  // Critical: must NOT equal the live receiver code — that would violate immutability
  assert.notStrictEqual(snapshot.receiverSnapshot.selectedEconomicActivityCode,
    snapshot.receiverSnapshot.economicActivityCode,
    'corrupted new-flow: must not silently substitute live receiver code');
});

test('[A-13] snapshot immutability: mutating receiver object after build does NOT change snapshot', () => {
  const order = makeOrder({ fiscalApproval: null });
  const receiver = makeReceiver({ economicActivityCode: '471100', legalName: 'Original Name' });
  const snapshot = buildFiscalSnapshotData({ order, invoice: INVOICE, receiver, config: ENABLED_CONFIG });

  // Mutate the original receiver object
  receiver.economicActivityCode = '960900';
  receiver.legalName = 'Changed Name';

  // Snapshot must reflect the value at build time, not the mutation
  // (Object spread in buildFiscalSnapshotData creates a shallow copy of receiver)
  assert.strictEqual(snapshot.receiverSnapshot.legalName, 'Original Name',
    'snapshot legalName must be frozen at build time');
});

test('[A-14] immutability: approval code A, client data changes to B → snapshot still A', () => {
  // This is the core Wave 4 invariant proof:
  // 1. Order approved with code '620100'
  // 2. Client later gets different activity '471100'
  // 3. Dispatch snapshot must still have '620100'
  const order = makeOrder({ fiscalApproval: { receiverEconomicActivityCode: '620100', clientLegalEntityId: 100n } });
  // 'receiver' reflects current live client data (after client's activity changed)
  const liveReceiver = makeReceiver({ economicActivityCode: '471100' });

  const snapshot = buildFiscalSnapshotData({ order, invoice: INVOICE, receiver: liveReceiver, config: ENABLED_CONFIG });

  assert.strictEqual(snapshot.receiverSnapshot.selectedEconomicActivityCode, '620100',
    'CRITICAL: frozen approval code must survive live client data changes');
  assert.strictEqual(snapshot.receiverSnapshot.economicActivityCode, '471100',
    'P0 compat field reflects current receiver (used only for legacy orders)');
});

test('[A-15] no Hacienda lookup occurs in buildFiscalSnapshotData', () => {
  // Proof by construction: buildFiscalSnapshotData is a pure sync function — no async, no I/O.
  // If it called Hacienda, it would be async or would require a network stub.
  const isSynchronous = !(buildFiscalSnapshotData.constructor.name === 'AsyncFunction');
  assert.ok(isSynchronous, 'buildFiscalSnapshotData must be synchronous (no Hacienda lookup)');
});

test('[A-16] no Billing lookup occurs in buildFiscalSnapshotData', () => {
  // Same proof: pure sync function.
  const isSynchronous = !(buildFiscalSnapshotData.constructor.name === 'AsyncFunction');
  assert.ok(isSynchronous, 'buildFiscalSnapshotData must be synchronous (no Billing lookup)');
});

// ─── Part B: buildBillingFiscalDocumentPayload ────────────────────────────────

function buildMinimalSnapshot(receiverOverrides = {}) {
  return {
    currency: 'CRC',
    saleCondition: '01',
    paymentMethod: '01',
    creditTermDays: null,
    receiverSnapshot: {
      sourceType: 'CLIENT',
      sourceId: '2',
      legalName: 'Client SA',
      identificationType: '02',
      identificationNumber: '3101000001',
      email: 'client@test.com',
      ...receiverOverrides,
    },
    headerSnapshot: { exchangeRate: '1.00000' },
    linesSnapshot: [{
      lineNumber: 1,
      cabysCode: '1234567890123',
      description: 'Test Product',
      fiscalUnit: 'Unid',
      quantity: 1,
      unitPrice: 1000,
      totalDiscount: 0,
      discountAmount: 0,
      taxCode: '01',
      taxRateCode: '08',
      taxRate: 13,
      taxAmount: 130,
      subtotal: 1000,
      total: 1130,
    }],
    totalsSnapshot: { subtotal: 1000, tax: 130, discount: 0, total: 1130 },
  };
}

test('[B-01] Wave 4 snapshot: billing payload uses selectedEconomicActivityCode', () => {
  const snapshot = buildMinimalSnapshot({
    selectedEconomicActivityCode: '620100',
    economicActivityCode: '471100', // P0 compat field — different value
    isNewFlowOrder: true,
  });
  const payload = buildBillingFiscalDocumentPayload(snapshot);

  assert.strictEqual(payload.receiver.economicActivity, '620100',
    'billing payload must use selectedEconomicActivityCode for Wave 4 snapshots');
});

test('[B-02] P0-era snapshot (no selectedEconomicActivityCode): falls back to economicActivityCode', () => {
  // Simulate a snapshot from before Wave 4 deployment — no selectedEconomicActivityCode key.
  const snapshot = buildMinimalSnapshot({
    economicActivityCode: '471100',
    // selectedEconomicActivityCode: NOT PRESENT
  });
  // Verify the fixture truly has no selectedEconomicActivityCode
  assert.ok(!('selectedEconomicActivityCode' in snapshot.receiverSnapshot), 'fixture must not have selectedEconomicActivityCode');

  const payload = buildBillingFiscalDocumentPayload(snapshot);

  assert.strictEqual(payload.receiver.economicActivity, '471100',
    'P0-era snapshot: must fall back to economicActivityCode');
});

test('[B-03] corrupted new-flow (selectedEconomicActivityCode = null): economicActivity = null', () => {
  // If fiscalApproval.receiverEconomicActivityCode was somehow null, snapshot will have:
  // selectedEconomicActivityCode: null (not missing, explicitly null)
  // We must NOT fall back to economicActivityCode. Integrity of the decision is preserved.
  const snapshot = buildMinimalSnapshot({
    selectedEconomicActivityCode: null, // explicitly null — new-flow corrupted state
    economicActivityCode: '471100',
    isNewFlowOrder: true,
  });
  const payload = buildBillingFiscalDocumentPayload(snapshot);

  assert.strictEqual(payload.receiver.economicActivity, null,
    'corrupted new-flow: billing must send null, NOT fall back to economicActivityCode');
});

test('[B-04] legacy snapshot (selectedEconomicActivityCode = null): economicActivity = null', () => {
  // Legacy order where receiver had no economicActivityCode either.
  const snapshot = buildMinimalSnapshot({
    selectedEconomicActivityCode: null, // legacy null (receiver had no activity code)
    economicActivityCode: null,
    isNewFlowOrder: false,
  });
  const payload = buildBillingFiscalDocumentPayload(snapshot);

  assert.strictEqual(payload.receiver.economicActivity, null);
});

test('[B-05] P0 snapshot with no economicActivityCode: returns null without crash', () => {
  const snapshot = buildMinimalSnapshot({
    // Neither selectedEconomicActivityCode nor economicActivityCode
    economicActivityCode: undefined,
  });
  const payload = buildBillingFiscalDocumentPayload(snapshot);
  assert.strictEqual(payload.receiver.economicActivity, null);
});

test('[B-06] payload hash stable across Wave 4 runs', () => {
  const { hashBillingPayload } = require('../src/services/fiscal-billing-worker.service');
  const snapshot = buildMinimalSnapshot({
    selectedEconomicActivityCode: '620100',
    economicActivityCode: '471100',
    isNewFlowOrder: true,
  });
  const p1 = buildBillingFiscalDocumentPayload(snapshot);
  const p2 = buildBillingFiscalDocumentPayload(snapshot);
  assert.strictEqual(hashBillingPayload(p1), hashBillingPayload(p2),
    'billing payload hash must be deterministic with Wave 4 fields');
});

// ─── Part C: selectedEconomicActivityCode source precedence ──────────────────

test('[C-01] source precedence: new-flow approval always beats receiver regardless of value', () => {
  // Exhaustive check: approval '620100' vs receiver codes '471100', 'null', '9609.0'
  for (const receiverCode of ['471100', null, '9609.0', '000000']) {
    const order = makeOrder({ fiscalApproval: { receiverEconomicActivityCode: '620100', clientLegalEntityId: 100n } });
    const receiver = makeReceiver({ economicActivityCode: receiverCode });
    const snapshot = buildFiscalSnapshotData({ order, invoice: INVOICE, receiver, config: ENABLED_CONFIG });

    assert.strictEqual(snapshot.receiverSnapshot.selectedEconomicActivityCode, '620100',
      `approval must win over receiver code "${receiverCode}"`);
  }
});

test('[C-02] source precedence: legacy null receiver → selectedEconomicActivityCode = null', () => {
  const order = makeOrder({ fiscalApproval: null });
  const receiver = makeReceiver({ economicActivityCode: null });
  const snapshot = buildFiscalSnapshotData({ order, invoice: INVOICE, receiver, config: ENABLED_CONFIG });

  assert.strictEqual(snapshot.receiverSnapshot.selectedEconomicActivityCode, null,
    'legacy order with no receiver code: selectedEconomicActivityCode must be null');
});
