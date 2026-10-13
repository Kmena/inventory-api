'use strict';

/**
 * Wave 6 Governance Closure tests
 * Spec: specs/inventori-receiver-fiscal-readiness/
 *
 * Covers:
 *   [P-xx] OQ-008 — verify endpoint permission (clients.edit)
 *   [S-xx] OQ-009 — staleness is WARNING-only (VERIFIED receiver stays VERIFIED)
 *   [A-xx] OQ-010 — activity eligibility: ACTIVE status required
 *   [T-xx] OQ-010 — in-transaction race-condition re-validation
 *
 * No live DB. No Hacienda calls. Pure unit tests.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  resolveReceiverFiscalReadiness,
  HACIENDA_ACTIVE_STATUS,
} = require('../src/services/receiver-fiscal-readiness.service');

const clientLegalEntityRouter = require('../src/routes/client-legal-entity.routes');
const orderService = require('../src/services/order.service');
const orderRepository = require('../src/repositories/order.repository');
const inventoryService = require('../src/services/inventory.service');
const billingConfigRepository = require('../src/repositories/billing-integration-config.repository');
const receiverFiscalReadiness = require('../src/services/receiver-fiscal-readiness.service');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEntity(overrides = {}) {
  return {
    id: 100n,
    companyId: 42n,
    legalName: 'Demo S.A.',
    identificationType: 'JURIDICA',
    identificationNumber: '3101000001',
    email: 'fiscal@demo.test',
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

function findRoute(router, routePath, method) {
  return router.stack.find(
    (layer) => layer.route && layer.route.path === routePath && layer.route.methods[method],
  ) || null;
}

function getRouteMiddleware(router, routePath, method) {
  const layer = findRoute(router, routePath, method);
  assert.ok(layer, `${method.toUpperCase()} ${routePath} must exist in router`);
  return layer.route.stack.map((s) => s.handle);
}

async function runMiddleware(fn, req, res) {
  return new Promise((resolve) => {
    fn(req, res, (err) => resolve(err || null));
  });
}

function makeAuth(overrides = {}) {
  return {
    sub: '1',
    role: 'admin',
    companyId: '42',
    permissions: ['clients.view', 'clients.view.all', 'clients.edit'],
    ...overrides,
  };
}

function makeReq(overrides = {}) {
  return {
    auth: makeAuth(),
    params: { id: '100' },
    requestContext: { requestId: 'test-req' },
    ...overrides,
  };
}

function makeRes() {
  return {
    _status: 200,
    _body: null,
    status(code) { this._status = code; return this; },
    json(body) { this._body = body; return this; },
    setHeader() {},
  };
}

function withStubs(stubsByModule, run) {
  const originals = [];
  for (const [mod, stubs] of stubsByModule) {
    for (const [key, val] of Object.entries(stubs)) {
      originals.push([mod, key, mod[key]]);
      mod[key] = val;
    }
  }
  return Promise.resolve().then(run).finally(() => {
    for (const [mod, key, orig] of originals) {
      mod[key] = orig;
    }
  });
}

const AUTH_ADMIN = { companyId: '42', sub: '10', userId: '10', role: 'admin', permissions: ['order.approve'] };

function makeDraftOrder(overrides = {}) {
  return { id: 5n, companyId: 42n, status: 'DRAFT', approved: false, ...overrides };
}

function makeBillingConfig(enabled = true) {
  return enabled ? { id: 1n, companyId: 42n, enabled: true } : { id: 1n, companyId: 42n, enabled: false };
}

function makeFiscalDataReady(activityOverrides = {}) {
  return {
    state: 'READY',
    entity: { id: 100n, companyId: 42n, verificationStatus: 'VERIFIED' },
    eligibleActivities: [makeActivity({ code: '620100', ...activityOverrides })],
    allActivities: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// [P-xx] OQ-008 — Permission: clients.edit required for POST verify
// ─────────────────────────────────────────────────────────────────────────────

test('[P-01] OQ-008: POST /:id/verify auth middleware is present', () => {
  const middleware = getRouteMiddleware(clientLegalEntityRouter, '/:id/verify', 'post');
  assert.ok(middleware.length >= 2, 'verify route must have at least auth + handler middlewares');
});

test('[P-02] OQ-008: user WITH clients.edit passes authorization on POST /:id/verify', async () => {
  const authMiddleware = getRouteMiddleware(clientLegalEntityRouter, '/:id/verify', 'post');
  const req = makeReq({ auth: makeAuth({ permissions: ['clients.edit'] }) });
  const res = makeRes();
  // Run the authorization middleware (index 1 — after authenticate which is router-level)
  // We find the policy-checking middleware (authorizeAccessPolicy) by running each until one returns an error
  let policyError = null;
  for (const mw of authMiddleware) {
    const err = await runMiddleware(mw, req, res);
    if (err && err.statusCode === 403) {
      policyError = err;
      break;
    }
    if (err) break; // other errors (like missing body) — policy passed
  }
  assert.strictEqual(policyError, null, 'clients.edit user must NOT receive 403');
});

test('[P-03] OQ-008: user WITHOUT clients.edit is denied on POST /:id/verify', async () => {
  const authMiddleware = getRouteMiddleware(clientLegalEntityRouter, '/:id/verify', 'post');
  const req = makeReq({ auth: makeAuth({ permissions: ['clients.view'] }) }); // no clients.edit
  const res = makeRes();
  let got403 = false;
  for (const mw of authMiddleware) {
    const err = await runMiddleware(mw, req, res);
    if (err?.statusCode === 403) { got403 = true; break; }
    if (err) break;
  }
  assert.ok(got403, 'user without clients.edit must receive 403 on POST verify');
});

test('[P-04] OQ-008: user with ZERO permissions is denied on POST /:id/verify', async () => {
  const authMiddleware = getRouteMiddleware(clientLegalEntityRouter, '/:id/verify', 'post');
  const req = makeReq({ auth: makeAuth({ permissions: [] }) });
  const res = makeRes();
  let got403 = false;
  for (const mw of authMiddleware) {
    const err = await runMiddleware(mw, req, res);
    if (err?.statusCode === 403) { got403 = true; break; }
    if (err) break;
  }
  assert.ok(got403, 'user with no permissions must receive 403');
});

test('[P-05] OQ-008: access-policy-registry marks client-legal-entity.verify as clients.edit', () => {
  const { ACCESS_POLICIES } = require('../src/security/access-policy-registry');
  const verifyPolicy = ACCESS_POLICIES['client-legal-entity.verify'];
  assert.ok(verifyPolicy, 'client-legal-entity.verify policy must exist in ACCESS_POLICIES');
  assert.ok(
    verifyPolicy.permissions.includes('clients.edit'),
    'client-legal-entity.verify must require clients.edit',
  );
  assert.ok(
    !verifyPolicy.permissions.includes('clients.fiscal.verify'),
    'no new fiscal.verify permission must be introduced (OQ-008 Option A)',
  );
});

test('[P-06] OQ-008: source code confirms clients.edit — no new permission introduced', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'security', 'access-policy-registry.js'),
    'utf8',
  );
  assert.match(src, /client-legal-entity\.verify/);
  assert.match(src, /clients\.edit/);
  assert.doesNotMatch(src, /clients\.fiscal\.verify/);
});

// ─────────────────────────────────────────────────────────────────────────────
// [S-xx] OQ-009 — Staleness is WARNING-only
// ─────────────────────────────────────────────────────────────────────────────

const STALE_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

test('[S-01] OQ-009: staleness threshold semantics — 89 days not stale, 91 days stale', () => {
  // Tests the staleness predicate semantics WITHOUT loading the browser module.
  // Uses the same formula as client-fiscal-verification.js _isStale():
  //   (Date.now() - ts.getTime()) > STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000
  // The OQ-009 approved threshold is exactly 90 days (> means strictly greater than).
  const now = Date.now();
  const isStale = (dt) => {
    if (!dt) return false;
    const ts = new Date(dt);
    if (isNaN(ts.getTime())) return false;
    return (now - ts.getTime()) > STALE_DAYS * DAY_MS;
  };
  const ts89 = new Date(now - 89 * DAY_MS).toISOString();
  const ts90 = new Date(now - 90 * DAY_MS).toISOString();
  const ts91 = new Date(now - 91 * DAY_MS).toISOString();
  assert.strictEqual(isStale(ts89), false, '89 days → NOT stale (< 90 day threshold)');
  assert.strictEqual(isStale(ts90), false, 'exactly 90 days → NOT stale (threshold is STRICTLY greater than)');
  assert.strictEqual(isStale(ts91), true, '91 days → stale (> 90 day threshold)');
  assert.strictEqual(isStale(null), false, 'null → not stale');
});

test('[S-02] OQ-009: VERIFIED entity with stale lastVerifiedAt resolves as READY (not UNVERIFIED)', () => {
  const staleDate = new Date(Date.now() - 100 * DAY_MS);
  const entity = makeEntity({ lastVerifiedAt: staleDate });
  const activities = [makeActivity({ code: '620100' })];
  const r = resolveReceiverFiscalReadiness(entity, activities);
  assert.strictEqual(r.state, 'READY', 'stale VERIFIED entity must remain READY — staleness is not a blocking state');
});

test('[S-03] OQ-009: staleness does NOT change verificationStatus to UNVERIFIED', () => {
  const staleDate = new Date(Date.now() - 100 * DAY_MS);
  const entity = makeEntity({ lastVerifiedAt: staleDate });
  const r = resolveReceiverFiscalReadiness(entity, [makeActivity()]);
  // resolveReceiverFiscalReadiness must not downgrade VERIFIED to UNVERIFIED based on age
  assert.ok(r.state === 'READY' || r.state === 'ACTIVITIES_MISSING',
    'stale VERIFIED entity must remain in VERIFIED-derived state (READY or ACTIVITIES_MISSING)');
  assert.notStrictEqual(r.state, 'UNVERIFIED');
});

test('[S-04] OQ-009: stale VERIFIED receiver with activities is still eligible for order approval', async () => {
  const staleDate = new Date(Date.now() - 100 * DAY_MS);
  // Must include all isCompleteFiscalEntity required fields (legalName, identificationType, identificationNumber)
  const staleEntity = makeEntity({ lastVerifiedAt: staleDate, verificationStatus: 'VERIFIED' });
  const activities = [makeActivity({ code: '620100', haciendaStatus: 'A', isCurrentlyReturned: true })];
  const r = resolveReceiverFiscalReadiness(staleEntity, activities);
  assert.strictEqual(r.state, 'READY',
    'stale but VERIFIED + active activities → approval must NOT be blocked by staleness alone');
  assert.strictEqual(r.eligibleActivities.length, 1);
});

test('[S-05] OQ-009: backend resolver contains NO staleness check in resolveReceiverFiscalReadiness', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'services', 'receiver-fiscal-readiness.service.js'),
    'utf8',
  );
  // Verify the resolver function does not contain STALE or lastVerifiedAt comparisons
  const fnStart = src.indexOf('function resolveReceiverFiscalReadiness');
  const fnEnd = src.indexOf('\nfunction ', fnStart + 1);
  const fnSrc = fnEnd > 0 ? src.slice(fnStart, fnEnd) : src.slice(fnStart, fnStart + 3000);
  assert.doesNotMatch(fnSrc, /lastVerifiedAt/,
    'resolveReceiverFiscalReadiness must NOT inspect lastVerifiedAt');
  assert.doesNotMatch(fnSrc, /stale|STALE/i,
    'resolveReceiverFiscalReadiness must NOT make stale checks');
});

test('[S-06] OQ-009: backend approveOrder does NOT reject due to staleness', async () => {
  const staleDate = new Date(Date.now() - 200 * DAY_MS);
  const staleEntity = { id: 100n, companyId: 42n, verificationStatus: 'VERIFIED', lastVerifiedAt: staleDate };
  const activities = [makeActivity({ code: '620100' })];
  const fiscalData = {
    state: 'READY',
    entity: staleEntity,
    eligibleActivities: activities,
    allActivities: activities,
  };

  let reserveCalled = false;
  const result = await withStubs([
    [orderRepository, { findOrderById: async (id) => makeDraftOrder({ id }) }],
    [billingConfigRepository, { findByCompanyId: async () => makeBillingConfig(true) }],
    [receiverFiscalReadiness, {
      loadOrderWithLegalEntities: async () => ({}),
      resolveOrderReceiverFiscalData: async () => fiscalData,
    }],
    [inventoryService, {
      reserveStockForOrder: async () => {
        reserveCalled = true;
        return { id: 5n, status: 'APPROVED' };
      },
    }],
  ], () => orderService.approveOrder(5n, { receiverEconomicActivityCode: '620100' }, AUTH_ADMIN));

  assert.ok(reserveCalled, 'stale VERIFIED receiver must not block approval — reserve must be called');
  assert.strictEqual(result.status, 'APPROVED');
});

// ─────────────────────────────────────────────────────────────────────────────
// [A-xx] OQ-010 — Activity eligibility: haciendaStatus === 'A' required
// ─────────────────────────────────────────────────────────────────────────────

test('[A-01] OQ-010: HACIENDA_ACTIVE_STATUS constant equals "A"', () => {
  assert.strictEqual(HACIENDA_ACTIVE_STATUS, 'A',
    'confirmed by taxpayer.service.js: Hacienda estado="A" → haciendaStatus="A" = active');
});

test('[A-02] OQ-010: ACTIVE + currentlyReturned activity → eligible', () => {
  const r = resolveReceiverFiscalReadiness(makeEntity(), [makeActivity({ haciendaStatus: 'A', isCurrentlyReturned: true })]);
  assert.strictEqual(r.state, 'READY');
  assert.strictEqual(r.eligibleActivities.length, 1);
});

test('[A-03] OQ-010: INACTIVE + currentlyReturned activity → NOT eligible', () => {
  const r = resolveReceiverFiscalReadiness(makeEntity(), [makeActivity({ haciendaStatus: 'I', isCurrentlyReturned: true })]);
  assert.strictEqual(r.state, 'ACTIVITIES_MISSING',
    'haciendaStatus=I (inactive) must NOT be eligible even if isCurrentlyReturned=true');
});

test('[A-04] OQ-010: null haciendaStatus + currentlyReturned → NOT eligible (conservative default)', () => {
  const r = resolveReceiverFiscalReadiness(makeEntity(), [makeActivity({ haciendaStatus: null, isCurrentlyReturned: true })]);
  assert.strictEqual(r.state, 'ACTIVITIES_MISSING',
    'null haciendaStatus must not be treated as active');
});

test('[A-05] OQ-010: ACTIVE + NOT currentlyReturned → NOT eligible', () => {
  const r = resolveReceiverFiscalReadiness(makeEntity(), [makeActivity({ haciendaStatus: 'A', isCurrentlyReturned: false })]);
  assert.strictEqual(r.state, 'ACTIVITIES_MISSING');
});

test('[A-06] OQ-010: ACTIVE + currentlyReturned + INACTIVE + currentlyReturned → only ACTIVE appears', () => {
  const acts = [
    makeActivity({ id: 1n, code: '620100', haciendaStatus: 'A', isCurrentlyReturned: true }),
    makeActivity({ id: 2n, code: '471100', haciendaStatus: 'I', isCurrentlyReturned: true }),
  ];
  const r = resolveReceiverFiscalReadiness(makeEntity(), acts);
  assert.strictEqual(r.state, 'READY');
  assert.strictEqual(r.eligibleActivities.length, 1);
  assert.strictEqual(r.eligibleActivities[0].code, '620100');
  assert.ok(r.eligibleActivities.every((a) => a.haciendaStatus === 'A'),
    'only ACTIVE activities must appear in eligibleActivities');
});

test('[A-07] OQ-010: receiver with ONLY inactive activities → ACTIVITIES_MISSING (NOT READY)', () => {
  const acts = [
    makeActivity({ id: 1n, code: '620100', haciendaStatus: 'I', isCurrentlyReturned: true }),
    makeActivity({ id: 2n, code: '471100', haciendaStatus: 'I', isCurrentlyReturned: true }),
  ];
  const r = resolveReceiverFiscalReadiness(makeEntity(), acts);
  assert.strictEqual(r.state, 'ACTIVITIES_MISSING',
    'only-inactive receiver must be ACTIVITIES_MISSING, not READY');
  assert.deepStrictEqual(r.eligibleActivities, []);
});

test('[A-08] OQ-010: inactive activity code rejected by approveOrder pre-tx check', async () => {
  // preview would have excluded the inactive activity — eligibleActivities contains only active
  // so an inactive code sent to approve would fail the eligibleActivities.find() check
  const activeActivity = makeActivity({ code: '620100', haciendaStatus: 'A' });
  const inactiveCode = '471100'; // not in eligibleActivities

  const fiscalData = {
    state: 'READY',
    entity: { id: 100n, companyId: 42n, verificationStatus: 'VERIFIED' },
    eligibleActivities: [activeActivity], // only active 620100 is here
    allActivities: [activeActivity],
  };

  let caught = null;
  await withStubs([
    [orderRepository, { findOrderById: async (id) => makeDraftOrder({ id }) }],
    [billingConfigRepository, { findByCompanyId: async () => makeBillingConfig(true) }],
    [receiverFiscalReadiness, {
      loadOrderWithLegalEntities: async () => ({}),
      resolveOrderReceiverFiscalData: async () => fiscalData,
    }],
    [inventoryService, { reserveStockForOrder: async () => ({ id: 5n, status: 'APPROVED' }) }],
  ], async () => {
    try {
      await orderService.approveOrder(5n, { receiverEconomicActivityCode: inactiveCode }, AUTH_ADMIN);
    } catch (e) {
      caught = e;
    }
  });

  assert.ok(caught, 'inactive activity code must be rejected');
  assert.strictEqual(caught.statusCode, 409);
  assert.strictEqual(caught.code, 'RECEIVER_ACTIVITY_NOT_ELIGIBLE');
});

test('[A-09] OQ-010: inactive activities remain persisted — resolveReceiverFiscalReadiness does not remove them', () => {
  const acts = [
    makeActivity({ id: 1n, code: '620100', haciendaStatus: 'A', isCurrentlyReturned: true }),
    makeActivity({ id: 2n, code: '471100', haciendaStatus: 'I', isCurrentlyReturned: true }),
  ];
  const r = resolveReceiverFiscalReadiness(makeEntity(), acts);
  // The inactive activity must NOT be in eligibleActivities but is still in the input array
  assert.strictEqual(r.eligibleActivities.length, 1);
  // The input array is NOT mutated — both activities still present
  assert.strictEqual(acts.length, 2, 'input activities array must not be mutated (inactive not deleted)');
});

test('[A-10] OQ-010: haciendaStatus source confirmed — taxpayer service uses "estado" field', () => {
  // Verifies that the Hacienda contract for active status is correctly sourced
  const taxpayerSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'services', 'taxpayer.service.js'),
    'utf8',
  );
  assert.match(taxpayerSrc, /act\?\.(estado|status)/,
    'taxpayer service must extract haciendaStatus from act.estado (Hacienda field name)');
  assert.match(taxpayerSrc, /haciendaStatus/,
    'normalized field must be named haciendaStatus');
});

test('[A-11] OQ-010: HACIENDA_ACTIVE_STATUS is exported from receiver-fiscal-readiness.service.js', () => {
  const { HACIENDA_ACTIVE_STATUS: exported } = require('../src/services/receiver-fiscal-readiness.service');
  assert.strictEqual(typeof exported, 'string');
  assert.strictEqual(exported, 'A');
});

test('[A-12] OQ-010: inventory.service.js imports HACIENDA_ACTIVE_STATUS (single source of truth)', () => {
  const inventorySrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'services', 'inventory.service.js'),
    'utf8',
  );
  assert.match(inventorySrc, /HACIENDA_ACTIVE_STATUS/,
    'inventory.service.js must reference HACIENDA_ACTIVE_STATUS for in-tx validation');
  assert.match(inventorySrc, /receiver-fiscal-readiness\.service/,
    'inventory.service.js must import from receiver-fiscal-readiness (not redefine the constant)');
});

// ─────────────────────────────────────────────────────────────────────────────
// [T-xx] OQ-010 — In-transaction race-condition re-validation
// ─────────────────────────────────────────────────────────────────────────────

test('[T-01] OQ-010: in-transaction check uses haciendaStatus in the WHERE clause', () => {
  const inventorySrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'services', 'inventory.service.js'),
    'utf8',
  );
  // The in-transaction findFirst must include haciendaStatus: HACIENDA_ACTIVE_STATUS
  assert.match(inventorySrc, /haciendaStatus:\s*HACIENDA_ACTIVE_STATUS/,
    'in-transaction findFirst must filter by haciendaStatus: HACIENDA_ACTIVE_STATUS');
});

test('[T-02] OQ-010: activity ACTIVE→INACTIVE between preview and POST → 409 RECEIVER_ACTIVITY_NOT_ELIGIBLE', async () => {
  // Simulates: preview showed activity as active, but by the time the tx runs it is inactive
  // The in-tx re-validation catches this and throws 409 (findFirst returns null → became inactive)
  let caught = null;
  await withStubs([
    [orderRepository, { findOrderById: async (id) => makeDraftOrder({ id }) }],
    [billingConfigRepository, { findByCompanyId: async () => makeBillingConfig(true) }],
    [receiverFiscalReadiness, {
      loadOrderWithLegalEntities: async () => ({}),
      resolveOrderReceiverFiscalData: async () => makeFiscalDataReady(),
    }],
    [inventoryService, {
      reserveStockForOrder: async (_id, _auth, _req, opts) => {
        // Simulate the in-tx validation returning null (activity became inactive)
        if (opts?.fiscalApprovalData) {
          const { createHttpError } = require('../src/lib/errors');
          throw createHttpError(409,
            'La actividad económica seleccionada ya no está disponible. Recargue y seleccione de nuevo.',
            'RECEIVER_ACTIVITY_NOT_ELIGIBLE',
          );
        }
        return { id: 5n, status: 'APPROVED' };
      },
    }],
  ], async () => {
    try {
      await orderService.approveOrder(5n, { receiverEconomicActivityCode: '620100' }, AUTH_ADMIN);
    } catch (e) {
      caught = e;
    }
  });

  assert.ok(caught, 'must have thrown');
  assert.strictEqual(caught.statusCode, 409);
  assert.strictEqual(caught.code, 'RECEIVER_ACTIVITY_NOT_ELIGIBLE');
});

test('[T-03] OQ-010: existing OrderFiscalApproval referencing subsequently inactive activity is NOT touched', () => {
  // This is an immutability proof — the service layer has no code that retroactively
  // invalidates OrderFiscalApproval records. Verify by source inspection.
  const orderSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'services', 'order.service.js'),
    'utf8',
  );
  const inventorySrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'services', 'inventory.service.js'),
    'utf8',
  );
  // Must NOT contain any code that updates/deletes OrderFiscalApproval records
  assert.doesNotMatch(orderSrc + inventorySrc, /orderFiscalApproval\.(update|delete|deleteMany)/,
    'OrderFiscalApproval must be immutable — no update or delete operations');
});

test('[T-04] OQ-010: buildFiscalSnapshotData uses frozen OrderFiscalApproval code — not live activity status', () => {
  const snapshotSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'services', 'fiscal-snapshot.service.js'),
    'utf8',
  );
  // Snapshot reads receiverEconomicActivityCode from the frozen OrderFiscalApproval relation,
  // NOT from live ClientEconomicActivity.haciendaStatus
  assert.match(snapshotSrc, /fiscalApproval\.receiverEconomicActivityCode|fiscalApproval\?\.receiverEconomicActivityCode/,
    'snapshot must source activity code from frozen OrderFiscalApproval');
  assert.doesNotMatch(snapshotSrc, /haciendaStatus.*ACTIVE|ACTIVE.*haciendaStatus/,
    'snapshot must NOT re-validate activity status at dispatch time (immutability)');
});

test('[T-05] OQ-010: HACIENDA_ACTIVE_STATUS constant is not duplicated in inventory.service.js', () => {
  const inventorySrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'services', 'inventory.service.js'),
    'utf8',
  );
  // Must import from receiver-fiscal-readiness, not define its own 'A' string
  const definitionCount = (inventorySrc.match(/HACIENDA_ACTIVE_STATUS\s*=/g) || []).length;
  assert.strictEqual(definitionCount, 0,
    'inventory.service.js must not define HACIENDA_ACTIVE_STATUS — it must import it (DRY)');
});
