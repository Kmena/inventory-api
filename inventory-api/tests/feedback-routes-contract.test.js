'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

process.env.BROWSER_SESSION_STORE_MODE = 'memory';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-feedback-routes';

const { enableDbFreeAuthSeams } = require('./helpers/db-free-auth');
const restoreAuthSeams = enableDbFreeAuthSeams([
  { id: '1', username: 'root-user', fullName: 'Root User', companyId: null, role: { code: 'root' }, permissions: [] },
  { id: '2', username: 'admin-user', fullName: 'Admin User', companyId: '10', role: { code: 'admin' }, permissions: [] },
]);
process.on('exit', restoreAuthSeams);

const routesSource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'routes', 'feedback.routes.js'),
  'utf-8',
);
const appSource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'app.js'),
  'utf-8',
);

// ── Static contract assertions ─────────────────────────────────────────────

test('feedback.routes.js uses authenticate middleware on all routes', () => {
  assert.match(routesSource, /router\.use\(authenticate\)/);
});

test('feedback.routes.js registers POST / with validate(createFeedbackSchema)', () => {
  assert.match(routesSource, /router\.post\(\s*['"]\//);
  assert.match(routesSource, /validate\(createFeedbackSchema\)/);
});

test('feedback.routes.js registers GET /admin with authorizeAccessPolicy feedback.list-global', () => {
  assert.match(routesSource, /router\.get\(\s*['"]\/admin['"]/);
  assert.match(routesSource, /authorizeAccessPolicy\(['"]feedback\.list-global['"]\)/);
});

test('feedback.routes.js registers PATCH /admin/:id/resolve with authorizeAccessPolicy feedback.resolve', () => {
  assert.match(routesSource, /router\.patch\(\s*['"]\/admin\/:id\/resolve['"]/);
  assert.match(routesSource, /authorizeAccessPolicy\(['"]feedback\.resolve['"]\)/);
});

test('feedback.routes.js uses parseInt (not parseBigIntId) for id parsing', () => {
  assert.match(routesSource, /parseInt\(req\.params\.id,\s*10\)/);
  assert.doesNotMatch(routesSource, /parseBigIntId/);
});

test('app.js mounts feedbackRouter at /api/feedback', () => {
  assert.match(appSource, /app\.use\(\s*['"]\/api\/feedback['"]/);
  assert.match(appSource, /feedbackRouter/);
});

test('feedbackRouter is imported from feedback.routes.js in app.js', () => {
  assert.match(appSource, /require\(['"]\.\/routes\/feedback\.routes['"]\)/);
});

test('POST / route: no authorizeAccessPolicy (any authenticated user can submit)', () => {
  // The POST route should only have validate(createFeedbackSchema) as middleware
  // and should NOT have authorizeAccessPolicy
  const postSection = routesSource.match(/router\.post\([^)]+\)[\s\S]*?return next\(error\);\s*\}\s*\}\);/m);
  assert.ok(postSection, 'POST handler block found');
  assert.doesNotMatch(postSection[0], /authorizeAccessPolicy/);
});

// ── Runtime authorization tests (DB-free) ─────────────────────────────────

const feedbackRoutes = require('../src/routes/feedback.routes');

function getRouteLayer(routePath, method) {
  const layer = feedbackRoutes.stack.find(
    (entry) => entry.route && entry.route.path === routePath && entry.route.methods[method],
  );
  assert.ok(layer, `${method.toUpperCase()} route for ${routePath} should exist`);
  return layer.route.stack;
}

/**
 * Run only the first handler in a route stack with a mocked auth context.
 * In this project, `router.use(authenticate)` is router-level, so route.stack[0]
 * is the first per-route handler (authorizeAccessPolicy or validate).
 */
async function runGuard(guardFn, auth) {
  let nextError = 'not-called';
  const req = {
    auth,
    browserSessionUser: auth ? {
      id: String(auth.sub || '1'),
      username: auth.username || 'test',
      fullName: 'Test User',
      companyId: auth.companyId || null,
      role: { code: auth.role || null },
      permissions: auth.permissions || [],
      landing: null,
    } : null,
    requestContext: { requestId: 'req-feedback-test-1' },
    params: { id: '1' },
    query: {},
    body: {},
  };
  const res = {
    status: () => res,
    json: () => res,
    send: () => res,
  };
  await guardFn(req, res, (err) => { nextError = err; });
  return nextError;
}

test('GET /admin route exists in router with at least 2 handlers', () => {
  const adminLayer = getRouteLayer('/admin', 'get');
  assert.ok(adminLayer.length >= 2, `Expected at least 2 handlers, got ${adminLayer.length}`);
});

test('GET /admin: authorizeAccessPolicy guard rejects non-root with 403', async () => {
  const adminLayer = getRouteLayer('/admin', 'get');
  const authGuard = adminLayer[0].handle;
  const adminAuth = { sub: '2', username: 'admin-user', role: 'admin', permissions: [], companyId: '10' };
  const result = await runGuard(authGuard, adminAuth);
  assert.equal(result?.statusCode, 403, 'Non-root should get 403 from admin route');
});

test('GET /admin: authorizeAccessPolicy guard passes root user through', async () => {
  const adminLayer = getRouteLayer('/admin', 'get');
  const authGuard = adminLayer[0].handle;
  const rootAuth = { sub: '1', username: 'root-user', role: 'root', permissions: [], companyId: null };
  const result = await runGuard(authGuard, rootAuth);
  assert.equal(result, undefined, 'Root user should pass auth guard');
});

test('PATCH /admin/:id/resolve: authorizeAccessPolicy guard rejects non-root with 403', async () => {
  const resolveLayer = getRouteLayer('/admin/:id/resolve', 'patch');
  const authGuard = resolveLayer[0].handle;
  const adminAuth = { sub: '2', username: 'admin-user', role: 'admin', permissions: [], companyId: '10' };
  const result = await runGuard(authGuard, adminAuth);
  assert.equal(result?.statusCode, 403, 'Non-root should get 403 from resolve route');
});

test('PATCH /admin/:id/resolve: authorizeAccessPolicy guard passes root user through', async () => {
  const resolveLayer = getRouteLayer('/admin/:id/resolve', 'patch');
  const authGuard = resolveLayer[0].handle;
  const rootAuth = { sub: '1', username: 'root-user', role: 'root', permissions: [], companyId: null };
  const result = await runGuard(authGuard, rootAuth);
  assert.equal(result, undefined, 'Root user should pass resolve auth guard');
});

test('FEEDBACK_CONTEXTS includes all approved contexts (DEC-011 Option A)', () => {
  const { FEEDBACK_CONTEXTS } = require('../src/schemas/feedback.schema');
  const expected = [
    'rfq', 'billing', 'produccion', 'recibo',
    'cliente', 'usuario', 'manual',
    'planificacion', 'compras',
  ];
  expected.forEach((ctx) => assert.ok(FEEDBACK_CONTEXTS.includes(ctx), `Missing context: ${ctx}`));
  assert.equal(FEEDBACK_CONTEXTS.length, 9, 'FEEDBACK_CONTEXTS must have exactly 9 values');
});
