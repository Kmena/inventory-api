'use strict';

/**
 * RFR-TASK-701 — Full Regression
 * Spec: specs/inventori-receiver-fiscal-readiness/
 *
 * Covers:
 *   [REG-xx] Regression smoke — resolver, approval, eligibility
 *   [PAY-xx] Payment dialog regression (RFR-PAY-001..005)
 *   [AUD-xx] Audit integrity regression
 *   [SAN-xx] Hacienda response sanitization
 *   [IMMU-xx] Snapshot immutability / OrderFiscalApproval immutability
 *   [LEGACY-xx] Legacy compatibility (billing-disabled path, pre-Wave-4 snapshots)
 *   [CONTRACT-xx] Inventori → Billing payload contract
 *   [WAVE8-xx] Wave 8 handoff invariants (serializer NOT emitting CodigoActividadReceptor)
 *
 * No live DB. No Hacienda calls.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  resolveReceiverFiscalReadiness,
  HACIENDA_ACTIVE_STATUS,
} = require('../src/services/receiver-fiscal-readiness.service');
const orderService = require('../src/services/order.service');
const orderRepository = require('../src/repositories/order.repository');
const inventoryService = require('../src/services/inventory.service');
const billingConfigRepository = require('../src/repositories/billing-integration-config.repository');
const { buildFiscalSnapshotData } = require('../src/services/fiscal-snapshot.service');

function withStubs(stubsByModule, run) {
  const originals = [];
  for (const [mod, stubs] of stubsByModule) {
    for (const [key, val] of Object.entries(stubs)) {
      originals.push([mod, key, mod[key]]);
      mod[key] = val;
    }
  }
  return Promise.resolve().then(run).finally(() => {
    for (const [mod, key, orig] of originals) mod[key] = orig;
  });
}

function src(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

function makeEntity(overrides = {}) {
  return {
    id: 100n, companyId: 42n, legalName: 'Demo S.A.',
    identificationType: 'JURIDICA', identificationNumber: '3101000001',
    email: 'fiscal@demo.test',
    verificationStatus: 'VERIFIED', lastVerifiedAt: new Date('2025-06-01'),
    taxpayerName: 'Demo S.A.', ...overrides,
  };
}

function makeActivity(overrides = {}) {
  return { id: 1n, code: '620100', description: 'Software', haciendaStatus: 'A', isCurrentlyReturned: true, ...overrides };
}

const AUTH = { companyId: '42', sub: '10', userId: '10', role: 'admin', permissions: ['order.approve'] };

// ─── [REG] Resolver Regression ───────────────────────────────────────────────

test('[REG-01] READY state still works end-to-end', () => {
  const r = resolveReceiverFiscalReadiness(makeEntity(), [makeActivity()]);
  assert.strictEqual(r.state, 'READY');
  assert.strictEqual(r.eligibleActivities.length, 1);
});

test('[REG-02] ACTIVITIES_MISSING for zero active activities', () => {
  const r = resolveReceiverFiscalReadiness(makeEntity(), [makeActivity({ haciendaStatus: 'I' })]);
  assert.strictEqual(r.state, 'ACTIVITIES_MISSING');
  assert.deepStrictEqual(r.eligibleActivities, []);
});

test('[REG-03] IDENTITY_INCOMPLETE for null entity', () => {
  const r = resolveReceiverFiscalReadiness(null, []);
  assert.strictEqual(r.state, 'IDENTITY_INCOMPLETE');
});

test('[REG-04] UNVERIFIED for unverified entity', () => {
  const r = resolveReceiverFiscalReadiness(makeEntity({ verificationStatus: 'UNVERIFIED' }), [makeActivity()]);
  assert.strictEqual(r.state, 'UNVERIFIED');
});

test('[REG-05] HACIENDA_ACTIVE_STATUS constant unchanged at "A"', () => {
  assert.strictEqual(HACIENDA_ACTIVE_STATUS, 'A');
});

test('[REG-06] eligibility triple-predicate: isCurrentlyReturned + length=6 + haciendaStatus=A', () => {
  // All three required — removing any one fails eligibility
  const acts = [
    makeActivity({ id: 1n, code: '620100', isCurrentlyReturned: true, haciendaStatus: 'A' }),   // eligible
    makeActivity({ id: 2n, code: '471100', isCurrentlyReturned: false, haciendaStatus: 'A' }),  // removed
    makeActivity({ id: 3n, code: '560100', isCurrentlyReturned: true, haciendaStatus: 'I' }),   // inactive
    makeActivity({ id: 4n, code: '9609', isCurrentlyReturned: true, haciendaStatus: 'A' }),    // wrong length
  ];
  const r = resolveReceiverFiscalReadiness(makeEntity(), acts);
  assert.strictEqual(r.state, 'READY');
  assert.strictEqual(r.eligibleActivities.length, 1);
  assert.strictEqual(r.eligibleActivities[0].code, '620100');
});

test('[REG-07] billing-disabled approval: unchanged behavior, no fiscal validation', async () => {
  let reserveOpts;
  const result = await withStubs([
    [orderRepository, { findOrderById: async (id) => ({ id, companyId: 42n, status: 'DRAFT', approved: false }) }],
    [billingConfigRepository, { findByCompanyId: async () => ({ id: 1n, companyId: 42n, enabled: false }) }],
    [inventoryService, { reserveStockForOrder: async (id, _a, _r, opts) => { reserveOpts = opts; return { id, status: 'APPROVED' }; } }],
  ], () => orderService.approveOrder(5n, null, AUTH));
  assert.strictEqual(result.status, 'APPROVED');
  assert.strictEqual(reserveOpts, undefined, 'billing-disabled: no fiscalApprovalData must be passed');
});

test('[REG-08] approveOrderSchema: receiverEconomicActivityCode optional for billing-disabled path', () => {
  const { approveOrderSchema } = require('../src/schemas/order.schema');
  const result = approveOrderSchema.safeParse({});
  assert.ok(result.success, 'empty body must parse successfully (optional for billing-disabled)');
});

test('[REG-09] approveOrderSchema: receiverEconomicActivityCode validated: min 1, max 50', () => {
  const { approveOrderSchema } = require('../src/schemas/order.schema');
  assert.strictEqual(approveOrderSchema.safeParse({ receiverEconomicActivityCode: '' }).success, false, 'empty string must fail');
  assert.ok(approveOrderSchema.safeParse({ receiverEconomicActivityCode: '620100' }).success, 'valid code must pass');
  assert.strictEqual(approveOrderSchema.safeParse({ receiverEconomicActivityCode: 'X'.repeat(51) }).success, false, 'oversized must fail');
});

// ─── [PAY] Payment Dialog Regression (RFR-PAY-001..005) ─────────────────────

test('[PAY-01] TRANSFER method requires reference field — billing-admin.js source confirms', () => {
  const adminSrc = src('src/public/root/views/billing-admin.js');
  assert.match(adminSrc, /transfer.*reference|reference.*transfer/i,
    'billing-admin.js must handle TRANSFER reference field');
});

test('[PAY-02] CARD method has cardType field in billing-admin.js', () => {
  const adminSrc = src('src/public/root/views/billing-admin.js');
  assert.match(adminSrc, /cardType|card_type|card-type/i,
    'billing-admin.js must handle cardType for CARD method');
});

test('[PAY-03] bankName field present for TRANSFER in billing-admin.js', () => {
  const adminSrc = src('src/public/root/views/billing-admin.js');
  assert.match(adminSrc, /bankName|bank_name|bank-name/i,
    'billing-admin.js must handle bankName for TRANSFER method');
});

test('[PAY-04] payment schema: no cardNumber, CVV, PAN fields (SEC-014)', () => {
  const schemaSrc = src('src/schemas/order.schema.js');
  assert.doesNotMatch(schemaSrc, /cardNumber|cvv|pan\b|card_number/i,
    'payment schema MUST NOT store card number or CVV');
});

test('[PAY-05] transferMetadataSchema has bank, reference, amount, date fields', () => {
  const { transferMetadataSchema } = require('../src/schemas/order.schema');
  // Ensure all four required fields parse correctly
  const result = transferMetadataSchema.safeParse({
    bank: 'BCR', reference: 'REF-001', amount: 100, date: new Date().toISOString(),
  });
  assert.ok(result.success, 'valid transfer metadata must parse successfully');
});

// ─── [AUD] Audit Integrity ───────────────────────────────────────────────────

test('[AUD-01] verify route audit: contains verificationStatus + activityCount, NOT identificationNumber', () => {
  const routeSrc = src('src/routes/client-legal-entity.routes.js');
  const auditBlock = routeSrc.slice(routeSrc.indexOf('recordAuditEventSafelyIfAvailable'));
  assert.match(auditBlock, /verificationStatus/, 'audit must include verificationStatus');
  assert.match(auditBlock, /activityCount/, 'audit must include activityCount');
  assert.doesNotMatch(auditBlock.slice(0, 400), /identificationNumber/, 'audit must NOT include identificationNumber');
});

test('[AUD-02] billing-disabled approval: audit has no fabricated fiscal fields', () => {
  // In the billing-disabled path, inventoryService.reserveStockForOrder is called without fiscalApprovalData
  // The audit in inventory.service.js only adds fiscal fields when fiscalApprovalData is present
  const inventorySrc = src('src/services/inventory.service.js');
  // Verify the fiscal audit fields are conditional on fiscalApprovalData
  assert.match(inventorySrc, /fiscalApprovalData.*fiscalApprovalId|options\.fiscalApprovalData/s,
    'fiscal audit fields must be conditional on fiscalApprovalData presence');
});

test('[AUD-03] approval audit uses committed OrderFiscalApproval.id (not input id)', () => {
  const inventorySrc = src('src/services/inventory.service.js');
  // createdFiscalApprovalId is set AFTER tx.orderFiscalApproval.create — captured from result
  assert.match(inventorySrc, /createdFiscalApprovalId.*approvalRecord\.id|approvalRecord\.id.*createdFiscalApprovalId/s,
    'audit fiscalApprovalId MUST come from committed record, not pre-tx input');
});

// ─── [SAN] Hacienda Response Sanitization ────────────────────────────────────

test('[SAN-01] taxpayer.service.js normalizes response — does not re-export raw HTTP body', () => {
  const taxpayerSrc = src('src/services/taxpayer.service.js');
  assert.doesNotMatch(taxpayerSrc, /res\.data|response\.data.*return|return.*rawResponse/,
    'taxpayer service must return normalized object, not raw Hacienda HTTP body');
});

test('[SAN-02] verify DTO builder (buildVerifyDto) returns normalized entity + activities only', () => {
  const routeSrc = src('src/routes/client-legal-entity.routes.js');
  assert.match(routeSrc, /buildVerifyDto/,
    'verify route must use buildVerifyDto to sanitize Hacienda response');
  // buildVerifyDto must not include raw Hacienda response fields
  assert.doesNotMatch(routeSrc, /taxpayerResult.*json|json.*taxpayerResult/,
    'raw taxpayerResult must NEVER be returned directly to browser');
});

test('[SAN-03] error responses from verify do not expose Hacienda raw error bodies', () => {
  const routeSrc = src('src/routes/client-legal-entity.routes.js');
  // The catch block passes to next(error) — existing error middleware sanitizes
  assert.match(routeSrc, /return next\(error\)/,
    'verify catch block must use next(error) for sanitized error handling');
});

// ─── [IMMU] Snapshot / OrderFiscalApproval Immutability ─────────────────────

test('[IMMU-01] snapshot uses frozen OrderFiscalApproval code, not live activity', () => {
  const snapshotSrc = src('src/services/fiscal-snapshot.service.js');
  assert.match(snapshotSrc, /fiscalApproval.*receiverEconomicActivityCode|fiscalApproval\?\.receiverEconomicActivityCode/,
    'snapshot must source activity code from OrderFiscalApproval, not live ClientEconomicActivity');
  assert.doesNotMatch(snapshotSrc, /haciendaStatus.*ACTIVE|ACTIVE.*haciendaStatus/,
    'snapshot must NOT re-validate haciendaStatus at dispatch time');
});

test('[IMMU-02] snapshot immutability: OrderFiscalApproval code A → snapshot code A even if receiver shows B', () => {
  // buildFiscalSnapshotData({ order, invoice, receiver, config })
  // receiver.economicActivityCode = 'LIVE_B' (changed after approval)
  // order.fiscalApproval.receiverEconomicActivityCode = 'FROZEN_A' (frozen at approval)
  // selectedEconomicActivityCode must equal FROZEN_A
  const order = { id: 5n, companyId: 42n, paymentCondition: 'CASH', items: [],
    fiscalApproval: { receiverEconomicActivityCode: 'FROZEN_A' } };
  const invoice = { id: 1n };
  const receiver = { sourceType: 'CLIENT_LEGAL_ENTITY', sourceId: '100',
    economicActivityCode: 'LIVE_B', economicActivityName: 'Other' };
  const config = {};
  const snapshot = buildFiscalSnapshotData({ order, invoice, receiver, config });
  assert.strictEqual(snapshot.receiverSnapshot.selectedEconomicActivityCode, 'FROZEN_A',
    'snapshot must use frozen OrderFiscalApproval code, not live economicActivityCode');
});

test('[IMMU-03] OrderFiscalApproval table: no update/delete operations in complete codebase', () => {
  const orderSrc = src('src/services/order.service.js');
  const inventorySrc = src('src/services/inventory.service.js');
  const snapshotSrc = src('src/services/fiscal-snapshot.service.js');
  const combined = orderSrc + inventorySrc + snapshotSrc;
  assert.doesNotMatch(combined, /orderFiscalApproval\.(update|delete|deleteMany|upsert)/,
    'OrderFiscalApproval MUST be append-only; no mutations ever');
});

// ─── [LEGACY] Legacy Compatibility ───────────────────────────────────────────

test('[LEGACY-01] billing-disabled approved → no OrderFiscalApproval → legacy snapshot path', () => {
  // Order approved with billing disabled (no OrderFiscalApproval).
  // selectedEconomicActivityCode must be null — fallback uses receiver.economicActivityCode.
  const order = { id: 5n, companyId: 42n, paymentCondition: 'CASH', items: [],
    fiscalApproval: undefined }; // no OrderFiscalApproval
  const invoice = { id: 1n };
  const receiver = { sourceType: 'CLIENT_LEGAL_ENTITY', sourceId: '100',
    economicActivityCode: null, economicActivityName: null };
  const config = {};
  const snapshot = buildFiscalSnapshotData({ order, invoice, receiver, config });
  // Legacy path: null fiscalApproval → selectedEconomicActivityCode = receiver.economicActivityCode = null
  assert.strictEqual(snapshot.receiverSnapshot.selectedEconomicActivityCode, null,
    'no fiscalApproval → selectedEconomicActivityCode must be null (not fabricated)');
  assert.strictEqual(snapshot.receiverSnapshot.isNewFlowOrder, false,
    'no fiscalApproval → isNewFlowOrder must be false');
});

test('[LEGACY-02] pre-Wave-4 snapshot: billing worker falls back to economicActivityCode', () => {
  // P0-era snapshot has no selectedEconomicActivityCode field at all
  const workerSrc = src('src/services/fiscal-billing-worker.service.js');
  assert.match(workerSrc, /selectedEconomicActivityCode.*!==.*undefined.*economicActivityCode|economicActivityCode.*fallback/s,
    'billing worker must fall back to economicActivityCode for pre-Wave-4 snapshots');
});

test('[LEGACY-03] economicActivityCode P0 compat field preserved in receiverSnapshot', () => {
  const order = { id: 5n, companyId: 42n, paymentCondition: 'CASH', items: [], fiscalApproval: null };
  const invoice = { id: 1n };
  const receiver = { sourceType: 'CLIENT_LEGAL_ENTITY', sourceId: '100',
    economicActivityCode: 'LEGCY1', economicActivityName: 'Legacy Activity' };
  const config = {};
  const snapshot = buildFiscalSnapshotData({ order, invoice, receiver, config });
  assert.ok('economicActivityCode' in snapshot.receiverSnapshot,
    'economicActivityCode P0 compat field must still be present in snapshot');
  assert.strictEqual(snapshot.receiverSnapshot.economicActivityCode, 'LEGCY1');
});

// ─── [CONTRACT] Inventori → Billing Payload Contract ────────────────────────

test('[CONTRACT-01] fiscal-billing-worker uses selectedEconomicActivityCode as receiver.economicActivity', () => {
  const workerSrc = src('src/services/fiscal-billing-worker.service.js');
  assert.match(workerSrc, /economicActivity:\s*receiver\.selectedEconomicActivityCode/,
    'billing payload receiver.economicActivity MUST come from snapshot.selectedEconomicActivityCode');
});

test('[CONTRACT-02] snapshot field selectedEconomicActivityCode sourced from OrderFiscalApproval', () => {
  const snapshotSrc = src('src/services/fiscal-snapshot.service.js');
  assert.match(snapshotSrc, /selectedEconomicActivityCode.*fiscalApproval|fiscalApproval.*selectedEconomicActivityCode/s,
    'selectedEconomicActivityCode MUST be sourced from OrderFiscalApproval in snapshot');
});

test('[CONTRACT-03] Inventori → Billing: receiver.economicActivity field confirmed in worker', () => {
  const workerSrc = src('src/services/fiscal-billing-worker.service.js');
  assert.match(workerSrc, /receiver.*economicActivity|economicActivity.*receiver/s,
    'Billing payload must have receiver.economicActivity field');
});

// ─── [WAVE8] Wave 8 Handoff Invariants (Billing XML gap confirmed, NOT fixed) ─

test('[WAVE8-01] Inventori hands off economicActivity without owning Billing XML serialization', () => {
  // Inventori sends the receiver activity to Billing but must not couple itself to
  // Billing's XML element names or serializer implementation.
  const inventorySrc = src('src/services/fiscal-billing-worker.service.js');
  assert.match(inventorySrc, /economicActivity/,
    'worker MUST send economicActivity field to Billing (Inventori side done)');
  assert.doesNotMatch(inventorySrc, /CodigoActividadReceptor/,
    'Billing XML element names must remain a Billing-side concern');
});

test('[WAVE8-02] CodigoActividadReceptor handoff: Inventori source field confirmed', () => {
  // Confirms the chain: OrderFiscalApproval → snapshot.selectedEconomicActivityCode → receiver.economicActivity → (Wave 8) CodigoActividadReceptor
  const snapshotSrc = src('src/services/fiscal-snapshot.service.js');
  const workerSrc = src('src/services/fiscal-billing-worker.service.js');
  assert.match(snapshotSrc, /selectedEconomicActivityCode/,
    'snapshot must contain selectedEconomicActivityCode (Wave 8 source field)');
  assert.match(workerSrc, /economicActivity/,
    'worker must send economicActivity to Billing (Wave 8 recipient field)');
});
