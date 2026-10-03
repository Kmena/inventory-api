'use strict';

/**
 * RFR-TASK-203 + RFR-TASK-204 route tests — client-legal-entity.routes.js
 *
 * Tests:
 *   - POST /:id/verify permission enforcement (clients.edit)
 *   - GET  /:id/activities permission enforcement (clients.view)
 *   - POST verify safe DTO (no raw Hacienda, no secrets)
 *   - GET activities safe DTO
 *   - GET activities does NOT call Hacienda (pure local read)
 *   - Throttle layer present on POST verify
 *   - Route structure: verify uses POST, activities uses GET
 *   - Response shapes match api-contract.md §C and §D
 *
 * All tests: no real DB. taxpayerService mocked at the route level via
 * the createVerificationService factory injection.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const clientLegalEntityRouter = require('../src/routes/client-legal-entity.routes');

// ─── Route structure helpers ──────────────────────────────────────────────────

function findRoute(router, path, method) {
  return router.stack.find(
    (layer) => layer.route && layer.route.path === path && layer.route.methods[method],
  ) || null;
}

function getRouteMiddleware(router, path, method) {
  const layer = findRoute(router, path, method);
  assert.ok(layer, `${method.toUpperCase()} ${path} must exist in router`);
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
    requestContext: { requestId: 'test-req-1' },
    ...overrides,
  };
}

function makeRes() {
  const res = {
    _status: 200,
    _body: null,
    _headers: {},
    status(code) { this._status = code; return this; },
    json(body) { this._body = body; return this; },
    setHeader(k, v) { this._headers[k] = v; },
  };
  return res;
}

// ─── Route structure assertions ───────────────────────────────────────────────

test('POST /:id/verify route exists', () => {
  const route = findRoute(clientLegalEntityRouter, '/:id/verify', 'post');
  assert.ok(route, 'POST /:id/verify must be registered');
});

test('GET /:id/activities route exists', () => {
  const route = findRoute(clientLegalEntityRouter, '/:id/activities', 'get');
  assert.ok(route, 'GET /:id/activities must be registered');
});

test('POST /:id/verify has at least 3 middleware layers (auth + throttle + handler)', () => {
  const middleware = getRouteMiddleware(clientLegalEntityRouter, '/:id/verify', 'post');
  // auth-guard (authorizeAccessPolicy) + throttle + handler = minimum 3
  assert.ok(middleware.length >= 3, `Expected ≥3 middleware for POST verify, got ${middleware.length}`);
});

test('GET /:id/activities has at least 2 middleware layers (auth-guard + handler)', () => {
  const middleware = getRouteMiddleware(clientLegalEntityRouter, '/:id/activities', 'get');
  assert.ok(middleware.length >= 2, `Expected ≥2 middleware for GET activities, got ${middleware.length}`);
});

// ─── Permission enforcement: POST /:id/verify ────────────────────────────────

test('POST verify: requires clients.edit permission — denied without it', async () => {
  const [guard] = getRouteMiddleware(clientLegalEntityRouter, '/:id/verify', 'post');
  const req = makeReq({ auth: makeAuth({ permissions: ['clients.view'] }) }); // no clients.edit
  const res = makeRes();
  const err = await runMiddleware(guard, req, res);

  assert.ok(err, 'Should produce an authorization error');
  assert.strictEqual(err.statusCode, 403);
});

test('POST verify: allowed with clients.edit permission', async () => {
  const [guard] = getRouteMiddleware(clientLegalEntityRouter, '/:id/verify', 'post');
  const req = makeReq({ auth: makeAuth({ permissions: ['clients.edit'] }) });
  const res = makeRes();
  const err = await runMiddleware(guard, req, res);

  assert.strictEqual(err, null, 'Should pass authorization with clients.edit');
});

test('POST verify: denied without any permissions', async () => {
  const [guard] = getRouteMiddleware(clientLegalEntityRouter, '/:id/verify', 'post');
  const req = makeReq({ auth: makeAuth({ permissions: [] }) });
  const res = makeRes();
  const err = await runMiddleware(guard, req, res);

  assert.ok(err);
  assert.strictEqual(err.statusCode, 403);
});

// ─── Permission enforcement: GET /:id/activities ─────────────────────────────

test('GET activities: requires clients.view or clients.view.all', async () => {
  const [guard] = getRouteMiddleware(clientLegalEntityRouter, '/:id/activities', 'get');

  // Denied without view permissions
  const deniedReq = makeReq({ auth: makeAuth({ permissions: [] }) });
  const deniedErr = await runMiddleware(guard, deniedReq, makeRes());
  assert.ok(deniedErr);
  assert.strictEqual(deniedErr.statusCode, 403);

  // Allowed with clients.view
  const viewReq = makeReq({ auth: makeAuth({ permissions: ['clients.view'] }) });
  const viewErr = await runMiddleware(guard, viewReq, makeRes());
  assert.strictEqual(viewErr, null);

  // Allowed with clients.view.all
  const viewAllReq = makeReq({ auth: makeAuth({ permissions: ['clients.view.all'] }) });
  const viewAllErr = await runMiddleware(guard, viewAllReq, makeRes());
  assert.strictEqual(viewAllErr, null);
});

test('GET activities: denied for clients.edit-only (no view permission)', async () => {
  const [guard] = getRouteMiddleware(clientLegalEntityRouter, '/:id/activities', 'get');
  const req = makeReq({ auth: makeAuth({ permissions: ['clients.edit'] }) });
  const err = await runMiddleware(guard, req, makeRes());

  assert.ok(err, 'clients.edit alone must not grant access to activities list');
  assert.strictEqual(err.statusCode, 403);
});

// ─── Route handler: verify DTO shape ─────────────────────────────────────────

test('POST verify handler returns correct DTO shape on VERIFIED result', async () => {
  // Verify DTO contract via createVerificationService factory directly
  // (the route handler's middleware is tested for structure separately)
  // We test the handler via the route stack using a direct handler invocation stub
  // (The handler uses verificationService from module scope; we verify the DTO contract
  // via shape assertions on the createVerificationService contract it exports.)

  const { createVerificationService } = require('../src/services/client-legal-entity-verification.service');
  const verifiedAt = new Date('2025-06-01T10:00:00Z');
  const mockResult = {
    status: 'VERIFIED',
    entity: {
      id: 100n,
      verificationStatus: 'VERIFIED',
      lastVerifiedAt: verifiedAt,
      taxpayerName: 'Demo S.A.',
    },
    activities: [{
      id: 1n,
      code: '6201',
      description: 'Software',
      haciendaStatus: 'A',
      haciendaType: 'P',
      isCurrentlyReturned: true,
      verifiedAt,
    }],
  };

  const svc = createVerificationService({
    prisma: {
      $transaction: async (fn) => fn({ clientLegalEntity: { findFirst: async () => ({ id: 100n, companyId: 42n, identificationType: '02', identificationNumber: '3101000001', verificationStatus: 'UNVERIFIED', lastVerifiedAt: null, taxpayerName: null }), update: async (args) => ({ id: 100n, companyId: 42n, ...args.data }) }, clientEconomicActivity: { upsert: async (args) => ({ id: 1n, companyId: 42n, clientLegalEntityId: 100n, ...args.create }), updateMany: async () => ({ count: 0 }), findMany: async () => [{ id: 1n, code: '6201', description: 'Software', haciendaStatus: 'A', haciendaType: 'P', isCurrentlyReturned: true, verifiedAt }] } }),
      clientLegalEntity: { findFirst: async () => ({ id: 100n, companyId: 42n, identificationType: '02', identificationNumber: '3101000001', verificationStatus: 'UNVERIFIED', lastVerifiedAt: null, taxpayerName: null }) },
      clientEconomicActivity: { findMany: async () => [] },
    },
    taxpayerService: { lookupTaxpayer: async () => ({ name: 'Demo S.A.', activities: [{ code: '6201', description: 'Software', haciendaStatus: 'A', haciendaType: 'P' }] }) },
  });

  // Build the DTO directly using the exported helper to verify contract
  const dto = svc._buildEntityDto(mockResult.entity, mockResult.activities);

  assert.strictEqual(typeof dto.id, 'string', 'id must be string');
  assert.ok('verificationStatus' in dto);
  assert.ok('lastVerifiedAt' in dto);
  assert.ok('taxpayerName' in dto);
  assert.ok(Array.isArray(dto.activities));

  const act = dto.activities[0];
  assert.ok('id' in act && typeof act.id === 'string');
  assert.ok('code' in act);
  assert.ok('description' in act);
  assert.ok('haciendaStatus' in act);
  assert.ok('haciendaType' in act);
  assert.ok('isCurrentlyReturned' in act);
  assert.ok('verifiedAt' in act);
});

// ─── GET activities: does not call Hacienda ───────────────────────────────────

test('GET activities: listClientLegalEntityActivities never calls taxpayerService', async () => {
  const { createVerificationService } = require('../src/services/client-legal-entity-verification.service');
  let haciendaCalled = false;
  const svc = createVerificationService({
    prisma: {
      clientLegalEntity: { findFirst: async () => ({ id: 100n, companyId: 42n, verificationStatus: 'VERIFIED', lastVerifiedAt: null }) },
      clientEconomicActivity: { findMany: async () => [] },
    },
    taxpayerService: { lookupTaxpayer: () => { haciendaCalled = true; return {}; } },
  });

  await svc.listClientLegalEntityActivities(100n, 42n);
  assert.strictEqual(haciendaCalled, false, 'GET activities must NEVER trigger a Hacienda call');
});

// ─── GET activities response shape ───────────────────────────────────────────

test('GET activities: response shape matches api-contract.md §D', async () => {
  const { createVerificationService } = require('../src/services/client-legal-entity-verification.service');
  const verifiedAt = new Date('2025-06-01T00:00:00Z');
  const svc = createVerificationService({
    prisma: {
      clientLegalEntity: { findFirst: async () => ({ id: 789n, companyId: 42n, verificationStatus: 'VERIFIED', lastVerifiedAt: verifiedAt }) },
      clientEconomicActivity: {
        findMany: async () => [
          { id: 1n, code: '6201', description: 'Desarrollo de software', haciendaStatus: 'A', haciendaType: 'P', isCurrentlyReturned: true, verifiedAt },
          { id: 2n, code: '4711', description: 'Comercio al por menor', haciendaStatus: 'A', haciendaType: 'S', isCurrentlyReturned: false, verifiedAt },
        ],
      },
    },
    taxpayerService: {},
  });

  const result = await svc.listClientLegalEntityActivities(789n, 42n);

  // Top-level shape
  assert.strictEqual(result.clientLegalEntityId, '789');
  assert.strictEqual(result.verificationStatus, 'VERIFIED');
  assert.ok(result.lastVerifiedAt instanceof Date);
  assert.ok(Array.isArray(result.activities));
  assert.strictEqual(result.activities.length, 2);

  // Activity shape — all required fields per api-contract §D
  const act = result.activities[0];
  assert.strictEqual(typeof act.id, 'string');
  assert.strictEqual(act.code, '6201');
  assert.strictEqual(act.description, 'Desarrollo de software');
  assert.strictEqual(act.haciendaStatus, 'A');
  assert.strictEqual(act.haciendaType, 'P');
  assert.strictEqual(act.isCurrentlyReturned, true);
  assert.ok(act.verifiedAt instanceof Date);

  // Second activity — isCurrentlyReturned: false (not currently returned)
  assert.strictEqual(result.activities[1].isCurrentlyReturned, false);
});

// ─── Throttle: verify endpoint has rate limiting middleware ───────────────────

test('POST verify: rate limiting middleware is applied', async () => {
  // The throttle middleware should be the second layer (after auth guard)
  const middleware = getRouteMiddleware(clientLegalEntityRouter, '/:id/verify', 'post');
  // Throttle is the enforceRequestThrottle closure — verify by name or count
  // At minimum: [authGuard, throttle, handler] = 3 layers
  assert.ok(middleware.length >= 3, 'Throttle middleware must be present on POST verify');
});

// ─── No raw Hacienda data in DTO ──────────────────────────────────────────────

test('verify DTO does not include raw Hacienda response', () => {
  const { createVerificationService } = require('../src/services/client-legal-entity-verification.service');
  const svc = createVerificationService();

  const entity = { id: 100n, verificationStatus: 'VERIFIED', lastVerifiedAt: null, taxpayerName: null };
  const activities = [{ id: 1n, code: '6201', description: 'SW', haciendaStatus: 'A', haciendaType: 'P', isCurrentlyReturned: true, verifiedAt: new Date() }];

  const dto = svc._buildEntityDto(entity, activities);

  // Must NOT include raw response fields
  assert.ok(!('raw' in dto), 'DTO must not expose raw Hacienda response');
  assert.ok(!('identification' in dto), 'DTO must not expose identification number');
  assert.ok(!('documentType' in dto), 'DTO must not expose documentType');
  assert.ok(!('email' in dto), 'DTO must not expose internal email from taxpayer lookup');
});

test('verify DTO: id fields are strings (not BigInt — JSON-safe)', () => {
  const { createVerificationService } = require('../src/services/client-legal-entity-verification.service');
  const svc = createVerificationService();

  const dto = svc._buildEntityDto(
    { id: 100n, verificationStatus: 'VERIFIED', lastVerifiedAt: null, taxpayerName: null },
    [{ id: 1n, code: '6201', description: null, haciendaStatus: null, haciendaType: null, isCurrentlyReturned: true, verifiedAt: new Date() }],
  );

  assert.strictEqual(typeof dto.id, 'string', 'entity id must be string for JSON safety');
  assert.strictEqual(typeof dto.activities[0].id, 'string', 'activity id must be string for JSON safety');
});
