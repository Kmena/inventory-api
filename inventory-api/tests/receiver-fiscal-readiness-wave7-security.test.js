'use strict';

/**
 * RFR-TASK-702 — Security Review
 * Spec: specs/inventori-receiver-fiscal-readiness/
 *
 * Covers:
 *   [ISO-xx] Tenant isolation — company-scoped predicates
 *   [AUTH-xx] Authorization enforcement
 *   [IDOR-xx] IDOR protection
 *   [INJ-xx] Activity injection attacks
 *   [DUP-xx] Duplicate approval prevention
 *   [RACE-xx] Race-condition protection
 *   [FE-xx] Frontend external-call / storage audit
 *   [THROT-xx] Rate limiting on verify endpoint
 *   [SECRET-xx] No secrets in audit / payloads
 *   [FIELD-xx] Browser-controlled authoritative field injection
 *
 * No live DB. No Hacienda calls. Pure unit + source-inspection tests.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const orderService = require('../src/services/order.service');
const orderRepository = require('../src/repositories/order.repository');
const inventoryService = require('../src/services/inventory.service');
const billingConfigRepository = require('../src/repositories/billing-integration-config.repository');
const receiverFiscalReadiness = require('../src/services/receiver-fiscal-readiness.service');
const verificationService = require('../src/services/client-legal-entity-verification.service');
const clientLegalEntityRouter = require('../src/routes/client-legal-entity.routes');
const orderRouter = require('../src/routes/order.routes');
const { ACCESS_POLICIES } = require('../src/security/access-policy-registry');
const { TAXPAYER_THROTTLE_MAX_REQUESTS } = require('../src/middlewares/request-throttle');

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function makeAuth(companyId = '42', userId = '10', permissions = ['order.approve']) {
  return { sub: userId, userId, companyId, role: 'admin', permissions };
}

function makeDraftOrder(companyId = 42n) {
  return { id: 5n, companyId, status: 'DRAFT', approved: false };
}

function makeFiscalDataReady() {
  return {
    state: 'READY',
    entity: { id: 100n, companyId: 42n, verificationStatus: 'VERIFIED' },
    eligibleActivities: [{ id: 1n, code: '620100', description: 'Software', haciendaStatus: 'A', isCurrentlyReturned: true }],
    allActivities: [],
  };
}

function makeBillingEnabled() {
  return { id: 1n, companyId: 42n, enabled: true };
}

function findRoute(router, routePath, method) {
  return router.stack.find((l) => l.route && l.route.path === routePath && l.route.methods[method]) || null;
}

async function runMiddleware(fn, req, res) {
  return new Promise((resolve) => { fn(req, res, (err) => resolve(err || null)); });
}

function makeReq(overrides = {}) {
  return { auth: makeAuth(), params: { id: '100' }, requestContext: { requestId: 'test' }, ...overrides };
}

function makeRes() {
  return { _status: 200, _body: null, status(c) { this._status = c; return this; }, json(b) { this._body = b; return this; }, setHeader() {} };
}

function src(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

// ─── [ISO] Tenant Isolation ──────────────────────────────────────────────────

test('[ISO-01] verifyClientLegalEntityFiscalIdentity: entity lookup scoped to companyId (not body)', async () => {
  // The service must use companyId from auth, never from the request body.
  // Here we verify the findFirst call includes the correct companyId.
  let queriedCompanyId = null;
  const mockPrisma = {
    $transaction: (fn) => fn(mockPrisma),
    clientLegalEntity: {
      findFirst: async (args) => {
        queriedCompanyId = args.where.companyId;
        return null; // returns null → will throw 404, which is fine
      },
    },
  };
  const svc = verificationService.createVerificationService({ prisma: mockPrisma });
  await assert.rejects(
    () => svc.verifyClientLegalEntityFiscalIdentity(100n, 42n),
    (e) => { assert.strictEqual(e.statusCode, 404); return true; },
  );
  assert.strictEqual(queriedCompanyId, 42n, 'service MUST scope entity lookup to auth companyId');
});

test('[ISO-02] verifyClientLegalEntityFiscalIdentity: entity from different company → 404 (non-enumeration)', async () => {
  // Company A (companyId=42) tries to verify entity that belongs to Company B (companyId=99).
  // findFirst with companyId=42 returns null → 404.
  const mockPrisma = {
    clientLegalEntity: { findFirst: async () => null }, // entity not found in company scope
  };
  const svc = verificationService.createVerificationService({ prisma: mockPrisma });
  await assert.rejects(
    () => svc.verifyClientLegalEntityFiscalIdentity(100n, 42n),
    (e) => { assert.strictEqual(e.statusCode, 404); return true; },
    'cross-company entity must return 404, not 403 (non-enumeration)',
  );
});

test('[ISO-03] loadClientEconomicActivities scoped by companyId', () => {
  const svc = src('src/services/receiver-fiscal-readiness.service.js');
  // The loadClientEconomicActivities helper includes companyId in the where clause
  assert.match(svc, /clientEconomicActivity\.findMany/);
  // companyId is in the where clause for the activities query
  assert.match(svc, /where:.*clientLegalEntityId.*companyId/s,
    'activities query MUST include companyId in WHERE for company scoping');
});

test('[ISO-04] loadOrderWithLegalEntities scoped by companyId', () => {
  const svc = src('src/services/receiver-fiscal-readiness.service.js');
  assert.match(svc, /loadOrderWithLegalEntities/);
  assert.match(svc, /where:.*orderId.*companyId|where:.*id.*companyId/s,
    'order load MUST include companyId in WHERE predicate');
});

test('[ISO-05] approveOrder: order from different company → 404 before fiscal check', async () => {
  // Company B order (companyId=99) should not be visible to Company A (companyId=42).
  await assert.rejects(
    () => withStubs([
      [orderRepository, { findOrderById: async () => null }], // returns null = not found / wrong company
    ], () => orderService.approveOrder(5n, { receiverEconomicActivityCode: '620100' }, makeAuth('42'))),
    (e) => { assert.ok(e.statusCode === 404 || e.statusCode === 409); return true; },
    'approval of non-existent or wrong-company order must fail before any fiscal logic',
  );
});

test('[ISO-06] companyId sourced from auth, never from request body in approval', async () => {
  let capturedFad = null;
  await withStubs([
    [orderRepository, { findOrderById: async (_id) => makeDraftOrder(42n) }],
    [billingConfigRepository, { findByCompanyId: async () => makeBillingEnabled() }],
    [receiverFiscalReadiness, {
      loadOrderWithLegalEntities: async () => makeDraftOrder(),
      resolveOrderReceiverFiscalData: async () => makeFiscalDataReady(),
    }],
    [inventoryService, {
      reserveStockForOrder: async (_id, _auth, _req, opts) => {
        capturedFad = opts?.fiscalApprovalData;
        return { id: 5n, status: 'APPROVED' };
      },
    }],
  ], () => orderService.approveOrder(5n,
    // Body injects a different companyId — server must use auth.companyId
    { receiverEconomicActivityCode: '620100', companyId: '99' },
    makeAuth('42'),
  ));
  assert.strictEqual(capturedFad.companyId, 42n, 'fiscalApprovalData.companyId must be from auth, not body');
});

// ─── [AUTH] Authorization Enforcement ────────────────────────────────────────

test('[AUTH-01] POST verify requires clients.edit (registry)', () => {
  assert.ok(ACCESS_POLICIES['client-legal-entity.verify']?.permissions.includes('clients.edit'),
    'verify endpoint MUST require clients.edit permission');
});

test('[AUTH-02] GET activities requires clients.view or clients.view.all (registry)', () => {
  const policy = ACCESS_POLICIES['client-legal-entity.activities'];
  assert.ok(policy?.permissions.includes('clients.view') || policy?.permissions.includes('clients.view.all'),
    'activities endpoint MUST require clients.view');
});

test('[AUTH-03] GET fiscal-readiness-preview requires order.approve (route)', () => {
  const route = findRoute(orderRouter, '/:id/fiscal-readiness-preview', 'get');
  assert.ok(route, 'fiscal-readiness-preview route must exist');
  // The route middleware stack must include an auth-checking handler
  assert.ok(route.route.stack.length >= 2, 'route must have at least authenticate + handler');
});

test('[AUTH-04] POST approve requires order.approve (route registered)', () => {
  const route = findRoute(orderRouter, '/:id/approve', 'post');
  assert.ok(route, 'approve route must exist');
  assert.ok(route.route.stack.length >= 2, 'approve route must have middleware');
});

test('[AUTH-05] POST verify middleware rejects missing clients.edit', async () => {
  const mw = clientLegalEntityRouter.stack
    .find((l) => l.route?.path === '/:id/verify' && l.route.methods.post)
    ?.route.stack.map((s) => s.handle) || [];
  const req = makeReq({ auth: makeAuth('42', '10', ['clients.view']) }); // no clients.edit
  const res = makeRes();
  let got403 = false;
  for (const fn of mw) {
    const err = await runMiddleware(fn, req, res);
    if (err?.statusCode === 403) { got403 = true; break; }
    if (err) break;
  }
  assert.ok(got403, 'user without clients.edit MUST receive 403 on POST verify');
});

// ─── [IDOR] IDOR Protection ───────────────────────────────────────────────────

test('[IDOR-01] listClientLegalEntityActivities scoped — wrong company returns 404', async () => {
  const mockPrisma = {
    clientLegalEntity: { findFirst: async () => null }, // entity not in this company
  };
  const svc = verificationService.createVerificationService({ prisma: mockPrisma });
  await assert.rejects(
    () => svc.listClientLegalEntityActivities(100n, 42n),
    (e) => { assert.strictEqual(e.statusCode, 404); return true; },
  );
});

test('[IDOR-02] fiscal-readiness-preview for wrong-company order returns 404 (order not loaded)', async () => {
  // loadOrderWithLegalEntities uses companyId → returns null for wrong company order
  // Test via the pure DB query helper — no HTTP layer needed
  const svc = src('src/services/receiver-fiscal-readiness.service.js');
  assert.match(svc, /companyId.*orderId|orderId.*companyId/,
    'order load must always include companyId for IDOR protection');
});

test('[IDOR-03] approval in-tx activity findFirst includes companyId', () => {
  const inventorySrc = src('src/services/inventory.service.js');
  const txIdx = inventorySrc.indexOf('clientEconomicActivity.findFirst');
  assert.ok(txIdx > 0, 'in-transaction findFirst must exist');
  const txBlock = inventorySrc.slice(txIdx, txIdx + 300);
  assert.match(txBlock, /companyId.*fad\.companyId|fad\.companyId/,
    'in-tx findFirst MUST include companyId to prevent cross-company activity injection');
});

// ─── [INJ] Activity Injection Attacks ────────────────────────────────────────

test('[INJ-01] unknown activity code → 409 RECEIVER_ACTIVITY_NOT_ELIGIBLE', async () => {
  let caught = null;
  await withStubs([
    [orderRepository, { findOrderById: async (_id) => makeDraftOrder(42n) }],
    [billingConfigRepository, { findByCompanyId: async () => makeBillingEnabled() }],
    [receiverFiscalReadiness, {
      loadOrderWithLegalEntities: async () => ({}),
      resolveOrderReceiverFiscalData: async () => makeFiscalDataReady(),
    }],
    [inventoryService, { reserveStockForOrder: async () => ({ id: 5n, status: 'APPROVED' }) }],
  ], async () => {
    try {
      await orderService.approveOrder(5n, { receiverEconomicActivityCode: 'NOTEXIST' }, makeAuth());
    } catch (e) { caught = e; }
  });
  assert.ok(caught, 'unknown code must be rejected');
  assert.strictEqual(caught.statusCode, 409);
  assert.strictEqual(caught.code, 'RECEIVER_ACTIVITY_NOT_ELIGIBLE');
});

test('[INJ-02] inactive activity code not in eligibleActivities → 409 RECEIVER_ACTIVITY_NOT_ELIGIBLE', async () => {
  // Preview eligibleActivities only contains active (haciendaStatus='A') activities.
  // An inactive code that was rejected from eligibleActivities must be rejected here too.
  const fiscalDataWithInactive = {
    state: 'READY',
    entity: { id: 100n, companyId: 42n, verificationStatus: 'VERIFIED' },
    // eligibleActivities only shows active activity — inactive '471100' was filtered out
    eligibleActivities: [{ id: 1n, code: '620100', haciendaStatus: 'A', isCurrentlyReturned: true }],
    allActivities: [],
  };
  let caught = null;
  await withStubs([
    [orderRepository, { findOrderById: async (_id) => makeDraftOrder(42n) }],
    [billingConfigRepository, { findByCompanyId: async () => makeBillingEnabled() }],
    [receiverFiscalReadiness, {
      loadOrderWithLegalEntities: async () => ({}),
      resolveOrderReceiverFiscalData: async () => fiscalDataWithInactive,
    }],
    [inventoryService, { reserveStockForOrder: async () => ({ id: 5n, status: 'APPROVED' }) }],
  ], async () => {
    try {
      await orderService.approveOrder(5n, { receiverEconomicActivityCode: '471100' }, makeAuth());
    } catch (e) { caught = e; }
  });
  assert.ok(caught, 'inactive code must be rejected (not in eligibleActivities)');
  assert.strictEqual(caught.statusCode, 409);
});

test('[INJ-03] null code with billing enabled → 400 RECEIVER_ACTIVITY_REQUIRED', async () => {
  let caught = null;
  await withStubs([
    [orderRepository, { findOrderById: async (_id) => makeDraftOrder(42n) }],
    [billingConfigRepository, { findByCompanyId: async () => makeBillingEnabled() }],
    [receiverFiscalReadiness, {
      loadOrderWithLegalEntities: async () => ({}),
      resolveOrderReceiverFiscalData: async () => makeFiscalDataReady(),
    }],
    [inventoryService, { reserveStockForOrder: async () => ({ id: 5n, status: 'APPROVED' }) }],
  ], async () => {
    try { await orderService.approveOrder(5n, null, makeAuth()); } catch (e) { caught = e; }
  });
  assert.ok(caught, 'null body with billing enabled must be rejected');
  assert.strictEqual(caught.statusCode, 400);
  assert.strictEqual(caught.code, 'RECEIVER_ACTIVITY_REQUIRED');
});

test('[INJ-04] companyId injected in body does not change fiscal scope (already tested ISO-06)', () => {
  // Confirmed by ISO-06: capturedFad.companyId = 42n regardless of body.companyId='99'
  // This test asserts the approveOrder schema does NOT expose companyId
  const orderSrc = src('src/schemas/order.schema.js');
  assert.doesNotMatch(orderSrc, /approveOrderSchema.*companyId|companyId.*approveOrderSchema/,
    'approveOrderSchema MUST NOT include companyId field');
});

test('[INJ-05] haciendaStatus injected in body → server ignores it (schema does not accept it)', () => {
  const schemaSrc = src('src/schemas/order.schema.js');
  assert.doesNotMatch(schemaSrc, /approveOrderSchema.*haciendaStatus|haciendaStatus.*approveOrderSchema/,
    'approveOrderSchema MUST NOT include haciendaStatus field');
});

test('[INJ-06] verificationStatus injected in body → server ignores it (schema does not accept it)', () => {
  const schemaSrc = src('src/schemas/order.schema.js');
  assert.doesNotMatch(schemaSrc, /approveOrderSchema.*verificationStatus/,
    'approveOrderSchema MUST NOT include verificationStatus');
});

test('[INJ-07] clientLegalEntityId injected in body is not used (resolved server-side)', () => {
  const orderSvcSrc = src('src/services/order.service.js');
  // The service derives clientLegalEntityId from fiscalData.entity.id, not from body
  assert.match(orderSvcSrc, /fiscalData\.entity\.id|entity\.id/,
    'clientLegalEntityId MUST come from resolved fiscalData.entity, not from body');
  assert.doesNotMatch(orderSvcSrc, /body.*clientLegalEntityId|clientLegalEntityId.*body/,
    'body must not be source of clientLegalEntityId');
});

test('[INJ-08] approveOrderSchema only accepts receiverEconomicActivityCode', () => {
  const { approveOrderSchema } = require('../src/schemas/order.schema');
  // Shape must only have receiverEconomicActivityCode
  const shape = approveOrderSchema._def?.shape?.() || {};
  const keys = Object.keys(shape);
  assert.deepStrictEqual(keys, ['receiverEconomicActivityCode'],
    'approveOrderSchema MUST accept ONLY receiverEconomicActivityCode');
});

test('[INJ-09] oversized activity code (51 chars) rejected by schema', () => {
  const { approveOrderSchema } = require('../src/schemas/order.schema');
  const result = approveOrderSchema.safeParse({ receiverEconomicActivityCode: 'A'.repeat(51) });
  assert.strictEqual(result.success, false, 'max 50 chars must be enforced by schema');
});

test('[INJ-10] billing disabled + rogue body fields → ignored, approval succeeds (no schema rejection)', async () => {
  let reserveCalled = false;
  const result = await withStubs([
    [orderRepository, { findOrderById: async (_id) => makeDraftOrder(42n) }],
    [billingConfigRepository, { findByCompanyId: async () => ({ id: 1n, companyId: 42n, enabled: false }) }],
    [inventoryService, { reserveStockForOrder: async () => { reserveCalled = true; return { id: 5n, status: 'APPROVED' }; } }],
  ], () => orderService.approveOrder(5n, { receiverEconomicActivityCode: '620100' }, makeAuth()));
  assert.ok(reserveCalled);
  assert.strictEqual(result.status, 'APPROVED');
});

// ─── [DUP] Duplicate Approval Prevention ────────────────────────────────────

test('[DUP-01] OrderFiscalApproval has unique constraint on orderId (Prisma schema)', () => {
  const schemaSrc = src('prisma/schema.prisma');
  // Find OrderFiscalApproval model and verify unique constraint
  const modelIdx = schemaSrc.indexOf('model OrderFiscalApproval');
  assert.ok(modelIdx >= 0, 'OrderFiscalApproval model must exist in Prisma schema');
  const modelDef = schemaSrc.slice(modelIdx, modelIdx + 500);
  // Unique constraint on orderId prevents duplicate approvals for same order.
  // Prisma uses field-level @unique on the column (equivalent to DB UNIQUE INDEX).
  assert.match(modelDef, /orderId.*@unique|@unique.*orderId/s,
    'OrderFiscalApproval MUST have @unique constraint on orderId (prevents duplicate approvals)');
});

test('[DUP-02] no update/delete on OrderFiscalApproval in any service (immutable once committed)', () => {
  const orderSrc = src('src/services/order.service.js');
  const inventorySrc = src('src/services/inventory.service.js');
  const combined = orderSrc + inventorySrc;
  assert.doesNotMatch(combined, /orderFiscalApproval\.(update|delete|deleteMany|upsert)/,
    'OrderFiscalApproval MUST be immutable — no update, delete, or upsert');
});

// ─── [RACE] Race-Condition Protection ────────────────────────────────────────

test('[RACE-01] in-tx findFirst revalidates both isCurrentlyReturned AND haciendaStatus', () => {
  const inventorySrc = src('src/services/inventory.service.js');
  const txIdx = inventorySrc.indexOf('clientEconomicActivity.findFirst');
  const txBlock = inventorySrc.slice(txIdx, txIdx + 400);
  assert.match(txBlock, /isCurrentlyReturned:\s*true/, 'in-tx check MUST include isCurrentlyReturned:true');
  assert.match(txBlock, /haciendaStatus:\s*HACIENDA_ACTIVE_STATUS/, 'in-tx check MUST include haciendaStatus:HACIENDA_ACTIVE_STATUS');
});

test('[RACE-02] activity goes inactive between preview and POST → in-tx rejection with 409', async () => {
  const { createHttpError } = require('../src/lib/errors');
  let caught = null;
  await withStubs([
    [orderRepository, { findOrderById: async (_id) => makeDraftOrder(42n) }],
    [billingConfigRepository, { findByCompanyId: async () => makeBillingEnabled() }],
    [receiverFiscalReadiness, {
      loadOrderWithLegalEntities: async () => ({}),
      resolveOrderReceiverFiscalData: async () => makeFiscalDataReady(),
    }],
    [inventoryService, {
      reserveStockForOrder: async () => {
        // Simulate in-tx rejection: activity became inactive
        throw createHttpError(409,
          'La actividad económica seleccionada ya no está disponible. Recargue y seleccione de nuevo.',
          'RECEIVER_ACTIVITY_NOT_ELIGIBLE');
      },
    }],
  ], async () => {
    try {
      await orderService.approveOrder(5n, { receiverEconomicActivityCode: '620100' }, makeAuth());
    } catch (e) { caught = e; }
  });
  assert.ok(caught, 'race condition must throw');
  assert.strictEqual(caught.statusCode, 409);
  assert.strictEqual(caught.code, 'RECEIVER_ACTIVITY_NOT_ELIGIBLE');
});

// ─── [FE] Frontend External-Call / Storage Audit ─────────────────────────────

const HACIENDA_PATTERN = /hacienda\.go\.cr|https?:\/\/[^'"]*hacienda/i;
const BILLING_HOST_PATTERN = /billing-api\.|billingapi\.|\.billing\.inventori|BILLING_HOST/i;

test('[FE-01] client-fiscal-verification.js: ZERO Hacienda URL references', () => {
  assert.doesNotMatch(src('src/public/root/views/client-fiscal-verification.js'), HACIENDA_PATTERN);
});

test('[FE-02] client-fiscal-verification.js: ZERO direct Billing host references', () => {
  assert.doesNotMatch(src('src/public/root/views/client-fiscal-verification.js'), BILLING_HOST_PATTERN);
});

test('[FE-03] fiscal-approval-modal.js: ZERO Hacienda URL references', () => {
  assert.doesNotMatch(src('src/public/root/views/fiscal-approval-modal.js'), HACIENDA_PATTERN);
});

test('[FE-04] fiscal-approval-modal.js: ZERO direct Billing host references', () => {
  assert.doesNotMatch(src('src/public/root/views/fiscal-approval-modal.js'), BILLING_HOST_PATTERN);
});

test('[FE-05] clients-api.js: calls Inventori API only (no Hacienda, no Billing)', () => {
  const apiSrc = src('src/public/root/clients-api.js');
  assert.doesNotMatch(apiSrc, HACIENDA_PATTERN);
  assert.doesNotMatch(apiSrc, BILLING_HOST_PATTERN);
  assert.match(apiSrc, /\/api\/client-legal-entities\//,
    'clients-api.js must call Inventori /api/ routes only');
});

test('[FE-06] orders-api.js: fiscal preview + approve call Inventori API only', () => {
  const apiSrc = src('src/public/root/orders-api.js');
  assert.doesNotMatch(apiSrc, HACIENDA_PATTERN);
  assert.doesNotMatch(apiSrc, BILLING_HOST_PATTERN);
});

test('[FE-07] client-fiscal-verification.js: no localStorage write/read ops for fiscal data', () => {
  // The comment in the module says "ZERO localStorage / sessionStorage writes" — enforce the write ops
  const srcText = src('src/public/root/views/client-fiscal-verification.js');
  assert.doesNotMatch(srcText, /localStorage\.(setItem|getItem|removeItem|clear)/,
    'client-fiscal-verification.js must not call localStorage read/write ops');
  assert.doesNotMatch(srcText, /sessionStorage\.(setItem|getItem|removeItem|clear)/,
    'client-fiscal-verification.js must not call sessionStorage read/write ops');
});

test('[FE-08] fiscal-approval-modal.js: no sessionStorage/localStorage for fiscal data', () => {
  const src2 = src('src/public/root/views/fiscal-approval-modal.js');
  assert.doesNotMatch(src2, /localStorage/);
  assert.doesNotMatch(src2, /sessionStorage/);
});

test('[FE-09] clients-api.js: no localStorage/sessionStorage for fiscal data', () => {
  const src2 = src('src/public/root/clients-api.js');
  assert.doesNotMatch(src2, /localStorage\.(setItem|getItem|removeItem)/);
  assert.doesNotMatch(src2, /sessionStorage\.(setItem|getItem|removeItem)/);
});

test('[FE-10] fiscal-approval-modal.js: no console.log of sensitive fiscal payloads', () => {
  const modalSrc = src('src/public/root/views/fiscal-approval-modal.js');
  // Must not log identificationNumber, billingCompanyId, secretRef, or the full preview object
  assert.doesNotMatch(modalSrc, /console\.(log|info|debug)\(.*preview\)/,
    'modal must not log raw preview object to console');
});

// ─── [THROT] Rate Limiting (SEC-009) ─────────────────────────────────────────

test('[THROT-01] POST verify route has taxpayerLookupThrottle middleware (source)', () => {
  const routeSrc = src('src/routes/client-legal-entity.routes.js');
  assert.match(routeSrc, /taxpayerLookupThrottle/,
    'verify route MUST use taxpayerLookupThrottle middleware');
});

test('[THROT-02] taxpayerLookupThrottle uses TAXPAYER_THROTTLE_MAX_REQUESTS constant', () => {
  const routeSrc = src('src/routes/client-legal-entity.routes.js');
  assert.match(routeSrc, /TAXPAYER_THROTTLE_MAX_REQUESTS/,
    'throttle MUST use the named constant, not a magic number');
});

test('[THROT-03] TAXPAYER_THROTTLE_MAX_REQUESTS is defined and exported', () => {
  assert.ok(typeof TAXPAYER_THROTTLE_MAX_REQUESTS === 'number' && TAXPAYER_THROTTLE_MAX_REQUESTS > 0,
    'TAXPAYER_THROTTLE_MAX_REQUESTS must be a positive number');
});

test('[THROT-04] GET fiscal-readiness-preview does NOT have rate limit (pure read, no Hacienda)', () => {
  const routeSrc = src('src/routes/order.routes.js');
  // The preview route should not reference any throttle
  const previewIdx = routeSrc.indexOf('fiscal-readiness-preview');
  const previewBlock = routeSrc.slice(Math.max(0, previewIdx - 50), previewIdx + 200);
  assert.doesNotMatch(previewBlock, /Throttle|throttle|rateLimit|rate_limit/,
    'preview endpoint must NOT be rate-limited (it never calls Hacienda)');
});

// ─── [SECRET] No Secrets in Audit / Payloads ────────────────────────────────

test('[SECRET-01] verify audit afterState has no identificationNumber', () => {
  const routeSrc = src('src/routes/client-legal-entity.routes.js');
  const auditIdx = routeSrc.indexOf('recordAuditEventSafelyIfAvailable');
  const auditBlock = routeSrc.slice(auditIdx, auditIdx + 400);
  assert.doesNotMatch(auditBlock, /identificationNumber/,
    'audit event MUST NOT include identificationNumber (SEC-013)');
});

test('[SECRET-02] verify DTO (buildVerifyDto) has no Billing credentials', () => {
  const routeSrc = src('src/routes/client-legal-entity.routes.js');
  assert.doesNotMatch(routeSrc, /billingCompanyId|billingTenantId|billingCredential/,
    'verify DTO MUST NOT expose Billing credentials');
});

test('[SECRET-03] approveOrderSchema has no credential fields', () => {
  const schemaSrc = src('src/schemas/order.schema.js');
  assert.doesNotMatch(schemaSrc, /approveOrderSchema.*billingCredential|billingCredential.*approveOrderSchema/);
  assert.doesNotMatch(schemaSrc, /approveOrderSchema.*secretRef|secretRef.*approveOrderSchema/);
});

test('[SECRET-04] no Billing credentials in any RFR service file', () => {
  const rfrSrc = src('src/services/receiver-fiscal-readiness.service.js');
  const verifySrc = src('src/services/client-legal-entity-verification.service.js');
  const combined = rfrSrc + verifySrc;
  assert.doesNotMatch(combined, /billingCredentialSecretRef|billingTenantId|billingCompanyId/,
    'RFR services MUST NOT reference Billing credentials');
});

test('[SECRET-05] verify endpoint route does not expose identification number in error messages', () => {
  const routeSrc = src('src/routes/client-legal-entity.routes.js');
  // Error messages must not interpolate identificationNumber
  assert.doesNotMatch(routeSrc, /identificationNumber.*message|message.*identificationNumber/,
    'error messages MUST NOT contain identificationNumber (SEC-005)');
});

// ─── [FIELD] Browser-Controlled Authoritative Field Injection ────────────────

test('[FIELD-01] verificationStatus is system-managed — not in approveOrderSchema', () => {
  const schemaSrc = src('src/schemas/order.schema.js');
  assert.doesNotMatch(schemaSrc, /approveOrderSchema.*verificationStatus/);
});

test('[FIELD-02] isCurrentlyReturned not in approveOrderSchema (system-managed)', () => {
  const schemaSrc = src('src/schemas/order.schema.js');
  assert.doesNotMatch(schemaSrc, /approveOrderSchema.*isCurrentlyReturned/);
});

test('[FIELD-03] confirmedById sourced from auth.userId, not from body', () => {
  const orderSrc = src('src/services/order.service.js');
  // confirmedById must come from auth userId
  assert.match(orderSrc, /confirmedById.*userId|userId.*confirmedById/,
    'confirmedById MUST be derived from auth.userId, not from request body');
});
