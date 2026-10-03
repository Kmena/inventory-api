'use strict';

/**
 * Wave 6 — Security + Tenant Isolation + Error Handling
 *
 * Spec: specs/inventori-fiscal-invoice-history-and-detail/
 * Coverage:
 *   W6-AUTH    — authentication contract (source + service level)
 *   W6-TENANT  — invoice + artifact tenant isolation (service + proxy)
 *   W6-INTERNAL— FiscalIntent internal fields excluded (serialized JSON proof)
 *   W6-INPUT   — server-side artifact type allowlist / input hardening
 *   W6-CDISP   — Content-Disposition filename sanitization
 *   W6-CTYPE   — Content-Type enforcement / artifact type confusion
 *   W6-ERR     — Billing error → safe HTTP mapping, no credential leaks
 *   W6-BILLING — Billing trust boundary (config from DB, not caller)
 *   W6-INT     — Artifact byte integrity (proxy returns unmodified bytes)
 *   W6-XSS     — Frontend rendering XSS / hostile input escaping
 *   W6-STORE   — No fiscal data in localStorage/sessionStorage/IndexedDB
 *   W6-REG     — Regression: Waves 1–5 still functional
 *   W6-013B    — TASK-013b reconciliation status mapping intact
 *
 * Test level classification used throughout:
 *   [UNIT]       pure function, no I/O
 *   [SVC-MOCK]   service with stubbed repository
 *   [PROXY-MOCK] proxy service with mock DB + mock Billing client
 *   [SRC]        source-text contract assertion (weakest — only for authz middleware)
 *   [RENDER]     vm.runInContext browser-script execution
 */

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const vm     = require('node:vm');

// ── Module under test ────────────────────────────────────────────────────────

const {
  buildContentDisposition,
  mapArtifactBillingErrorToHttp,
  resolveArtifactOwnershipChain,
  getFiscalArtifact,
  listFiscalArtifacts,
  INVENTORI_TO_BILLING_ARTIFACT_TYPE,
  ARTIFACT_MIME_BY_BILLING_TYPE,
} = require('../src/services/fiscal-artifact-proxy.service');

const { BillingClientError } = require('../src/services/billing-api-client.service');
const { parseBigIntId }        = require('../src/lib/parse');
const invoiceService           = require('../src/services/invoice.service');
const invoiceRepository        = require('../src/repositories/invoice.repository');
const { resolveCanonicalFiscalStatus } =
  require('../src/services/fiscal-reconciliation.service');

const rootPublicPath = path.join(__dirname, '..', 'src', 'public', 'root');
const routesPath     = path.join(__dirname, '..', 'src', 'routes');

// ── Shared stubs / helpers ───────────────────────────────────────────────────

function withStubs(moduleRef, stubs, run) {
  const originals = Object.keys(stubs).map((k) => [k, moduleRef[k]]);
  Object.assign(moduleRef, stubs);
  return Promise.resolve().then(run).finally(() => {
    for (const [k, v] of originals) moduleRef[k] = v;
  });
}

/** Minimal invoice stub with optional overrides. */
function makeInvoice(overrides = {}) {
  return {
    id: 1623n, number: 'INV-963', clientId: 42n, orderId: null,
    amount: 5000, status: 'PENDING',
    issuedAt: null, dueAt: null, paidAt: null,
    client: { id: 42n, name: 'Test Client S.A.' },
    order: null, payments: [],
    fiscalIntent: null,
    ...overrides,
  };
}

/** Minimal intent with all INTERNAL fields populated (must never reach browser). */
function makeIntentWithInternals(overrides = {}) {
  return {
    // ─ INTERNAL ────
    id: 99n, invoiceId: 1623n, companyId: 7n,
    billingIntegrationConfigId: 3n,
    idempotencyKey:         'never-expose-this',
    billingFiscalDocumentId: 'bf52-bad1-internal-id',
    billingStatus:          'HACIENDA_ACCEPTED',
    failureCode:            'SOME_INTERNAL_CODE',
    failureMessage:         'INTERNAL: secret-ref:arn:aws:secretsmanager:us-east-1:12345',
    attemptCount: 3, lastAttemptAt: new Date(), nextAttemptAt: null,
    lastSyncAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
    billingPayload: { sensitive: true },
    metadata: { billingAcceptedAt: '2025-01-15T14:30:00.000Z', secretRef: 'internal' },
    processingNodeId: 'node-1',
    // ─ SAFE ────
    status: 'ACCEPTED',
    clave:       '50625092600020753025100100001010000000001101924748',
    consecutive: '00100001010000000001',
    ...overrides,
  };
}

const INTERNAL_FIELDS = [
  'failureMessage', 'failureCode', 'retryCount', 'nextRetryAt',
  'lastAttemptAt', 'idempotencyKey', 'billingFiscalDocumentId',
  'billingStatus', 'processingNodeId', 'billingPayload',
  'attemptCount', 'lastSyncAt', 'billingIntegrationConfigId', 'nextAttemptAt',
];

