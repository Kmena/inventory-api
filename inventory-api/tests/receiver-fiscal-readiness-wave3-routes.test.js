'use strict';

/**
 * RFR-TASK-301 + RFR-TASK-302 — Route contract tests
 * Verifies: route structure, permissions, middleware layers, DTO safety.
 * No DB, no Hacienda, no Billing.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const orderRouter = require('../src/routes/order.routes');

// ─── Route inspection helpers ─────────────────────────────────────────────────

function findRoute(router, path, method) {
  return router.stack.find((l) => l.route && l.route.path === path && l.route.methods[method]) || null;
}

function getMiddleware(router, path, method) {
  const layer = findRoute(router, path, method);
  assert.ok(layer, `${method.toUpperCase()} ${path} must exist`);
  return layer.route.stack.map((s) => s.handle);
}

async function runMiddleware(fn, req, res) {
  return new Promise((resolve) => {
    // Some middleware (validate) calls res.json/res.status directly instead of next()
    const origJson = res.json.bind(res);
    res.json = (body) => {
      origJson(body);
      resolve({ statusCode: res._status, body });
      return res;
    };
    fn(req, res, (err) => resolve(err || null));
  });
}

function makeAuth(overrides = {}) {
  return {
    sub: '1', role: 'admin', companyId: '42', permissions: ['sales.manage'],
    ...overrides,
  };
}

function makeReq(overrides = {}) {
  return {
    auth: makeAuth(),
    params: { id: '5' },
    body: {},
    requestContext: { requestId: 'test-1' },
    ...overrides,
  };
}

function makeRes() {
  return { _status: 200, _body: null, status(c) { this._status = c; return this; }, json(b) { this._body = b; return this; } };
}

// ─── Route existence ──────────────────────────────────────────────────────────

test('GET /:id/fiscal-readiness-preview route exists', () => {
  assert.ok(findRoute(orderRouter, '/:id/fiscal-readiness-preview', 'get'));
});

test('POST /:id/approve route exists (still)', () => {
  assert.ok(findRoute(orderRouter, '/:id/approve', 'post'));
});

// ─── Middleware layer counts ──────────────────────────────────────────────────

test('GET /:id/fiscal-readiness-preview has at least 2 layers (auth-guard + handler)', () => {
  const mw = getMiddleware(orderRouter, '/:id/fiscal-readiness-preview', 'get');
  assert.ok(mw.length >= 2, `Expected ≥2, got ${mw.length}`);
});

test('POST /:id/approve has at least 3 layers (auth-guard + validate + handler)', () => {
  const mw = getMiddleware(orderRouter, '/:id/approve', 'post');
  assert.ok(mw.length >= 3, `Expected ≥3, got ${mw.length}`);
});

// ─── Preview permission (order.approve = admin + sales roles) ─────────────────

test('GET preview: admin role allowed', async () => {
  const [guard] = getMiddleware(orderRouter, '/:id/fiscal-readiness-preview', 'get');
  const err = await runMiddleware(guard, makeReq({ auth: makeAuth({ role: 'admin' }) }), makeRes());
  assert.strictEqual(err, null);
});

test('GET preview: sales role allowed', async () => {
  const [guard] = getMiddleware(orderRouter, '/:id/fiscal-readiness-preview', 'get');
  const err = await runMiddleware(guard, makeReq({ auth: makeAuth({ role: 'sales' }) }), makeRes());
  assert.strictEqual(err, null);
});

test('GET preview: warehouse role denied (not in order.approve policy)', async () => {
  const [guard] = getMiddleware(orderRouter, '/:id/fiscal-readiness-preview', 'get');
  const err = await runMiddleware(guard, makeReq({ auth: makeAuth({ role: 'warehouse' }) }), makeRes());
  assert.ok(err, 'warehouse must not access fiscal readiness preview');
  assert.strictEqual(err.statusCode, 403);
});

test('GET preview: no role denied', async () => {
  const [guard] = getMiddleware(orderRouter, '/:id/fiscal-readiness-preview', 'get');
  const err = await runMiddleware(guard, makeReq({ auth: makeAuth({ role: 'viewer' }) }), makeRes());
  assert.ok(err);
  assert.strictEqual(err.statusCode, 403);
});

// ─── Approve permission (unchanged: admin + sales roles) ─────────────────────

test('POST approve: admin role allowed', async () => {
  const [guard] = getMiddleware(orderRouter, '/:id/approve', 'post');
  const err = await runMiddleware(guard, makeReq({ auth: makeAuth({ role: 'admin' }) }), makeRes());
  assert.strictEqual(err, null);
});

test('POST approve: warehouse role denied', async () => {
  const [guard] = getMiddleware(orderRouter, '/:id/approve', 'post');
  const err = await runMiddleware(guard, makeReq({ auth: makeAuth({ role: 'warehouse' }) }), makeRes());
  assert.ok(err);
  assert.strictEqual(err.statusCode, 403);
});

// ─── approveOrderSchema validation ───────────────────────────────────────────

test('POST approve validate middleware: empty body {} passes schema (all fields optional)', async () => {
  const mw = getMiddleware(orderRouter, '/:id/approve', 'post');
  const validateMiddleware = mw[1]; // [0]=guard, [1]=validate, [2]=handler
  const req = makeReq({ body: {} });
  const result = await runMiddleware(validateMiddleware, req, makeRes());
  // passes → next() called with null
  assert.strictEqual(result, null, 'empty body must pass schema (backward compat when billing disabled)');
});

test('POST approve validate middleware: valid code passes schema', async () => {
  const mw = getMiddleware(orderRouter, '/:id/approve', 'post');
  const validateMiddleware = mw[1];
  const req = makeReq({ body: { receiverEconomicActivityCode: '620100' } });
  const result = await runMiddleware(validateMiddleware, req, makeRes());
  assert.strictEqual(result, null);
});

test('POST approve validate middleware: null code is allowed (optional nullable)', async () => {
  const mw = getMiddleware(orderRouter, '/:id/approve', 'post');
  const validateMiddleware = mw[1];
  const req = makeReq({ body: { receiverEconomicActivityCode: null } });
  const result = await runMiddleware(validateMiddleware, req, makeRes());
  assert.strictEqual(result, null, 'null code must be allowed (nullable schema)');
});

test('POST approve validate middleware: code > 50 chars → validation error response', async () => {
  const mw = getMiddleware(orderRouter, '/:id/approve', 'post');
  const validateMiddleware = mw[1];
  const req = makeReq({ body: { receiverEconomicActivityCode: 'X'.repeat(51) } });
  const res = makeRes();
  await runMiddleware(validateMiddleware, req, res);
  // validate calls res.status(400).json(...) directly — not next(error)
  assert.strictEqual(res._status, 400, 'code > 50 chars must produce 400 validation error');
});

// ─── Schema module export ─────────────────────────────────────────────────────

test('approveOrderSchema is exported from order.schema.js', () => {
  const { approveOrderSchema } = require('../src/schemas/order.schema');
  assert.ok(approveOrderSchema, 'approveOrderSchema must be exported');
  // Basic parse
  const r = approveOrderSchema.safeParse({});
  assert.strictEqual(r.success, true, 'empty object must be valid');
});

// ─── No raw entity IDs in preview DTO ────────────────────────────────────────

test('buildFiscalReadinessPreviewDto: activity DTO has no internal id or clientLegalEntityId', () => {
  const { buildFiscalReadinessPreviewDto } = require('../src/services/receiver-fiscal-readiness.service');
  const dto = buildFiscalReadinessPreviewDto(1n, {
    state: 'READY',
    entity: { id: 100n, legalName: 'T', identificationType: 'JURIDICA', identificationNumber: '3101000001', verificationStatus: 'VERIFIED', lastVerifiedAt: null },
    eligibleActivities: [{ id: 99n, clientLegalEntityId: 100n, code: '620100', description: 'SW', haciendaStatus: 'A', haciendaType: 'P', isCurrentlyReturned: true }],
    allActivities: [],
  });

  const act = dto.eligibleActivities[0];
  assert.ok(!('id' in act), 'activity id must not be exposed in DTO');
  assert.ok(!('clientLegalEntityId' in act), 'clientLegalEntityId must not be exposed');
  assert.ok(!('isCurrentlyReturned' in act), 'isCurrentlyReturned must not be exposed');
});
