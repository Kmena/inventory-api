const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');

// MASTER-007 / NPP-TASK-009 — CustomerEntitlement skeleton tenant isolation.
//
// Verifies that the Wave 1 read-only skeleton:
//   * Rejects reads with 403 when auth.companyId is missing (fail-closed).
//   * Always scopes repository reads by companyId (no unscoped path).
//   * Returns 404 when the entitlement belongs to another company, and
//     never leaks a foreign entitlement.
//   * Route module wires authenticate + authorizeAccessPolicy for both
//     list and detail endpoints.
//
// The service is exercised with an in-memory repository stub loaded via a
// Module._load override so no live database is required. This mirrors the
// pattern already used by fb6-fb7-migration-regression.test.js.

const REPO_PATH = path.resolve(__dirname, '../src/repositories/entitlement.repository.js');
const PRISMA_PATH = path.resolve(__dirname, '../src/lib/prisma.js');
const SERVICE_PATH = path.resolve(__dirname, '../src/services/entitlement.service.js');

function withRepoStub(stub, run) {
  const originalLoad = Module._load;
  const repoStub = {
    listByCompany: stub.listByCompany || (async () => ({ items: [], total: 0 })),
    getByIdForCompany: stub.getByIdForCompany || (async () => null),
  };
  Module._load = function patchedLoad(request, parent, ...rest) {
    const resolved = (() => {
      try {
        return Module._resolveFilename(request, parent);
      } catch {
        return null;
      }
    })();
    if (resolved === REPO_PATH) return repoStub;
    if (resolved === PRISMA_PATH) return {}; // never touched via the stub
    return originalLoad.call(this, request, parent, ...rest);
  };
  // Force service to re-require the stubbed repository.
  delete require.cache[SERVICE_PATH];
  try {
    return run(require(SERVICE_PATH));
  } finally {
    Module._load = originalLoad;
    delete require.cache[SERVICE_PATH];
  }
}

test('listCompanyEntitlements fails closed with 403 when auth.companyId is missing', async () => {
  await withRepoStub({}, async (entitlementService) => {
    await assert.rejects(
      () => entitlementService.listCompanyEntitlements(
        { sub: '10', permissions: ['entitlements.view'] },
        { skip: 0, take: 10 },
      ),
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, 'forbidden');
        return true;
      },
    );
  });
});

test('listCompanyEntitlements passes auth.companyId to the repository (tenant scope enforced)', async () => {
  let seenCompanyId = null;
  await withRepoStub(
    {
      listByCompany: async (companyId, pagination) => {
        seenCompanyId = companyId;
        assert.equal(pagination.skip, 0);
        assert.equal(pagination.take, 20);
        assert.ok(pagination.filters, 'lifecycle filters must be passed after MASTER-015');
        return { items: [], total: 0 };
      },
    },
    async (entitlementService) => {
      const result = await entitlementService.listCompanyEntitlements(
        { sub: '10', companyId: '42', permissions: ['entitlements.view'] },
        { skip: 0, take: 20 },
      );
      assert.equal(seenCompanyId, 42n);
      assert.deepEqual(result, { items: [], total: 0 });
    },
  );
});

test('getCompanyEntitlement returns 404 when the entitlement does not exist OR belongs to another company', async () => {
  // The repository stub always returns null; the service must not distinguish
  // "not found" from "foreign tenant" — both surface as the same 404 to avoid
  // leaking existence across tenants.
  await withRepoStub(
    {
      getByIdForCompany: async (id, companyId) => {
        assert.equal(companyId, 42n);
        return null;
      },
    },
    async (entitlementService) => {
      await assert.rejects(
        () => entitlementService.getCompanyEntitlement(999n, {
          sub: '10',
          companyId: '42',
          permissions: ['entitlements.view'],
        }),
        (err) => {
          assert.equal(err.statusCode, 404);
          assert.equal(err.code, 'entitlement_not_found');
          return true;
        },
      );
    },
  );
});

test('getCompanyEntitlement fails closed with 403 when auth.companyId is missing (fail-closed before repo call)', async () => {
  let repoCalled = false;
  await withRepoStub(
    {
      getByIdForCompany: async () => {
        repoCalled = true;
        return null;
      },
    },
    async (entitlementService) => {
      await assert.rejects(
        () => entitlementService.getCompanyEntitlement(1n, { sub: '10', permissions: ['entitlements.view'] }),
        (err) => {
          assert.equal(err.statusCode, 403);
          return true;
        },
      );
      assert.equal(repoCalled, false, 'repository must not be called when the tenant scope is missing');
    },
  );
});

test('getCompanyEntitlement serializes BigInt IDs and Decimals as strings', async () => {
  await withRepoStub(
    {
      getByIdForCompany: async () => ({
        id: 5n,
        companyId: 42n,
        clientId: 7n,
        productId: 8n,
        status: 'ACTIVE',
        entitlementKind: 'SUBSCRIPTION',
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: null,
        activatedAt: new Date('2026-01-01T00:00:00.000Z'),
        activationSource: 'PAYMENT_APPROVAL',
        cancelledAt: null,
        priceSnapshot: { toString: () => '99.99' },
        currencySnapshot: 'CRC',
        validityCountSnapshot: 12,
        validityUnitSnapshot: 'MONTH',
        billingIntervalSnapshot: 'MONTHLY',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    },
    async (entitlementService) => {
      const result = await entitlementService.getCompanyEntitlement(5n, {
        companyId: '42',
        permissions: ['entitlements.view'],
      });
      assert.equal(typeof result.id, 'string');
      assert.equal(result.id, '5');
      assert.equal(result.companyId, '42');
      assert.equal(result.priceSnapshot, '99.99');
      assert.equal(result.startDate, '2026-01-01T00:00:00.000Z');
    },
  );
});

// ---------------------------------------------------------------------------
// Route surface guarantees (skeleton must be authenticated + permission-gated)
// ---------------------------------------------------------------------------

test('entitlement.routes wires authenticate and entitlements.view policy on list + detail', () => {
  const fs = require('node:fs');
  const src = fs.readFileSync(
    path.resolve(__dirname, '../src/routes/entitlement.routes.js'),
    'utf8',
  );
  assert.match(src, /router\.use\(authenticate\)/, 'authenticate middleware must be applied at the router level');
  assert.match(src, /router\.get\(\s*'\/'\s*,\s*authorizeAccessPolicy\('entitlements\.view'\)/);
  assert.match(src, /router\.get\(\s*'\/:id'\s*,\s*authorizeAccessPolicy\('entitlements\.view'\)/);

  // Lifecycle endpoints were intentionally added in MASTER-015 after the
  // Wave 1 skeleton. Read endpoints must remain authenticated and view-gated.
  assert.match(src, /router\.post\(\s*'\/manual-activate'\s*,\s*authorizeAccessPolicy\('entitlements\.activate\.manual'\)/);
  assert.match(src, /router\.post\(\s*'\/:id\/cancel'\s*,\s*authorizeAccessPolicy\('entitlements\.manage'\)/);
  assert.match(src, /router\.post\(\s*'\/:id\/renew'\s*,\s*authorizeAccessPolicy\('entitlements\.manage'\)/);
});

test('app.js registers /api/entitlements with medium payload parsers', () => {
  const fs = require('node:fs');
  const src = fs.readFileSync(path.resolve(__dirname, '../src/app.js'), 'utf8');
  assert.match(
    src,
    /app\.use\('\/api\/entitlements',\s*\.\.\.mediumPayloadParsers,\s*entitlementRouter\)/,
  );
  assert.match(src, /const entitlementRouter = require\('\.\/routes\/entitlement\.routes'\)/);
});