/** Mock DB that returns a company-scoped invoice. */
function makeMockDb({ invoiceCompanyId = 7n, withIntent = true, intentOverrides = {} } = {}) {
  const intent = withIntent
    ? {
        id: 99n, invoiceId: 1623n, companyId: invoiceCompanyId,
        billingFiscalDocumentId: 'billing-doc-001',
        status: 'ACCEPTED',
        clave: '50625092600020753025100100001010000000001101924748',
        integrationConfig: {
          billingCompanyId: 'billing-co-abc',
          billingEnvironment: 'SANDBOX',
          baseUrl: 'http://billing.local',
          billingCredentialSecretRef: 'arn:aws:secret:test',
        },
        ...intentOverrides,
      }
    : null;

  return {
    invoice: {
      findFirst: async ({ where }) => {
        // Only return when the companyId matches (tenant isolation)
        if (where.client?.companyId !== undefined &&
            where.client.companyId.toString() !== invoiceCompanyId.toString()) {
          return null;
        }
        return { id: 1623n, status: 'PAID' };
      },
    },
    invoiceFiscalIntent: {
      findUnique: async () => intent,
    },
  };
}

/** Minimal mock Billing client that returns fixed bytes. */
function makeMockBillingClient(opts = {}) {
  const bytes  = opts.bytes  || Buffer.from('%PDF-1.4 test-bytes');
  const type   = opts.type   || 'application/pdf';
  const error  = opts.error  || null;

  return {
    getArtifact:  async () => {
      if (error) throw error;
      return { bytes, contentType: type };
    },
    listArtifacts: async () => {
      if (error) throw error;
      return opts.artifacts || [
        { id: 'art-1', type: 'PDF', contentType: 'application/pdf',
          sha256: 'abc123', sizeBytes: bytes.length, createdAt: '2025-01-15T00:00:00Z' },
      ];
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// W6-AUTH — Authentication contracts
// ─────────────────────────────────────────────────────────────────────────────

test('[W6-AUTH-001] [SRC] invoice.routes.js applies authenticate to ALL routes via router.use', () => {
  const src = fs.readFileSync(path.join(routesPath, 'invoice.routes.js'), 'utf8');
  assert.ok(
    src.includes('router.use(authenticate)'),
    'invoice.routes.js must apply authenticate middleware to all routes via router.use()',
  );
});

test('[W6-AUTH-002] [SVC-MOCK] getInvoice without companyId → 403 forbidden', async () => {
  await assert.rejects(
    () => invoiceService.getInvoice(1623n, { companyId: null }),
    (err) => { assert.equal(err.statusCode, 403); assert.equal(err.code, 'forbidden'); return true; },
  );
});

test('[W6-AUTH-003] [SVC-MOCK] listInvoices without companyId → 403 forbidden', async () => {
  await assert.rejects(
    () => invoiceService.listInvoices({ companyId: undefined }),
    (err) => { assert.equal(err.statusCode, 403); return true; },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// W6-TENANT — Invoice service tenant isolation
// ─────────────────────────────────────────────────────────────────────────────

test('[W6-TENANT-001] [SVC-MOCK] own-company invoice detail → allowed with fiscal data', async () => {
  const inv = makeInvoice({ fiscalIntent: makeIntentWithInternals() });
  const result = await withStubs(invoiceRepository,
    { findCompanyInvoiceById: async () => inv },
    () => invoiceService.getInvoice(1623n, { companyId: '7' }),
  );
  assert.ok(result, 'response must not be null');
  assert.equal(result.fiscal?.status, 'ACCEPTED');
  assert.equal(result.invoiceNumber, 'INV-963');
});

test('[W6-TENANT-002] [SVC-MOCK] foreign-company invoice detail → 404 (no fiscal data leaked)', async () => {
  await withStubs(invoiceRepository,
    { findCompanyInvoiceById: async () => null },
    async () => {
      await assert.rejects(
        () => invoiceService.getInvoice(1623n, { companyId: '999' }),
        (err) => {
          assert.equal(err.statusCode, 404);
          assert.equal(err.code, 'not_found');
          // Must not expose any fiscal information in the error
          const msg = String(err.message || '').toLowerCase();
          assert.ok(!msg.includes('billingfiscal'), 'error must not expose billing IDs');
          assert.ok(!msg.includes('clave'), 'error must not expose clave');
          return true;
        },
      );
    },
  );
});

test('[W6-TENANT-003] [SVC-MOCK] nonexistent invoice → same 404 as foreign-company (no enumeration)', async () => {
  await withStubs(invoiceRepository,
    { findCompanyInvoiceById: async () => null },
    async () => {
      await assert.rejects(
        () => invoiceService.getInvoice(99999n, { companyId: '7' }),
        (err) => { assert.equal(err.statusCode, 404); assert.equal(err.code, 'not_found'); return true; },
      );
    },
  );
});

test('[W6-TENANT-004] [SVC-MOCK] listInvoices scopes all results to authenticated company', async () => {
  let capturedCompanyId = null;
  await withStubs(invoiceRepository,
    { findCompanyInvoices: async (companyId) => { capturedCompanyId = companyId; return []; } },
    () => invoiceService.listInvoices({ companyId: '42' }),
  );
  assert.equal(capturedCompanyId, 42n, 'repository MUST be called with the authenticated companyId');
});

// ─────────────────────────────────────────────────────────────────────────────
// W6-TENANT — Artifact proxy ownership chain isolation
// ─────────────────────────────────────────────────────────────────────────────

test('[W6-TENANT-005] [PROXY-MOCK] own-company artifact chain resolves successfully', async () => {
  const db = makeMockDb({ invoiceCompanyId: 7n });
  const { intent, config } = await resolveArtifactOwnershipChain(1623n, 7n, db);
  assert.ok(intent, 'intent must be resolved');
  assert.ok(config, 'config must be resolved');
  assert.equal(config.billingCompanyId, 'billing-co-abc');
});

test('[W6-TENANT-006] [PROXY-MOCK] foreign-company invoice in artifact chain → 404', async () => {
  // DB set to company 7 — caller uses company 99
  const db = makeMockDb({ invoiceCompanyId: 7n });
  await assert.rejects(
    () => resolveArtifactOwnershipChain(1623n, 99n, db),
    (err) => {
      assert.equal(err.statusCode, 404);
      assert.equal(err.code, 'not_found');
      return true;
    },
  );
});

test('[W6-TENANT-007] [PROXY-MOCK] intent.companyId mismatch → 403 (defense in depth)', async () => {
  // Invoice passes company filter but intent.companyId doesn't match (edge case)
  const db = {
    invoice: { findFirst: async () => ({ id: 1623n, status: 'PAID' }) },
    invoiceFiscalIntent: {
      findUnique: async () => ({
        id: 99n, invoiceId: 1623n,
        companyId: 9999n, // different from auth companyId (7n)
        billingFiscalDocumentId: 'doc-1',
        integrationConfig: { billingCompanyId: 'bc', billingEnvironment: 'PROD' },
      }),
    },
  };
  await assert.rejects(
    () => resolveArtifactOwnershipChain(1623n, 7n, db),
    (err) => { assert.equal(err.statusCode, 403); assert.equal(err.code, 'forbidden'); return true; },
  );
});

test('[W6-TENANT-008] [PROXY-MOCK] no fiscal intent in artifact chain → 422', async () => {
  const db = makeMockDb({ withIntent: false });
  await assert.rejects(
    () => resolveArtifactOwnershipChain(1623n, 7n, db),
    (err) => { assert.equal(err.statusCode, 422); assert.equal(err.code, 'FISCAL_INTENT_NOT_FOUND'); return true; },
  );
});

test('[W6-TENANT-009] [PROXY-MOCK] intent without billingFiscalDocumentId → 422', async () => {
  const db = makeMockDb({ intentOverrides: { billingFiscalDocumentId: null } });
  await assert.rejects(
    () => resolveArtifactOwnershipChain(1623n, 7n, db),
    (err) => { assert.equal(err.statusCode, 422); assert.equal(err.code, 'ARTIFACT_NOT_READY'); return true; },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// W6-INTERNAL — Serialized JSON output has NO internal FiscalIntent fields
// ─────────────────────────────────────────────────────────────────────────────

// BigInt-safe JSON replacer (matches Express app.js BigInt serialization)
const bigIntReplacer = (_k, v) => (typeof v === 'bigint' ? v.toString() : v);

test('[W6-INTERNAL-001] [SVC-MOCK] getInvoice JSON output: ALL internal fields absent', async () => {
  const inv = makeInvoice({ fiscalIntent: makeIntentWithInternals() });
  const result = await withStubs(invoiceRepository,
    { findCompanyInvoiceById: async () => inv },
    () => invoiceService.getInvoice(1623n, { companyId: '7' }),
  );
  const json = JSON.stringify(result, bigIntReplacer);
  for (const field of INTERNAL_FIELDS) {
    assert.ok(
      !json.includes(JSON.stringify(field).slice(1, -1) + '"'),
      `getInvoice JSON output must not contain internal field: ${field}`,
    );
  }
});

test('[W6-INTERNAL-002] [SVC-MOCK] getInvoice JSON: failureMessage not present (may contain secret refs)', async () => {
  const inv = makeInvoice({
    fiscalIntent: makeIntentWithInternals({
      failureMessage: 'arn:aws:secretsmanager:us-east-1:0123456789:secret:billing/prod',
    }),
  });
  const result = await withStubs(invoiceRepository,
    { findCompanyInvoiceById: async () => inv },
    () => invoiceService.getInvoice(1623n, { companyId: '7' }),
  );
  const json = JSON.stringify(result, bigIntReplacer);
  assert.ok(!json.includes('failureMessage'), 'failureMessage must be absent from detail JSON');
  assert.ok(!json.includes('secretsmanager'), 'secret ARN must not appear in detail JSON');
});

test('[W6-INTERNAL-003] [SVC-MOCK] listInvoices JSON output: ALL internal fields absent', async () => {
  const inv = makeInvoice({ fiscalIntent: makeIntentWithInternals() });
  const result = await withStubs(invoiceRepository,
    { findCompanyInvoices: async () => [inv] },
    () => invoiceService.listInvoices({ companyId: '7' }),
  );
  const json = JSON.stringify(result, bigIntReplacer);
  for (const field of INTERNAL_FIELDS) {
    assert.ok(
      !json.includes('"' + field + '"'),
      `listInvoices JSON output must not contain internal field: "${field}"`,
    );
  }
});

test('[W6-INTERNAL-004] [PROXY-MOCK] listFiscalArtifacts response does NOT expose billingCredentialSecretRef', async () => {
  const db = makeMockDb();
  const client = makeMockBillingClient();
  const artifacts = await listFiscalArtifacts(1623n, 7n, { db, billingClient: client });
  const json = JSON.stringify(artifacts);
  assert.ok(!json.includes('billingCredentialSecretRef'), 'secretRef must not appear in artifact list');
  assert.ok(!json.includes('secretRef'), 'secretRef must not appear in artifact list');
  assert.ok(!json.includes('apiKey'), 'apiKey must not appear in artifact list');
});

test('[W6-INTERNAL-005] [PROXY-MOCK] listFiscalArtifacts response does NOT expose billingFiscalDocumentId', async () => {
  const db = makeMockDb();
  const client = makeMockBillingClient();
  const artifacts = await listFiscalArtifacts(1623n, 7n, { db, billingClient: client });
  const json = JSON.stringify(artifacts);
  // billingFiscalDocumentId is an internal DB field — must not be in the response
  assert.ok(!json.includes('billingFiscalDocumentId'), 'billingFiscalDocumentId must not appear in artifact list');
  // But inventoriType SHOULD be present (it's a safe browser-facing field)
  assert.ok(json.includes('inventoriType'), 'inventoriType must appear in artifact list');
});

// ─────────────────────────────────────────────────────────────────────────────
// W6-INPUT — Server-side artifact type allowlist / input hardening
// ─────────────────────────────────────────────────────────────────────────────

const INVALID_ARTIFACT_TYPES = [
  ['../secret',           'path traversal'],
  ['../../etc/passwd',    'deep path traversal'],
  ['file:///etc/passwd',  'file:// URL'],
  ['http://attacker.com', 'http:// URL'],
  ['https://evil.org',    'https:// URL'],
  ['<script>alert(1)',    'HTML injection'],
  ['',                    'empty string'],
  ['null',                'null string (not a valid type)'],
  ['undefined',           'undefined string'],
  ['%2F..%2Fetc',         'percent-encoded traversal'],
  ['signed_xml',          'underscore variant (not in allowlist)'],
  ['PDF',                 'uppercase (only lowercase keys are valid)'],
  ['hacienda_response',   'underscore variant'],
];

for (const [input, label] of INVALID_ARTIFACT_TYPES) {
  test(`[W6-INPUT] [PROXY-MOCK] invalid artifact type (${label}) → 400 before any DB call`, async () => {
    let dbCalled = false;
    const db = {
      invoice: { findFirst: async () => { dbCalled = true; return null; } },
      invoiceFiscalIntent: { findUnique: async () => { dbCalled = true; return null; } },
    };
    await assert.rejects(
      () => getFiscalArtifact(1623n, input, 7n, { db }),
      (err) => {
        assert.equal(err.statusCode, 400, `${label}: expected 400`);
        assert.equal(err.code, 'ARTIFACT_TYPE_UNSUPPORTED', `${label}: expected ARTIFACT_TYPE_UNSUPPORTED`);
        assert.ok(!dbCalled, `${label}: DB must NOT be called for invalid artifact type`);
        return true;
      },
    );
  });
}

test('[W6-INPUT-VALID] valid artifact types pass the allowlist check (DB called)', async () => {
  // Only test that valid types reach the DB (then fail with 404 because mock DB returns null)
  for (const type of ['pdf', 'signed-xml', 'hacienda-response']) {
    let dbCalled = false;
    const db = {
      invoice: { findFirst: async () => { dbCalled = true; return null; } },
      invoiceFiscalIntent: { findUnique: async () => null },
    };
    await assert.rejects(
      () => getFiscalArtifact(1623n, type, 7n, { db }),
      (err) => {
        assert.notEqual(err.code, 'ARTIFACT_TYPE_UNSUPPORTED', `${type}: must not be rejected as unsupported`);
        assert.ok(dbCalled, `${type}: DB MUST be called for valid artifact type`);
        return true;
      },
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// W6-CDISP — Content-Disposition hardening
// ─────────────────────────────────────────────────────────────────────────────

test('[W6-CDISP-001] [UNIT] normal clave → attachment with safe filename', () => {
  const cd = buildContentDisposition('PDF', '50625092600020753025100100001010000000001101924748', 1623n);
  assert.ok(cd.startsWith('attachment; filename="'), 'must be attachment');
  assert.ok(cd.includes('.pdf'), 'PDF type must produce .pdf extension');
  assert.ok(!cd.includes('/'), 'no path separators');
  assert.ok(!cd.includes('\r') && !cd.includes('\n'), 'no CRLF in Content-Disposition');
});

test('[W6-CDISP-002] [UNIT] CRLF in clave → safe fallback filename', () => {
  const cd = buildContentDisposition('PDF', '5062\r\nHost: evil.com', 1623n);
  assert.ok(!cd.includes('\r'), 'CRLF must be eliminated');
  assert.ok(!cd.includes('\n'), 'LF must be eliminated');
  assert.ok(cd.startsWith('attachment; filename="'), 'must still be attachment');
});

test('[W6-CDISP-003] [UNIT] null byte in clave → safe fallback', () => {
  const cd = buildContentDisposition('SIGNED_XML', 'clave\x00injection', 1623n);
  assert.ok(!cd.includes('\x00'), 'null byte must be absent');
  assert.ok(cd.includes('.xml'), 'must have xml extension');
});

test('[W6-CDISP-004] [UNIT] special chars in clave are stripped (only alphanumeric retained)', () => {
  const cd = buildContentDisposition('SIGNED_XML', 'clave/../../../etc/passwd', 1623n);
  assert.ok(!cd.includes('..'), 'path traversal must be stripped');
  assert.ok(!cd.includes('/'), 'slashes must be stripped');
  // alphanumeric words like 'etc' are safe in an isolated filename — only traversal chars matter
});

test('[W6-CDISP-005] [UNIT] null clave falls back to invoiceId-based filename', () => {
  const cd = buildContentDisposition('PDF', null, 1623n);
  assert.ok(cd.includes('inv-1623') || cd.includes('factura'), 'must include invoiceId fallback');
  assert.ok(cd.includes('.pdf'), 'must still have correct extension');
  assert.ok(!cd.includes('\r') && !cd.includes('\n'), 'no CRLF');
});

test('[W6-CDISP-006] [UNIT] HACIENDA_RESPONSE_XML → respuesta-hacienda prefix', () => {
  const cd = buildContentDisposition('HACIENDA_RESPONSE_XML', 'clave123', 1623n);
  assert.ok(cd.includes('respuesta-hacienda') || cd.includes('hacienda'), 'must use hacienda prefix');
  assert.ok(cd.includes('.xml'), 'must have xml extension');
});

// ─────────────────────────────────────────────────────────────────────────────
// W6-CTYPE — Content-Type enforcement / artifact type confusion
// ─────────────────────────────────────────────────────────────────────────────

test('[W6-CTYPE-001] [UNIT] INVENTORI→BILLING type map: pdf → PDF', () => {
  assert.equal(INVENTORI_TO_BILLING_ARTIFACT_TYPE['pdf'], 'PDF');
});

test('[W6-CTYPE-002] [UNIT] INVENTORI→BILLING type map: signed-xml → SIGNED_XML', () => {
  assert.equal(INVENTORI_TO_BILLING_ARTIFACT_TYPE['signed-xml'], 'SIGNED_XML');
});

test('[W6-CTYPE-003] [UNIT] INVENTORI→BILLING type map: hacienda-response → HACIENDA_RESPONSE_XML', () => {
  assert.equal(INVENTORI_TO_BILLING_ARTIFACT_TYPE['hacienda-response'], 'HACIENDA_RESPONSE_XML');
});

test('[W6-CTYPE-004] [UNIT] PDF → application/pdf MIME (not xml)', () => {
  assert.equal(ARTIFACT_MIME_BY_BILLING_TYPE['PDF'], 'application/pdf');
  assert.notEqual(ARTIFACT_MIME_BY_BILLING_TYPE['PDF'], 'application/xml');
});

test('[W6-CTYPE-005] [UNIT] SIGNED_XML → application/xml MIME (not pdf)', () => {
  assert.equal(ARTIFACT_MIME_BY_BILLING_TYPE['SIGNED_XML'], 'application/xml');
  assert.notEqual(ARTIFACT_MIME_BY_BILLING_TYPE['SIGNED_XML'], 'application/pdf');
});

test('[W6-CTYPE-006] [UNIT] HACIENDA_RESPONSE_XML → application/xml (not pdf)', () => {
  assert.equal(ARTIFACT_MIME_BY_BILLING_TYPE['HACIENDA_RESPONSE_XML'], 'application/xml');
  assert.notEqual(ARTIFACT_MIME_BY_BILLING_TYPE['HACIENDA_RESPONSE_XML'], 'application/pdf');
});

test('[W6-CTYPE-007] [PROXY-MOCK] pdf selector returns pdf MIME (type confusion impossible)', async () => {
  const pdfBytes = Buffer.from('%PDF-1.4 real pdf content');
  const db = makeMockDb();
  const client = makeMockBillingClient({ bytes: pdfBytes, type: 'application/pdf' });
  const result = await getFiscalArtifact(1623n, 'pdf', 7n, { db, billingClient: client });
  assert.equal(result.contentType, 'application/pdf');
  assert.ok(!result.contentType.includes('xml'), 'pdf selector must not return xml MIME');
});

// ─────────────────────────────────────────────────────────────────────────────
// W6-ERR — Billing error sanitization
// ─────────────────────────────────────────────────────────────────────────────

test('[W6-ERR-001] [UNIT] Billing timeout → 504 (safe message)', () => {
  const error = new BillingClientError('timeout', { code: 'BILLING_TIMEOUT' });
  const mapped = mapArtifactBillingErrorToHttp(error);
  assert.equal(mapped.statusCode, 504);
  assert.ok(!mapped.message.includes('apiKey'), '504 message must not contain apiKey');
});

test('[W6-ERR-002] [UNIT] Billing 401 → 502 (no credential details)', () => {
  const error = new BillingClientError('unauthorized', { code: 'BILLING_UNAUTHORIZED', statusCode: 401 });
  const mapped = mapArtifactBillingErrorToHttp(error);
  assert.equal(mapped.statusCode, 502, 'must be 502, not 401 (hides credential config)');
  const msg = (mapped.message || '').toLowerCase();
  assert.ok(!msg.includes('api_key') && !msg.includes('apikey'), 'must not expose API key info');
  assert.ok(!msg.includes('credential') || msg.includes('autenticaci'), 'must not expose raw credential details');
});

test('[W6-ERR-003] [UNIT] Billing 503 → 503 (service unavailable)', () => {
  const error = new BillingClientError('unavailable', { code: 'BILLING_UNAVAILABLE', statusCode: 503 });
  const mapped = mapArtifactBillingErrorToHttp(error);
  assert.equal(mapped.statusCode, 503);
});

test('[W6-ERR-004] [UNIT] Billing 4xx (e.g. 422) → 422', () => {
  const error = new BillingClientError('invalid', { code: 'BILLING_INVALID_REQUEST', statusCode: 422 });
  const mapped = mapArtifactBillingErrorToHttp(error);
  assert.equal(mapped.statusCode, 422);
});

test('[W6-ERR-005] [UNIT] Billing 5xx → 502', () => {
  const error = new BillingClientError('server error', { code: 'BILLING_SERVER_ERROR', statusCode: 502 });
  const mapped = mapArtifactBillingErrorToHttp(error);
  assert.ok(mapped.statusCode >= 500, 'server error must map to 5xx');
});

test('[W6-ERR-006] [UNIT] non-Billing generic error → 502 (no internal details)', () => {
  const error = new Error('Cannot connect to database');
  const mapped = mapArtifactBillingErrorToHttp(error);
  assert.equal(mapped.statusCode, 502);
  assert.ok(!mapped.message.includes('database'), 'generic error must not expose internal details');
});

test('[W6-ERR-007] [PROXY-MOCK] Billing timeout during getFiscalArtifact → 504', async () => {
  const db = makeMockDb();
  const error = new BillingClientError('timeout', { code: 'BILLING_TIMEOUT' });
  const client = makeMockBillingClient({ error });
  await assert.rejects(
    () => getFiscalArtifact(1623n, 'pdf', 7n, { db, billingClient: client }),
    (err) => { assert.equal(err.statusCode, 504); return true; },
  );
});

test('[W6-ERR-008] [PROXY-MOCK] Billing unavailable during listFiscalArtifacts → 503', async () => {
  const db = makeMockDb();
  const error = new BillingClientError('unavailable', { code: 'BILLING_UNAVAILABLE' });
  const client = makeMockBillingClient({ error });
  await assert.rejects(
    () => listFiscalArtifacts(1623n, 7n, { db, billingClient: client }),
    (err) => { assert.ok(err.statusCode >= 500); return true; },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// W6-BILLING — Billing trust boundary (config from DB, not caller)
// ─────────────────────────────────────────────────────────────────────────────

test('[W6-BILLING-001] [PROXY-MOCK] Billing client receives billingCompanyId from DB config (not caller)', async () => {
  const db = makeMockDb({ invoiceCompanyId: 7n });
  let capturedBillingCompanyId = null;
  const client = {
    getArtifact: async (params) => {
      capturedBillingCompanyId = params.billingCompanyId;
      return { bytes: Buffer.from('%PDF'), contentType: 'application/pdf' };
    },
  };
  await getFiscalArtifact(1623n, 'pdf', 7n, { db, billingClient: client });
  assert.equal(capturedBillingCompanyId, 'billing-co-abc', 'billingCompanyId must come from DB config');
});

test('[W6-BILLING-002] [PROXY-MOCK] Billing client receives billingFiscalDocumentId from DB intent (not caller)', async () => {
  const db = makeMockDb();
  let capturedDocId = null;
  const client = {
    getArtifact: async (params) => {
      capturedDocId = params.billingFiscalDocumentId;
      return { bytes: Buffer.from('%PDF'), contentType: 'application/pdf' };
    },
  };
  await getFiscalArtifact(1623n, 'pdf', 7n, { db, billingClient: client });
  assert.equal(capturedDocId, 'billing-doc-001', 'billingFiscalDocumentId must come from DB intent');
});

test('[W6-BILLING-003] [PROXY-MOCK] Billing client receives secretReference from DB config (not caller)', async () => {
  const db = makeMockDb();
  let capturedSecretRef = null;
  const client = {
    getArtifact: async (params) => {
      capturedSecretRef = params.secretReference;
      return { bytes: Buffer.from('%PDF'), contentType: 'application/pdf' };
    },
  };
  await getFiscalArtifact(1623n, 'pdf', 7n, { db, billingClient: client });
  assert.equal(capturedSecretRef, 'arn:aws:secret:test', 'secretRef must come from DB config, not caller');
});

test('[W6-BILLING-004] [PROXY-MOCK] secretReference never appears in returned artifact result', async () => {
  const db = makeMockDb();
  const client = makeMockBillingClient({ bytes: Buffer.from('PDF-content'), type: 'application/pdf' });
  const result = await getFiscalArtifact(1623n, 'pdf', 7n, { db, billingClient: client });
  const resultJson = JSON.stringify(result, (_, v) => (Buffer.isBuffer(v) ? v.toString() : v));
  assert.ok(!resultJson.includes('arn:aws'), 'secretRef must not be in artifact result');
  assert.ok(!resultJson.includes('secret'), 'secret must not be in artifact result');
});

// ─────────────────────────────────────────────────────────────────────────────
// W6-INT — Artifact byte integrity (proxy returns unmodified bytes)
// ─────────────────────────────────────────────────────────────────────────────

test('[W6-INT-001] [PROXY-MOCK] PDF bytes returned by proxy exactly equal Billing bytes', async () => {
  const pdfContent = Buffer.from('%PDF-1.4\n%%EOF\n' + 'a'.repeat(100));
  const db = makeMockDb();
  const client = makeMockBillingClient({ bytes: pdfContent, type: 'application/pdf' });
  const result = await getFiscalArtifact(1623n, 'pdf', 7n, { db, billingClient: client });
  assert.ok(result.bytes.equals(pdfContent), 'PDF bytes must be exactly unchanged');
});

test('[W6-INT-002] [PROXY-MOCK] XML bytes returned by proxy exactly equal Billing bytes', async () => {
  const xmlContent = Buffer.from('<?xml version="1.0"?><FacturaElectronica><Clave>506</Clave></FacturaElectronica>');
  const db = makeMockDb();
  const client = makeMockBillingClient({ bytes: xmlContent, type: 'application/xml' });
  const result = await getFiscalArtifact(1623n, 'signed-xml', 7n, { db, billingClient: client });
  assert.ok(result.bytes.equals(xmlContent), 'XML bytes must be exactly unchanged (no re-serialization)');
  assert.ok(!result.bytes.toString().includes('pretty'), 'XML must not be pretty-printed');
});

test('[W6-INT-003] [PROXY-MOCK] signed XML bytes are not whitespace-normalized', () => {
  // Verify the proxy code does NOT call JSON.parse/JSON.stringify or XML re-parsing
  const proxySrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'services', 'fiscal-artifact-proxy.service.js'), 'utf8',
  );
  // The proxy must not attempt to parse XML
  assert.ok(!proxySrc.includes('parseXML') && !proxySrc.includes('xml2js'), 'proxy must not parse XML');
  assert.ok(!proxySrc.includes('JSON.parse(artifactResult'), 'proxy must not JSON.parse artifact bytes');
  // The proxy MUST return artifactResult.bytes directly
  assert.ok(proxySrc.includes('bytes: artifactResult.bytes'), 'proxy must return bytes unchanged');
});

// ─────────────────────────────────────────────────────────────────────────────
// W6-XSS — Frontend rendering: hostile inputs escaped
// ─────────────────────────────────────────────────────────────────────────────

function createBillingHarness() {
  const win = {};
  const ctx = vm.createContext({ window: win, Map, Set, URLSearchParams });
  win.window = win;
  const exec = (rel) => vm.runInContext(fs.readFileSync(path.join(rootPublicPath, rel), 'utf8'), ctx, { filename: rel });
  win.InventoryAuth = { fetchJson: async () => ({}), buildHeaders: () => ({}), handleUnauthorized: () => {} };
  win.fetch = async () => ({ ok: true, status: 200, json: async () => ({}) });
  exec('registry.js');
  exec('ui.js');
  exec('billing-api.js');
  exec('views/billing-admin.helpers.js');
  exec('views/billing-admin.renderers.js');
  return win.RootShell;
}

test('[W6-XSS-001] [RENDER] hostile invoiceNumber is escaped in rendered detail content', () => {
  const shell = createBillingHarness();
  const bh    = shell.require('views.billingAdminRenderers');
  const html  = bh.renderInvoiceDetailContent({
    id: 1, invoiceNumber: '<script>alert(1)</script>', clientName: 'Safe Co.',
    amount: 1000, status: 'PENDING', payments: [], fiscal: null,
  });
  assert.ok(html.includes('&lt;script&gt;'), 'script tag must be escaped');
  assert.ok(!html.includes('<script>'), 'raw script tag must not appear');
});

test('[W6-XSS-002] [RENDER] hostile clientName is escaped in rendered detail content', () => {
  const shell = createBillingHarness();
  const bh    = shell.require('views.billingAdminRenderers');
  const html  = bh.renderInvoiceDetailContent({
    id: 1, invoiceNumber: 'INV-1', clientName: '"><img src=x onerror=alert(1)>',
    amount: 1000, status: 'PENDING', payments: [], fiscal: null,
  });
  // bh.escapeHtml converts '<img' to '&lt;img', preventing injection; onerror is harmless in escaped text
  assert.ok(!html.includes('<img src=x onerror'), 'img element must be HTML-escaped');
  assert.ok(html.includes('&gt;') || html.includes('&lt;'), 'HTML must be escaped');
});

test('[W6-XSS-003] [RENDER] hostile clave is escaped in fiscal status section', () => {
  const shell = createBillingHarness();
  const bh    = shell.require('views.billingAdminRenderers');
  const html  = bh.renderFiscalStatusSection({
    status: 'ACCEPTED',
    clave: '"><script>stealTokens()</script>',
    consecutive: '00100001010000000001',
    acceptedAt: '2025-01-15T14:30:00.000Z',
  });
  assert.ok(!html.includes('<script>'), 'raw script in clave must be escaped');
  assert.ok(html.includes('&lt;') || html.includes('&gt;'), 'must escape HTML');
});

test('[W6-XSS-004] [RENDER] unknown fiscal status degrades safely without executing code', () => {
  const shell = createBillingHarness();
  const bh    = shell.require('views.billingAdminRenderers');
  const html  = bh.renderFiscalStatusSection({ status: '<script>alert()</script>', clave: null, consecutive: null, acceptedAt: null });
  assert.ok(!html.includes('<script>alert()'), 'unknown status injection must be escaped');
});

test('[W6-XSS-005] [RENDER] artifact error renderer does not include raw Billing error details', () => {
  const shell = createBillingHarness();
  const bh    = shell.require('views.billingAdminRenderers');
  const html  = bh.renderArtifactLoadError(1623, 'INV-963');
  // Must not expose raw Billing URLs, stack traces or credential info
  assert.ok(!html.includes('http://billing'), 'Billing URL must not be in error output');
  assert.ok(!html.includes('apiKey'), 'apiKey must not be in error output');
  assert.ok(!html.includes('stack'), 'stack trace must not be in error output');
  // Must contain a safe user-facing message
  assert.ok(html.includes('Reintentar') || html.includes('No se pudieron'), 'must have user-facing safe message');
});

// ─────────────────────────────────────────────────────────────────────────────
// W6-STORE — No fiscal data in browser storage
// ─────────────────────────────────────────────────────────────────────────────

test('[W6-STORE-001] [SRC] billing-admin.js does NOT write to localStorage', () => {
  const src = fs.readFileSync(path.join(rootPublicPath, 'views', 'billing-admin.js'), 'utf8');
  assert.ok(!src.includes('localStorage.setItem'), 'billing-admin.js must not write fiscal data to localStorage');
  assert.ok(!src.includes('localStorage.fiscal'), 'must not write fiscal data to localStorage');
});

test('[W6-STORE-002] [SRC] billing-admin.js does NOT write to sessionStorage', () => {
  const src = fs.readFileSync(path.join(rootPublicPath, 'views', 'billing-admin.js'), 'utf8');
  assert.ok(!src.includes('sessionStorage.setItem'), 'billing-admin.js must not write fiscal data to sessionStorage');
});

test('[W6-STORE-003] [SRC] billing-admin.js does NOT use IndexedDB', () => {
  const src = fs.readFileSync(path.join(rootPublicPath, 'views', 'billing-admin.js'), 'utf8');
  assert.ok(!src.includes('indexedDB') && !src.includes('IDBDatabase'), 'billing-admin.js must not use IndexedDB');
});

// ─────────────────────────────────────────────────────────────────────────────
// W6-REG — Regression: Waves 1–5 still functional
// ─────────────────────────────────────────────────────────────────────────────

test('[W6-REG-001] [SVC-MOCK] null fiscal intent → fiscal: null (not error)', async () => {
  const result = await withStubs(invoiceRepository,
    { findCompanyInvoiceById: async () => makeInvoice({ fiscalIntent: null }) },
    () => invoiceService.getInvoice(1623n, { companyId: '7' }),
  );
  assert.equal(result.fiscal, null, 'null intent must produce fiscal: null, not throw');
});

test('[W6-REG-002] [SVC-MOCK] PENDING intent with null clave → fiscal.clave: null (not error)', async () => {
  const result = await withStubs(invoiceRepository,
    { findCompanyInvoiceById: async () => makeInvoice({ fiscalIntent: { status: 'PENDING', clave: null, consecutive: null, metadata: null } }) },
    () => invoiceService.getInvoice(1623n, { companyId: '7' }),
  );
  assert.ok(result.fiscal, 'fiscal must not be null');
  assert.equal(result.fiscal.status, 'PENDING');
  assert.equal(result.fiscal.clave, null, 'null clave must remain null');
});

test('[W6-REG-003] [UNIT] parseBigIntId with malformed string → 400 validation_error', () => {
  assert.throws(
    () => parseBigIntId('not-a-number'),
    (err) => { assert.equal(err.statusCode, 400); assert.equal(err.code, 'validation_error'); return true; },
  );
});

test('[W6-REG-004] [UNIT] all three Wave-5 artifact types are in the allowlist', () => {
  const types = Object.keys(INVENTORI_TO_BILLING_ARTIFACT_TYPE);
  assert.ok(types.includes('pdf'), 'pdf must be in allowlist');
  assert.ok(types.includes('signed-xml'), 'signed-xml must be in allowlist');
  assert.ok(types.includes('hacienda-response'), 'hacienda-response must be in allowlist');
  assert.equal(types.length, 3, 'must have exactly 3 allowed types');
});

test('[W6-REG-005] [SVC-MOCK] ACCEPTED invoice serializes clave/consecutive/acceptedAt correctly', async () => {
  const intent = makeIntentWithInternals({ status: 'ACCEPTED' });
  const result = await withStubs(invoiceRepository,
    { findCompanyInvoiceById: async () => makeInvoice({ fiscalIntent: intent }) },
    () => invoiceService.getInvoice(1623n, { companyId: '7' }),
  );
  assert.equal(result.fiscal?.status, 'ACCEPTED');
  assert.ok(result.fiscal?.clave, 'clave must be present for ACCEPTED');
  assert.ok(result.fiscal?.consecutive, 'consecutive must be present for ACCEPTED');
});

// ─────────────────────────────────────────────────────────────────────────────
// W6-013B — TASK-013b reconciliation mapping intact after Wave 6
// ─────────────────────────────────────────────────────────────────────────────

test('[W6-013B-001] [UNIT] TASK-013b: QUEUED fiscal status maps to PROCESSING (not UNKNOWN)', () => {
  const result = resolveCanonicalFiscalStatus({ fiscalStatus: 'QUEUED' });
  assert.equal(result, 'PROCESSING', 'QUEUED must still map to PROCESSING after Wave 6');
});

test('[W6-013B-002] [UNIT] TASK-013b: all official non-terminal Billing statuses → PROCESSING', () => {
  const officialNonTerminal = [
    'REQUESTED', 'QUEUED', 'SUBMITTING', 'POST_OUTCOME_UNKNOWN',
    'ACKNOWLEDGED', 'PROCESSING', 'TECHNICAL_RETRY_PENDING', 'MANUAL_REVIEW_REQUIRED',
  ];
  for (const status of officialNonTerminal) {
    const result = resolveCanonicalFiscalStatus({ fiscalStatus: status });
    assert.equal(result, 'PROCESSING', `${status} must still map to PROCESSING after Wave 6`);
  }
});

test('[W6-013B-003] [UNIT] TASK-013b: ACCEPTED still maps to ACCEPTED', () => {
  assert.equal(resolveCanonicalFiscalStatus({ fiscalStatus: 'ACCEPTED', haciendaStatus: 'ACCEPTED' }), 'ACCEPTED');
});

test('[W6-013B-004] [UNIT] TASK-013b: unknown future status still fails closed (BILLING_UNKNOWN_STATUS)', () => {
  const result = resolveCanonicalFiscalStatus({ fiscalStatus: 'FUTURE_UNKNOWN_STATUS_XYZ' });
  assert.ok(
    result === null || result === 'BILLING_UNKNOWN_STATUS',
    'unknown future Billing status must fail closed after Wave 6',
  );
});
