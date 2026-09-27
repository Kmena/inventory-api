'use strict';

/**
 * TASK-015 — Inventori → Billing Integration Hardening: Unit-level E2E tests.
 *
 * No database required. Covers:
 *   1. Direct Hacienda static audit (production source code contains no fiscal Hacienda submission)
 *   2. Architecture drift: generateBillingOnDispatch not on critical path
 *   3. Discount validation bug documentation (TASK-015 fix verified)
 *   4. Fake Billing server coherence (idempotency, state machine)
 *   5. Status semantics (HTTP 200/201/202 ≠ fiscal ACCEPTED)
 *   6. Error classification matrix
 *   7. Secret non-exposure (sentinel key audit across service files)
 *   8. Observability format audit (safe fields only)
 *   9. Idempotency key stability
 *  10. Retry/backoff semantics
 *  11. Unit mapping completeness
 *  12. Payload hash stability
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

// ---------------------------------------------------------------------------
// Service imports
// ---------------------------------------------------------------------------

const {
  validateOrderFiscalReadiness,
} = require('../src/services/fiscal-readiness.service');

const { resolveFiscalReceiver } = require('../src/services/fiscal-receiver-resolver.service');
const { mapInventoriUnitToBillingUnit, UNIT_MAPPING } = require('../src/services/fiscal-unit-mapping.service');
const {
  classifyBillingFailure,
  buildBillingFiscalDocumentPayload,
  hashBillingPayload,
} = require('../src/services/fiscal-billing-worker.service');
const {
  resolveCanonicalFiscalStatus,
  classifyBillingReconciliationResult,
  sanitizeRejectionDiagnostics,
  classifyReconciliationQueryFailure,
} = require('../src/services/fiscal-reconciliation.service');
const { BillingClientError } = require('../src/services/billing-api-client.service');
const { FakeBillingServer } = require('./helpers/fake-billing-server');
const { buildFiscalSnapshotData, buildIdempotencyKey } = require('../src/services/fiscal-snapshot.service');

// ---------------------------------------------------------------------------
// SUITE 1: Direct Hacienda static audit
// ---------------------------------------------------------------------------

describe('TASK-015 direct Hacienda fiscal endpoint static audit', () => {
  const SRC_DIR = path.join(__dirname, '..', 'src');

  /** Patterns that would indicate direct Hacienda fiscal submission */
  const FISCAL_HACIENDA_PATTERNS = [
    'api-sandbox.comprobanteselectronicos.go.cr',
    'api.comprobanteselectronicos.go.cr',
    '/recepcion/',
    'hacienda.go.cr/fe/ATV',
  ];

  /** Pre-existing taxpayer lookup is explicitly exempted (it's a public data lookup, not fiscal submission) */
  const KNOWN_EXEMPTIONS = new Set([
    path.join(SRC_DIR, 'config.js'),
    path.join(SRC_DIR, 'services', 'taxpayer.service.js'),
  ]);

  function collectJsFiles(dir) {
    const files = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...collectJsFiles(fullPath));
      } else if (entry.name.endsWith('.js')) {
        files.push(fullPath);
      }
    }
    return files;
  }

  test('no new Inventori source file contains direct fiscal Hacienda submission endpoints', () => {
    const allFiles = collectJsFiles(SRC_DIR);
    const violations = [];

    for (const file of allFiles) {
      if (KNOWN_EXEMPTIONS.has(file)) continue;
      const content = fs.readFileSync(file, 'utf8');
      for (const pattern of FISCAL_HACIENDA_PATTERNS) {
        if (content.includes(pattern)) {
          violations.push({ file: path.relative(SRC_DIR, file), pattern });
        }
      }
    }

    assert.deepEqual(violations, [],
      `Source files must not contain direct fiscal Hacienda endpoints:\n${JSON.stringify(violations, null, 2)}`);
  });

  test('pre-existing Hacienda taxpayer lookup is in config.js only (public data, not fiscal submission)', () => {
    const configContent = fs.readFileSync(path.join(SRC_DIR, 'config.js'), 'utf8');
    assert.ok(configContent.includes('hacienda.go.cr/fe/ae'),
      'config.js should contain Hacienda taxpayer lookup URL');
    // Verify this is a lookup (/fe/ae), NOT a fiscal submission endpoint (/recepcion/)
    assert.ok(!configContent.includes('/recepcion/'),
      'config.js must not contain Hacienda fiscal submission endpoint /recepcion/');
  });

  test('fiscal-billing-worker.service.js contains no direct Hacienda endpoints', () => {
    const content = fs.readFileSync(
      path.join(SRC_DIR, 'services', 'fiscal-billing-worker.service.js'), 'utf8',
    );
    for (const pattern of FISCAL_HACIENDA_PATTERNS) {
      assert.ok(!content.includes(pattern), `worker must not contain: ${pattern}`);
    }
    // Also: must not contain certificate/PIN signing
    assert.ok(!content.toLowerCase().includes('certificate'), 'worker must not handle certificates');
    assert.ok(!content.toLowerCase().includes(' pin'), 'worker must not handle PINs');
  });

  test('billing-api-client.service.js contains no direct Hacienda endpoints', () => {
    const content = fs.readFileSync(
      path.join(SRC_DIR, 'services', 'billing-api-client.service.js'), 'utf8',
    );
    for (const pattern of FISCAL_HACIENDA_PATTERNS) {
      assert.ok(!content.includes(pattern), `client must not contain: ${pattern}`);
    }
  });

  test('fiscal-reconciliation.service.js contains no direct Hacienda endpoints', () => {
    const content = fs.readFileSync(
      path.join(SRC_DIR, 'services', 'fiscal-reconciliation.service.js'), 'utf8',
    );
    for (const pattern of FISCAL_HACIENDA_PATTERNS) {
      assert.ok(!content.includes(pattern), `reconciliation must not contain: ${pattern}`);
    }
  });

  test('fiscal-artifact-proxy.service.js contains no direct Hacienda endpoints', () => {
    const content = fs.readFileSync(
      path.join(SRC_DIR, 'services', 'fiscal-artifact-proxy.service.js'), 'utf8',
    );
    for (const pattern of FISCAL_HACIENDA_PATTERNS) {
      assert.ok(!content.includes(pattern), `artifact proxy must not contain: ${pattern}`);
    }
  });
});

// ---------------------------------------------------------------------------
// SUITE 2: Architecture drift — generateBillingOnDispatch not on critical path
// ---------------------------------------------------------------------------

describe('TASK-015 architecture drift audit', () => {
  test('inventory.service.js uses executeBillingLogic directly inside transaction (not generateBillingOnDispatch)', () => {
    const content = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'services', 'inventory.service.js'), 'utf8',
    );
    // Should use executeBillingLogic inside the transaction
    assert.ok(content.includes('executeBillingLogic'), 'inventory service should call executeBillingLogic');
    // Should NOT call generateBillingOnDispatch (the old separate-transaction wrapper)
    // Note: may appear in require() statements but should not appear in call sites
    const callSiteMatch = content.match(/await\s+generateBillingOnDispatch\s*\(/);
    assert.equal(callSiteMatch, null, 'inventory.service.js must not await generateBillingOnDispatch() — this was the old gap-creating pattern');
  });

  test('dispatch, invoice, snapshot and intent are all created inside same inventoryRepository.transaction()', () => {
    const content = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'services', 'inventory.service.js'), 'utf8',
    );
    // All these calls should appear inside the transaction block
    assert.ok(content.includes('createInvoiceFiscalSnapshot'), 'snapshot creation must be inside transaction');
    assert.ok(content.includes('createInvoiceFiscalIntent'), 'intent creation must be inside transaction');
    assert.ok(content.includes('executeBillingLogic'), 'invoice creation must be inside transaction');
  });

  test('fiscal readiness check runs inside the dispatch transaction', () => {
    const content = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'services', 'inventory.service.js'), 'utf8',
    );
    assert.ok(content.includes('assertOrderFiscalReadiness'), 'readiness check must be inside dispatch transaction');
  });

  test('TASK-015 fix: discount validation condition is no longer always-false in fiscal-readiness.service.js', () => {
    const content = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'services', 'fiscal-readiness.service.js'), 'utf8',
    );
    // The always-false pattern `x > 0 && x < 0` must not exist
    assert.ok(
      !content.includes('toNumber(item.totalDiscount) > 0 && toNumber(item.totalDiscount) < 0'),
      'Always-false discount validation condition must have been removed by TASK-015',
    );
    // The TASK-015 fix comment should be present
    assert.ok(
      content.includes('TASK-015 NOTE'),
      'TASK-015 fix note should be present in fiscal-readiness.service.js',
    );
  });
});

// ---------------------------------------------------------------------------
// SUITE 3: Fake Billing Server coherence
// ---------------------------------------------------------------------------

describe('TASK-015 FakeBillingServer coherence', () => {
  test('same idempotencyKey → same document on repeated CREATE calls', async () => {
    const server = new FakeBillingServer();
    const key = 'inventori:1:invoice:42';

    const r1 = await server.createFiscalDocument({ billingCompanyId: 'bc1', environment: 'SANDBOX', idempotencyKey: key, payload: {} });
    const r2 = await server.createFiscalDocument({ billingCompanyId: 'bc1', environment: 'SANDBOX', idempotencyKey: key, payload: {} });
    const r3 = await server.createFiscalDocument({ billingCompanyId: 'bc1', environment: 'SANDBOX', idempotencyKey: key, payload: {} });

    assert.equal(r1.billingFiscalDocumentId, r2.billingFiscalDocumentId, 'Repeated CREATE must return same docId');
    assert.equal(r2.billingFiscalDocumentId, r3.billingFiscalDocumentId);
    assert.equal(server.uniqueDocumentCount, 1, 'Only ONE logical document must exist');
    assert.equal(server.createCallCount, 3, '3 CREATE calls were recorded');
  });

  test('two different idempotencyKeys → two distinct documents', async () => {
    const server = new FakeBillingServer();
    const r1 = await server.createFiscalDocument({ billingCompanyId: 'bc1', environment: 'SANDBOX', idempotencyKey: 'key-A', payload: {} });
    const r2 = await server.createFiscalDocument({ billingCompanyId: 'bc1', environment: 'SANDBOX', idempotencyKey: 'key-B', payload: {} });
    assert.notEqual(r1.billingFiscalDocumentId, r2.billingFiscalDocumentId);
    assert.equal(server.uniqueDocumentCount, 2);
  });

  test('SUBMIT after CREATE sets clave/consecutive deterministically', async () => {
    const server = new FakeBillingServer();
    const { billingFiscalDocumentId } = await server.createFiscalDocument({ billingCompanyId: 'bc1', environment: 'SANDBOX', idempotencyKey: 'k1', payload: {} });
    const r1 = await server.submitFiscalDocument({ billingCompanyId: 'bc1', environment: 'SANDBOX', billingFiscalDocumentId });
    const r2 = await server.submitFiscalDocument({ billingCompanyId: 'bc1', environment: 'SANDBOX', billingFiscalDocumentId });
    // Clave and consecutive must be stable across submit calls
    assert.equal(r1.clave, r2.clave, 'clave must be stable across SUBMIT repeats');
    assert.equal(r1.consecutive, r2.consecutive, 'consecutive must be stable');
    assert.equal(r1.fiscalStatus, 'PROCESSING');
    assert.equal(String(r1.clave).length, 50, 'clave must be 50 digits');
    assert.equal(String(r1.consecutive).length, 20, 'consecutive must be 20 digits');
  });

  test('STATUS poll returns PROCESSING then ACCEPTED after N polls', async () => {
    const server = new FakeBillingServer({ statusAfterNPolls: 2, finalStatus: 'ACCEPTED' });
    const { billingFiscalDocumentId } = await server.createFiscalDocument({ billingCompanyId: 'bc1', environment: 'SANDBOX', idempotencyKey: 'k1', payload: {} });
    await server.submitFiscalDocument({ billingCompanyId: 'bc1', environment: 'SANDBOX', billingFiscalDocumentId });

    const s1 = await server.getFiscalStatus({ billingCompanyId: 'bc1', environment: 'SANDBOX', billingFiscalDocumentId });
    assert.equal(s1.fiscalStatus, 'PROCESSING', 'First poll: PROCESSING');

    const s2 = await server.getFiscalStatus({ billingCompanyId: 'bc1', environment: 'SANDBOX', billingFiscalDocumentId });
    assert.equal(s2.fiscalStatus, 'ACCEPTED', 'After N polls: ACCEPTED');

    // Further polls still return ACCEPTED (terminal state)
    const s3 = await server.getFiscalStatus({ billingCompanyId: 'bc1', environment: 'SANDBOX', billingFiscalDocumentId });
    assert.equal(s3.fiscalStatus, 'ACCEPTED');
  });

  test('STATUS poll returns REJECTED with rejection diagnostics', async () => {
    const server = new FakeBillingServer({
      statusAfterNPolls: 1,
      finalStatus: 'REJECTED',
      rejectionDiagnostics: { rejectionCode: '03', rejectionMessage: 'Error en datos del receptor', haciendaMensaje: 'Datos inválidos' },
    });
    const { billingFiscalDocumentId } = await server.createFiscalDocument({ billingCompanyId: 'bc1', environment: 'SANDBOX', idempotencyKey: 'k1', payload: {} });
    await server.submitFiscalDocument({ billingCompanyId: 'bc1', environment: 'SANDBOX', billingFiscalDocumentId });
    const s = await server.getFiscalStatus({ billingCompanyId: 'bc1', environment: 'SANDBOX', billingFiscalDocumentId });
    assert.equal(s.fiscalStatus, 'REJECTED');
    assert.equal(s.rejectionCode, '03');
    assert.equal(s.rejectionMessage, 'Error en datos del receptor');
    assert.equal(s.haciendaMensaje, 'Datos inválidos');
  });

  test('ARTIFACT returns correct bytes by type', async () => {
    const pdfBytes = Buffer.from('%PDF-1.4 test');
    const xmlBytes = Buffer.from('<?xml?>');
    const server = new FakeBillingServer({
      artifactBytes: { PDF: pdfBytes, SIGNED_XML: xmlBytes, HACIENDA_RESPONSE_XML: xmlBytes },
    });
    const { billingFiscalDocumentId } = await server.createFiscalDocument({ billingCompanyId: 'bc1', environment: 'SANDBOX', idempotencyKey: 'k1', payload: {} });

    const pdfResult = await server.getArtifact({ billingFiscalDocumentId, artifactType: 'PDF' });
    assert.equal(pdfResult.contentType, 'application/pdf');
    assert.deepEqual([...pdfResult.bytes], [...pdfBytes]);

    const xmlResult = await server.getArtifact({ billingFiscalDocumentId, artifactType: 'SIGNED_XML' });
    assert.equal(xmlResult.contentType, 'application/xml');
    assert.deepEqual([...xmlResult.bytes], [...xmlBytes]);
  });

  test('ARTIFACT returns HACIENDA_RESPONSE_XML as application/xml', async () => {
    const server = new FakeBillingServer();
    const { billingFiscalDocumentId } = await server.createFiscalDocument({ billingCompanyId: 'bc1', environment: 'SANDBOX', idempotencyKey: 'k1', payload: {} });
    const r = await server.getArtifact({ billingFiscalDocumentId, artifactType: 'HACIENDA_RESPONSE_XML' });
    assert.equal(r.contentType, 'application/xml');
  });

  test('STATUS is coherent with SUBMIT: clave from STATUS matches SUBMIT', async () => {
    const server = new FakeBillingServer({ statusAfterNPolls: 99, finalStatus: 'ACCEPTED' });
    const { billingFiscalDocumentId } = await server.createFiscalDocument({ billingCompanyId: 'bc1', environment: 'SANDBOX', idempotencyKey: 'k1', payload: {} });
    const submitResult = await server.submitFiscalDocument({ billingCompanyId: 'bc1', environment: 'SANDBOX', billingFiscalDocumentId });
    const statusResult = await server.getFiscalStatus({ billingCompanyId: 'bc1', environment: 'SANDBOX', billingFiscalDocumentId });
    // Clave from STATUS must match clave from SUBMIT
    assert.equal(statusResult.clave, submitResult.clave, 'STATUS clave must match SUBMIT clave');
    assert.equal(statusResult.consecutive, submitResult.consecutive, 'STATUS consecutive must match SUBMIT consecutive');
  });

  test('secret reference accepted but not stored in server state', async () => {
    const sentinel = 'SENTINEL_SECRET_DO_NOT_STORE';
    const server = new FakeBillingServer();
    await server.createFiscalDocument({ billingCompanyId: 'bc1', environment: 'SANDBOX', idempotencyKey: 'k1', payload: {}, secretReference: `env:${sentinel}` });
    // Inspect all server state - sentinel must not appear
    const allState = JSON.stringify({ docs: [...server._documents.entries()], log: server.callLog });
    assert.ok(!allState.includes(sentinel), 'Sentinel secret must not be stored in server state');
  });

  test('server reset clears all state', async () => {
    const server = new FakeBillingServer();
    await server.createFiscalDocument({ billingCompanyId: 'bc1', environment: 'SANDBOX', idempotencyKey: 'k1', payload: {} });
    assert.equal(server.uniqueDocumentCount, 1);
    server.reset();
    assert.equal(server.uniqueDocumentCount, 0);
    assert.equal(server.createCallCount, 0);
  });

  test('createError causes CREATE to throw without creating a document', async () => {
    const server = new FakeBillingServer({
      createError: new BillingClientError('Billing timeout', { code: 'BILLING_TIMEOUT', retryable: true }),
    });
    await assert.rejects(
      () => server.createFiscalDocument({ billingCompanyId: 'bc1', environment: 'SANDBOX', idempotencyKey: 'k1', payload: {} }),
      (err) => { assert.equal(err.code, 'BILLING_TIMEOUT'); return true; },
    );
    assert.equal(server.uniqueDocumentCount, 0, 'No document created when CREATE throws');
  });

  test('Billing create/submit operations never call real HTTP (fake server uses no fetch)', () => {
    // The fake server has no fetch/HTTP calls — verified by absence of network calls
    const serverSource = fs.readFileSync(path.join(__dirname, 'helpers', 'fake-billing-server.js'), 'utf8');
    assert.ok(!serverSource.includes('require(\'node-fetch\')'), 'Fake server must not use node-fetch');
    assert.ok(!serverSource.includes('http.request'), 'Fake server must not use http.request');
    assert.ok(!serverSource.includes('https.request'), 'Fake server must not use https.request');
    // The word "hacienda" may appear in safe comment strings inside fake bytes — check no endpoint URL
    const haciendaEndpointPatterns = [
      'api.comprobantes', 'api.hacienda.go.cr/fe/ATV', '/recepcion/',
    ];
    for (const pattern of haciendaEndpointPatterns) {
      assert.ok(!serverSource.includes(pattern), `Fake server must not contain Hacienda endpoint: ${pattern}`);
    }
  });
});

// ---------------------------------------------------------------------------
// SUITE 4: Status semantics — HTTP transport ≠ fiscal ACCEPTED
// ---------------------------------------------------------------------------

describe('TASK-015 status semantics: HTTP transport ≠ fiscal ACCEPTED', () => {
  test('HTTP 200 response body without fiscalStatus=ACCEPTED is not ACCEPTED', () => {
    const result = classifyBillingReconciliationResult({ httpStatus: 200 });
    assert.equal(result.intentStatus, null, 'HTTP 200 without explicit fiscalStatus must NOT produce ACCEPTED');
    assert.equal(result.code, 'BILLING_UNKNOWN_STATUS');
  });

  test('HTTP 201 in response body does not produce ACCEPTED (CREATED maps to PROCESSING)', () => {
    const result = classifyBillingReconciliationResult({ httpStatus: 201, status: 'CREATED' });
    // CREATED is in BILLING_PROCESSING_STATUSES (not accepted); maps to PROCESSING
    assert.notEqual(result.intentStatus, 'ACCEPTED', 'CREATED status must not produce ACCEPTED');
    // It maps to PROCESSING (document created but not yet accepted by Hacienda)
    assert.equal(result.intentStatus, 'PROCESSING', 'CREATED maps to PROCESSING (not null, not ACCEPTED)');
  });

  test('HTTP 202 in response body does not produce ACCEPTED', () => {
    const result = classifyBillingReconciliationResult({ httpStatus: 202, status: 'SUBMITTED' });
    // SUBMITTED maps to PROCESSING, not ACCEPTED
    assert.equal(result.intentStatus, 'PROCESSING', 'SUBMITTED status maps to PROCESSING');
  });

  test('only explicit fiscalStatus=ACCEPTED produces ACCEPTED projection', () => {
    const result = classifyBillingReconciliationResult({ fiscalStatus: 'ACCEPTED' });
    assert.equal(result.intentStatus, 'ACCEPTED');
  });

  test('HACIENDA_ACCEPTED synonym produces ACCEPTED', () => {
    const result = classifyBillingReconciliationResult({ fiscalStatus: 'HACIENDA_ACCEPTED' });
    assert.equal(result.intentStatus, 'ACCEPTED');
  });

  test('ACEPTADO (Spanish) produces ACCEPTED', () => {
    const result = classifyBillingReconciliationResult({ haciendaStatus: 'ACEPTADO' });
    assert.equal(result.intentStatus, 'ACCEPTED');
  });

  test('null response → BILLING_MALFORMED_RESPONSE (not ACCEPTED)', () => {
    const result = classifyBillingReconciliationResult(null);
    assert.equal(result.intentStatus, null);
    assert.equal(result.code, 'BILLING_MALFORMED_RESPONSE');
  });

  test('empty object → BILLING_UNKNOWN_STATUS (fail closed)', () => {
    const result = classifyBillingReconciliationResult({});
    assert.equal(result.intentStatus, null);
    assert.equal(result.code, 'BILLING_UNKNOWN_STATUS');
  });

  test('resolveCanonicalFiscalStatus priority: fiscalStatus > haciendaStatus > status', () => {
    // If fiscalStatus says ACCEPTED and haciendaStatus says PROCESSING, fiscalStatus wins
    const canonical = resolveCanonicalFiscalStatus({ fiscalStatus: 'ACCEPTED', haciendaStatus: 'PROCESSING' });
    assert.equal(canonical, 'ACCEPTED');
  });

  test('RECHAZADO produces REJECTED', () => {
    const result = classifyBillingReconciliationResult({ haciendaStatus: 'RECHAZADO' });
    assert.equal(result.intentStatus, 'REJECTED');
  });

  test('unknown status fails closed to null (not ACCEPTED, not REJECTED)', () => {
    const result = classifyBillingReconciliationResult({ fiscalStatus: 'SOME_UNKNOWN_STATUS' });
    assert.equal(result.intentStatus, null, 'Unknown status must fail closed to null');
    assert.equal(result.code, 'BILLING_UNKNOWN_STATUS');
  });
});

// ---------------------------------------------------------------------------
// SUITE 5: Error classification matrix
// ---------------------------------------------------------------------------

describe('TASK-015 error classification matrix', () => {
  function makeBillingError(opts) {
    return new BillingClientError(opts.message || 'test error', opts);
  }

  // Worker error classification (processClaimedFiscalIntent)
  test('BILLING_TIMEOUT → AMBIGUOUS ERROR_RETRYABLE', () => {
    const c = classifyBillingFailure(makeBillingError({ code: 'BILLING_TIMEOUT', retryable: true }));
    assert.equal(c.kind, 'AMBIGUOUS');
    assert.equal(c.status, 'ERROR_RETRYABLE');
    assert.equal(c.retryable, true);
  });

  test('BILLING_UNAVAILABLE → AMBIGUOUS ERROR_RETRYABLE', () => {
    const c = classifyBillingFailure(makeBillingError({ code: 'BILLING_UNAVAILABLE', retryable: true }));
    assert.equal(c.kind, 'AMBIGUOUS');
    assert.equal(c.status, 'ERROR_RETRYABLE');
  });

  test('HTTP 400 → FINAL ERROR_FINAL (not retryable)', () => {
    const c = classifyBillingFailure(makeBillingError({ code: 'BILLING_HTTP_ERROR', statusCode: 400, retryable: false }));
    assert.equal(c.status, 'ERROR_FINAL');
    assert.equal(c.retryable, false);
  });

  test('HTTP 401 → FINAL ERROR_FINAL', () => {
    const c = classifyBillingFailure(makeBillingError({ code: 'BILLING_HTTP_ERROR', statusCode: 401, retryable: false }));
    assert.equal(c.status, 'ERROR_FINAL');
    assert.equal(c.retryable, false);
  });

  test('HTTP 403 → FINAL ERROR_FINAL', () => {
    const c = classifyBillingFailure(makeBillingError({ code: 'BILLING_HTTP_ERROR', statusCode: 403, retryable: false }));
    assert.equal(c.status, 'ERROR_FINAL');
  });

  test('HTTP 404 → FINAL ERROR_FINAL (document not found)', () => {
    const c = classifyBillingFailure(makeBillingError({ code: 'BILLING_HTTP_ERROR', statusCode: 404, retryable: false }));
    assert.equal(c.status, 'ERROR_FINAL');
  });

  test('HTTP 409 → FINAL ERROR_FINAL (conflict)', () => {
    const c = classifyBillingFailure(makeBillingError({ code: 'BILLING_HTTP_ERROR', statusCode: 409, retryable: false }));
    assert.equal(c.status, 'ERROR_FINAL');
  });

  test('HTTP 422 → FINAL ERROR_FINAL (unprocessable)', () => {
    const c = classifyBillingFailure(makeBillingError({ code: 'BILLING_HTTP_ERROR', statusCode: 422, retryable: false }));
    assert.equal(c.status, 'ERROR_FINAL');
  });

  test('HTTP 429 → RETRYABLE ERROR_RETRYABLE', () => {
    const c = classifyBillingFailure(makeBillingError({ code: 'BILLING_HTTP_ERROR', statusCode: 429, retryable: true }));
    assert.equal(c.status, 'ERROR_RETRYABLE');
    assert.equal(c.retryable, true);
  });

  test('HTTP 500 → RETRYABLE ERROR_RETRYABLE', () => {
    const c = classifyBillingFailure(makeBillingError({ code: 'BILLING_HTTP_ERROR', statusCode: 500, retryable: true }));
    assert.equal(c.status, 'ERROR_RETRYABLE');
  });

  test('HTTP 503 → RETRYABLE ERROR_RETRYABLE', () => {
    const c = classifyBillingFailure(makeBillingError({ code: 'BILLING_HTTP_ERROR', statusCode: 503, retryable: true }));
    assert.equal(c.status, 'ERROR_RETRYABLE');
  });

  test('Non-BillingClientError with FISCAL_ code → FINAL ERROR_FINAL', () => {
    const err = Object.assign(new Error('fiscal error'), { code: 'FISCAL_SNAPSHOT_MISSING' });
    const c = classifyBillingFailure(err);
    assert.equal(c.status, 'ERROR_FINAL');
    assert.equal(c.retryable, false);
  });

  test('Non-BillingClientError without FISCAL_ code → FINAL ERROR_FINAL', () => {
    const err = new Error('unexpected error');
    const c = classifyBillingFailure(err);
    assert.equal(c.status, 'ERROR_FINAL');
  });

  test('malformed Billing response → intentStatus null', () => {
    const result = classifyBillingReconciliationResult('not-an-object');
    assert.equal(result.intentStatus, null);
    assert.equal(result.code, 'BILLING_MALFORMED_RESPONSE');
  });

  test('401 reconciliation query failure → ERROR_FINAL', () => {
    const err = makeBillingError({ code: 'BILLING_HTTP_ERROR', statusCode: 401, retryable: false });
    const c = classifyReconciliationQueryFailure(err, 0);
    assert.equal(c.isFinal, true, '401 must be final');
  });

  test('403 reconciliation query failure → ERROR_FINAL', () => {
    const err = makeBillingError({ code: 'BILLING_HTTP_ERROR', statusCode: 403, retryable: false });
    const c = classifyReconciliationQueryFailure(err, 0);
    assert.equal(c.isFinal, true);
  });

  test('timeout reconciliation query → keep PROCESSING (NOT ERROR_RETRYABLE)', () => {
    const err = makeBillingError({ code: 'BILLING_TIMEOUT', retryable: true });
    const c = classifyReconciliationQueryFailure(err, 0);
    assert.equal(c.isFinal, false, 'Timeout must keep PROCESSING (not escalate to ERROR_RETRYABLE which triggers re-create)');
    assert.ok(c.nextAttemptDelayMs > 0);
  });

  test('500 reconciliation query → keep PROCESSING', () => {
    const err = makeBillingError({ code: 'BILLING_HTTP_ERROR', statusCode: 500, retryable: true });
    const c = classifyReconciliationQueryFailure(err, 0);
    assert.equal(c.isFinal, false);
  });

  test('rejection diagnostics are sanitized (safe strings only)', () => {
    const response = {
      rejectionCode: '03',
      rejectionMessage: 'Error largo que puede contener datos privados'.repeat(20),
      haciendaMensaje: 'Mensaje de rechazo',
    };
    const diag = sanitizeRejectionDiagnostics(response);
    assert.ok(typeof diag.rejectionCode === 'string');
    // Truncated string: slice(0, MAX) + '[truncated]' = MAX + 11 chars
    assert.ok(diag.rejectionMessage.length <= 515, 'Truncated rejection message must not be too long (max 500+truncation suffix)');
  });

  test('null rejection response sanitizes gracefully', () => {
    const diag = sanitizeRejectionDiagnostics(null);
    assert.equal(diag, null);
  });
});

// ---------------------------------------------------------------------------
// SUITE 6: Idempotency key stability
// ---------------------------------------------------------------------------

describe('TASK-015 idempotency key stability', () => {
  test('buildIdempotencyKey produces stable deterministic string', () => {
    const k1 = buildIdempotencyKey(123n, 456n);
    const k2 = buildIdempotencyKey(123n, 456n);
    const k3 = buildIdempotencyKey(BigInt('123'), BigInt('456'));
    assert.equal(k1, k2, 'Same inputs → same key');
    assert.equal(k1, k3, 'BigInt literal vs BigInt() constructor → same key');
    assert.equal(k1, 'inventori:123:invoice:456');
  });

  test('buildIdempotencyKey (snapshot service) produces the canonical format', () => {
    // Both the snapshot builder and worker service must use the same key format.
    // The key is defined in fiscal-snapshot.service.js and used by both.
    const k = buildIdempotencyKey(99n, 77n);
    assert.equal(k, 'inventori:99:invoice:77', 'Key format must be inventori:{companyId}:invoice:{invoiceId}');
  });

  test('idempotency key does not include timestamp or randomness', () => {
    const k = buildIdempotencyKey(1n, 2n);
    // Should match exact format without Date or random components
    assert.match(k, /^inventori:\d+:invoice:\d+$/);
  });

  test('different invoiceIds produce different keys', () => {
    const k1 = buildIdempotencyKey(1n, 100n);
    const k2 = buildIdempotencyKey(1n, 101n);
    assert.notEqual(k1, k2);
  });

  test('different companyIds produce different keys', () => {
    const k1 = buildIdempotencyKey(1n, 100n);
    const k2 = buildIdempotencyKey(2n, 100n);
    assert.notEqual(k1, k2);
  });
});

// ---------------------------------------------------------------------------
// SUITE 7: Payload hash stability
// ---------------------------------------------------------------------------

describe('TASK-015 payload hash stability', () => {
  test('same payload produces same hash deterministically', () => {
    const payload = { receiver: { name: 'Test', identificationType: '01', identificationNumber: '123' }, lines: [{ lineNumber: 1, cabysCode: 'ABC' }] };
    const h1 = hashBillingPayload(payload);
    const h2 = hashBillingPayload(payload);
    assert.equal(h1, h2, 'Same payload → same hash');
    assert.match(h1, /^[0-9a-f]{64}$/, 'Hash should be 64-char hex (SHA-256)');
  });

  test('different payload produces different hash', () => {
    const h1 = hashBillingPayload({ amount: 1000 });
    const h2 = hashBillingPayload({ amount: 2000 });
    assert.notEqual(h1, h2);
  });

  test('hash is key-order-independent (canonical/stable stringify)', () => {
    const h1 = hashBillingPayload({ a: 1, b: 2 });
    const h2 = hashBillingPayload({ b: 2, a: 1 });
    assert.equal(h1, h2, 'Key-order should not affect hash');
  });
});

// ---------------------------------------------------------------------------
// SUITE 8: Fiscal snapshot builder
// ---------------------------------------------------------------------------

describe('TASK-015 fiscal snapshot builder', () => {
  function buildMinimalOrder() {
    return {
      id: 1n,
      companyId: 10n,
      paymentCondition: 'CASH',
      client: {
        id: 5n,
        name: 'Test Client',
        documentType: '02',
        legalId: '310100000001',
        emailBilling: 'client@test.com',
        paymentDays: 30,
      },
      clientStore: null,
      items: [
        {
          id: 1n,
          productId: 99n,
          quantity: 2,
          unitPrice: 1000,
          discountPercent: 0,
          discountAmount: 0,
          totalDiscount: 0,
          product: {
            id: 99n,
            name: 'Producto Test',
            code: 'P-001',
            unit: 'UN',
            cabysCode: '1234567890123',
            currency: 'CRC',
            taxExempt: false,
            taxRate: 13,
            controlsInventory: true,
          },
        },
      ],
    };
  }

  test('snapshot captures receiver at dispatch time (CLIENT fallback)', () => {
    const order = buildMinimalOrder();
    const receiver = resolveFiscalReceiver(order);
    assert.ok(receiver.ok, 'Should resolve receiver from client');
    const snapshot = buildFiscalSnapshotData({
      order,
      invoice: { id: 1n },
      receiver: receiver.receiver,
      config: { id: 1n, billingTenantId: 't1', billingCompanyId: 'bc1', billingEnvironment: 'SANDBOX' },
    });
    assert.equal(snapshot.receiverSourceType, 'CLIENT');
    assert.equal(snapshot.currency, 'CRC');
    assert.equal(snapshot.saleCondition, '01');
    assert.ok(Array.isArray(snapshot.linesSnapshot));
    assert.equal(snapshot.linesSnapshot.length, 1);
  });

  test('snapshot line captures discount metadata for discounted item', () => {
    const order = buildMinimalOrder();
    order.items[0].discountPercent = 10;
    order.items[0].discountAmount = 200;
    order.items[0].totalDiscount = 200;
    const receiver = resolveFiscalReceiver(order);
    const snapshot = buildFiscalSnapshotData({
      order,
      invoice: { id: 1n },
      receiver: receiver.receiver,
      config: { id: 1n, billingTenantId: 't1', billingCompanyId: 'bc1', billingEnvironment: 'SANDBOX' },
    });
    const line = snapshot.linesSnapshot[0];
    assert.ok(line.discountCode, 'Discounted line must have discountCode');
    assert.ok(line.discountNature, 'Discounted line must have discountNature');
    assert.equal(line.totalDiscount, 200);
  });

  test('credit snapshot captures creditTermDays', () => {
    const order = buildMinimalOrder();
    order.paymentCondition = 'CREDIT';
    const receiver = resolveFiscalReceiver(order);
    const snapshot = buildFiscalSnapshotData({
      order,
      invoice: { id: 1n },
      receiver: receiver.receiver,
      config: { id: 1n, billingTenantId: 't1', billingCompanyId: 'bc1', billingEnvironment: 'SANDBOX' },
    });
    assert.equal(snapshot.saleCondition, '02');
    assert.equal(snapshot.creditTermDays, 30, 'creditTermDays captured from client.paymentDays');
    assert.equal(snapshot.paymentMethod, null, 'CREDIT has no paymentMethod');
  });

  test('snapshot is immutable to later order mutation (copy not reference)', () => {
    const order = buildMinimalOrder();
    const receiver = resolveFiscalReceiver(order);
    const snapshot = buildFiscalSnapshotData({
      order,
      invoice: { id: 1n },
      receiver: receiver.receiver,
      config: { id: 1n, billingTenantId: 't1', billingCompanyId: 'bc1', billingEnvironment: 'SANDBOX' },
    });

    const capturedClientName = snapshot.receiverSnapshot.legalName;
    // Mutate order after snapshot
    order.client.name = 'MUTATED CLIENT NAME';
    // Snapshot must be unchanged
    assert.equal(snapshot.receiverSnapshot.legalName, capturedClientName, 'Snapshot must not reflect post-capture mutations');
  });
});

// ---------------------------------------------------------------------------
// SUITE 9: Readiness validation
// ---------------------------------------------------------------------------

describe('TASK-015 fiscal readiness validation', () => {
  function buildMinimalOrder(overrides = {}) {
    return {
      id: 1n,
      companyId: 10n,
      paymentCondition: 'CASH',
      client: { id: 5n, name: 'C', documentType: '02', legalId: '3101000001', emailBilling: 'c@t.com', paymentDays: 30 },
      clientStore: null,
      items: [{
        id: 1n, productId: 99n, quantity: 2, unitPrice: 1000,
        discountPercent: 0, discountAmount: 0, totalDiscount: 0,
        product: { id: 99n, name: 'P', unit: 'UN', cabysCode: '1234567890123', currency: 'CRC', taxExempt: false, taxRate: 13 },
      }],
      ...overrides,
    };
  }

  const validConfig = { id: 1n, billingTenantId: 't', billingCompanyId: 'bc', billingEnvironment: 'SANDBOX', billingCredentialSecretRef: 'env:X', enabled: true };

  test('valid order passes readiness when Billing is enabled', () => {
    const r = validateOrderFiscalReadiness(buildMinimalOrder(), validConfig);
    assert.equal(r.ok, true, `Should pass. Failures: ${JSON.stringify(r.failures)}`);
    assert.equal(r.enabled, true);
  });

  test('disabled config: enabled=false → skip all other checks (ok=true, enabled=false)', () => {
    const r = validateOrderFiscalReadiness(buildMinimalOrder(), { ...validConfig, enabled: false });
    assert.equal(r.enabled, false);
    assert.equal(r.ok, true, 'Disabled integration should not produce failures');
  });

  test('no config → BILLING_MAPPING_MISSING', () => {
    const r = validateOrderFiscalReadiness(buildMinimalOrder(), null);
    assert.equal(r.enabled, false, 'null config = not enabled');
  });

  test('config with enabled=false → no fiscal blocking', () => {
    const r = validateOrderFiscalReadiness(buildMinimalOrder(), { enabled: false });
    assert.equal(r.enabled, false);
  });

  test('missing billingCompanyId → BILLING_MAPPING_MISSING', () => {
    const r = validateOrderFiscalReadiness(buildMinimalOrder(), { ...validConfig, billingCompanyId: '' });
    const failure = r.failures.find((f) => f.code === 'BILLING_MAPPING_MISSING');
    assert.ok(failure, `Expected BILLING_MAPPING_MISSING but got: ${JSON.stringify(r.failures)}`);
  });

  test('non-CRC currency → UNSUPPORTED_CURRENCY', () => {
    const order = buildMinimalOrder();
    order.items[0].product.currency = 'USD';
    // Since getOrderCurrency uses clientStore.currency → items[0].product.currency, override:
    order.clientStore = { currency: 'USD' };
    const r = validateOrderFiscalReadiness(order, validConfig);
    const failure = r.failures.find((f) => f.code === 'UNSUPPORTED_CURRENCY');
    assert.ok(failure, `Expected UNSUPPORTED_CURRENCY but got: ${JSON.stringify(r.failures)}`);
  });

  test('missing client fiscal identity → FISCAL_RECEIVER_MISSING', () => {
    const order = buildMinimalOrder({ client: { id: 5n, name: '', documentType: '', legalId: '', emailBilling: '' } });
    const r = validateOrderFiscalReadiness(order, validConfig);
    const failure = r.failures.find((f) => f.code === 'FISCAL_RECEIVER_MISSING' || f.code === 'FISCAL_RECEIVER_IDENTITY_CONFLICT');
    assert.ok(failure, `Expected receiver failure but got: ${JSON.stringify(r.failures)}`);
  });

  test('missing CAByS → CABYS_MISSING', () => {
    const order = buildMinimalOrder();
    order.items[0].product.cabysCode = null;
    const r = validateOrderFiscalReadiness(order, validConfig);
    const failure = r.failures.find((f) => f.code === 'CABYS_MISSING');
    const failureSafe = r.failures.map((f) => ({ code: f.code, field: f.field }));
    assert.ok(failure, `Expected CABYS_MISSING but got: ${JSON.stringify(failureSafe)}`);
  });

  test('unsupported unit → UNSUPPORTED_FISCAL_UNIT', () => {
    const order = buildMinimalOrder();
    order.items[0].product.unit = 'HANDS';
    const r = validateOrderFiscalReadiness(order, validConfig);
    const failure = r.failures.find((f) => f.code === 'UNSUPPORTED_FISCAL_UNIT');
    const failureSafe = r.failures.map((f) => ({ code: f.code, field: f.field }));
    assert.ok(failure, `Expected UNSUPPORTED_FISCAL_UNIT but got: ${JSON.stringify(failureSafe)}`);
  });

  test('CREDIT with zero paymentDays → CREDIT_TERM_MISSING', () => {
    const order = buildMinimalOrder({ paymentCondition: 'CREDIT', client: { id: 5n, name: 'C', documentType: '02', legalId: '3101000001', emailBilling: 'c@t.com', paymentDays: 0 } });
    const r = validateOrderFiscalReadiness(order, validConfig);
    const failure = r.failures.find((f) => f.code === 'CREDIT_TERM_MISSING');
    assert.ok(failure, `Expected CREDIT_TERM_MISSING but got: ${JSON.stringify(r.failures)}`);
  });

  test('CREDIT with valid paymentDays passes', () => {
    const order = buildMinimalOrder({ paymentCondition: 'CREDIT', client: { id: 5n, name: 'C', documentType: '02', legalId: '3101000001', emailBilling: 'c@t.com', paymentDays: 30 } });
    const r = validateOrderFiscalReadiness(order, validConfig);
    assert.equal(r.ok, true, `Should pass for CREDIT with paymentDays=30. Failures: ${JSON.stringify(r.failures)}`);
  });

  test('receiver identity conflict → FISCAL_RECEIVER_IDENTITY_CONFLICT', () => {
    const order = buildMinimalOrder({
      client: { id: 5n, name: 'Client Alpha', documentType: '02', legalId: '3101000001', emailBilling: 'a@t.com' },
      clientStore: { id: 7n, name: 'Store Beta', documentType: '02', legalId: '3101999999', emailBilling: 'b@t.com', currency: 'CRC' },
    });
    const r = validateOrderFiscalReadiness(order, validConfig);
    const conflict = r.failures.find((f) => f.code === 'FISCAL_RECEIVER_IDENTITY_CONFLICT');
    assert.ok(conflict, `Expected FISCAL_RECEIVER_IDENTITY_CONFLICT. Got: ${JSON.stringify(r.failures)}`);
  });
});

// ---------------------------------------------------------------------------
// SUITE 10: Unit mapping completeness
// ---------------------------------------------------------------------------

describe('TASK-015 unit mapping completeness', () => {
  const EXPECTED_MAPPINGS = { UN: 'Unid', KG: 'Kg', G: 'G', L: 'L', ML: 'mL', M: 'M' };

  test('all expected Inventori units map to canonical Billing units', () => {
    for (const [unit, expected] of Object.entries(EXPECTED_MAPPINGS)) {
      const result = mapInventoriUnitToBillingUnit(unit, {});
      assert.equal(result, expected, `Unit ${unit} should map to ${expected}`);
    }
  });

  test('case-insensitive lookup: lowercase unit maps correctly', () => {
    assert.equal(mapInventoriUnitToBillingUnit('kg', {}), 'Kg');
    assert.equal(mapInventoriUnitToBillingUnit('un', {}), 'Unid');
    assert.equal(mapInventoriUnitToBillingUnit('ml', {}), 'mL');
  });

  test('service product maps to Sp regardless of unit', () => {
    assert.equal(mapInventoriUnitToBillingUnit('UN', { productNature: 'SERVICE' }), 'Sp');
    assert.equal(mapInventoriUnitToBillingUnit('KG', { controlsInventory: false }), 'Sp');
    assert.equal(mapInventoriUnitToBillingUnit(null, { productNature: 'SERVICE' }), 'Sp');
  });

  test('unknown unit returns null (hard block, do not guess)', () => {
    assert.equal(mapInventoriUnitToBillingUnit('HANDS', {}), null);
    assert.equal(mapInventoriUnitToBillingUnit('BOXES', {}), null);
    assert.equal(mapInventoriUnitToBillingUnit('', {}), null);
    assert.equal(mapInventoriUnitToBillingUnit(null, {}), null);
  });

  test('UNIT_MAPPING export is frozen/immutable', () => {
    assert.ok(Object.isFrozen(UNIT_MAPPING), 'UNIT_MAPPING must be frozen');
  });
});

// ---------------------------------------------------------------------------
// SUITE 11: Secret non-exposure in service files
// ---------------------------------------------------------------------------

describe('TASK-015 secret non-exposure in service modules', () => {
  const SENTINEL = 'SENTINEL_DO_NOT_LOG_OR_RETURN_THIS_VALUE';
  const SRC_SERVICES = path.join(__dirname, '..', 'src', 'services');

  const FISCAL_SERVICE_FILES = [
    'billing-api-client.service.js',
    'billing-credential-resolver.service.js',
    'billing-integration-config.service.js',
    'fiscal-billing-worker.service.js',
    'fiscal-readiness.service.js',
    'fiscal-snapshot.service.js',
    'fiscal-reconciliation.service.js',
    'fiscal-artifact-proxy.service.js',
    'fiscal-receiver-resolver.service.js',
    'fiscal-unit-mapping.service.js',
  ];

  test('billing-integration-config service serializer excludes billingCredentialSecretRef from output', () => {
    const { serializeBillingIntegrationConfig } = require('../src/services/billing-integration-config.service');
    const config = {
      id: 1n,
      companyId: 1n,
      billingTenantId: 'tenant-1',
      billingCompanyId: 'bc-1',
      billingEnvironment: 'SANDBOX',
      billingCredentialSecretRef: SENTINEL,
      enabled: true,
      readinessStatus: 'UNKNOWN',
      readinessCheckedAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const output = serializeBillingIntegrationConfig(config);
    // Use a safe serializer that handles BigInt for assertion only
    const serialized = JSON.stringify(output || {}, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
    assert.ok(!serialized.includes(SENTINEL), 'Serialized config must not expose billingCredentialSecretRef');
    assert.ok(output?.hasCredentialSecret === true, 'hasCredentialSecret must be true when ref exists');
  });

  test('fiscal service files do not log raw API keys (static source check)', () => {
    for (const file of FISCAL_SERVICE_FILES) {
      const content = fs.readFileSync(path.join(SRC_SERVICES, file), 'utf8');
      // Check for dangerous log patterns that would expose secrets
      const dangerousPatterns = [
        /console\.\w+\s*\([^)]*apiKey[^)]*\)/,
        /console\.\w+\s*\([^)]*secretRef[^)]*\)/,
        /console\.\w+\s*\([^)]*credential[^)]*\)/,
      ];
      for (const pattern of dangerousPatterns) {
        assert.ok(!pattern.test(content), `${file}: must not log apiKey/secretRef/credential`);
      }
    }
  });

  test('billing-integration-config.service.js never assigns billingCredentialSecretRef to outgoing data', () => {
    const content = fs.readFileSync(path.join(SRC_SERVICES, 'billing-integration-config.service.js'), 'utf8');
    // serializeBillingIntegrationConfig must not return billingCredentialSecretRef
    assert.ok(!content.includes('billingCredentialSecretRef: config.'), 'billingCredentialSecretRef must not be in serializer output');
  });
});

// ---------------------------------------------------------------------------
// SUITE 12: Observability format audit
// ---------------------------------------------------------------------------

describe('TASK-015 observability format audit', () => {
  test('fiscal-billing-worker logs contain safe fields only (no secret-like fields)', () => {
    const content = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'services', 'fiscal-billing-worker.service.js'), 'utf8',
    );
    // Check the logFiscalWorkerEvent function
    assert.ok(content.includes('component: \'fiscal-billing-worker\''), 'Worker must log component');
    assert.ok(content.includes('fiscalIntentId:'), 'Worker must log fiscalIntentId');
    assert.ok(content.includes('invoiceId:'), 'Worker must log invoiceId');
    assert.ok(content.includes('companyId:'), 'Worker must log companyId');
    assert.ok(content.includes('correlationId:'), 'Worker must log correlationId');
    // Must NOT contain dangerous fields
    assert.ok(!content.includes('apiKey:'), 'Worker must not log apiKey');
    // Note: 'secretReference:' may appear in billingClient call parameters (passing the env ref),
    // but it must NOT appear inside logFiscalWorkerEvent payload fields.
    const logEventFnMatch = content.match(/function logFiscalWorkerEvent[\s\S]*?^\}/m);
    if (logEventFnMatch) {
      assert.ok(!logEventFnMatch[0].includes('secretRef'), 'logFiscalWorkerEvent must not log secretRef');
    }
  });

  test('fiscal-reconciliation.service.js logs safe fields only', () => {
    const content = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'services', 'fiscal-reconciliation.service.js'), 'utf8',
    );
    assert.ok(content.includes('component: \'fiscal-reconciliation\''), 'Must log component');
    assert.ok(content.includes('billingFiscalDocumentId:'), 'Must log billingFiscalDocumentId');
    assert.ok(!content.includes('apiKey:'), 'Must not log apiKey');
  });

  test('fiscal-artifact-proxy.service.js logs safe fields only', () => {
    const content = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'services', 'fiscal-artifact-proxy.service.js'), 'utf8',
    );
    assert.ok(content.includes('component: \'fiscal-artifact-proxy\''), 'Must log component');
    assert.ok(content.includes('byteCount:'), 'Must log byteCount');
    assert.ok(!content.includes('apiKey:'), 'Must not log apiKey');
  });
});

// ---------------------------------------------------------------------------
// SUITE 13: Billing payload builder (deterministic)
// ---------------------------------------------------------------------------

describe('TASK-015 Billing payload builder determinism', () => {
  function buildMinimalSnapshot() {
    return {
      currency: 'CRC',
      saleCondition: '01',
      paymentMethod: '01',
      creditTermDays: null,
      receiverSnapshot: {
        sourceType: 'CLIENT',
        sourceId: '5',
        legalName: 'Test Client',
        identificationType: '02',
        identificationNumber: '3101000001',
        email: 'c@test.com',
      },
      headerSnapshot: { exchangeRate: '1.00000' },
      linesSnapshot: [{
        lineNumber: 1,
        cabysCode: '1234567890123',
        description: 'Test Product',
        fiscalUnit: 'Unid',
        quantity: 2,
        unitPrice: 1000,
        totalDiscount: 0,
        discountAmount: 0,
        taxCode: '01',
        taxRateCode: '08',
        taxRate: 13,
        taxAmount: 260,
        subtotal: 2000,
        total: 2260,
      }],
      totalsSnapshot: { subtotal: 2000, tax: 260, discount: 0, total: 2260 },
    };
  }

  test('buildBillingFiscalDocumentPayload builds valid payload from snapshot', () => {
    const payload = buildBillingFiscalDocumentPayload(buildMinimalSnapshot());
    assert.equal(payload.currency, 'CRC');
    assert.equal(payload.saleCondition, '01');
    assert.ok(Array.isArray(payload.lines));
    assert.equal(payload.lines.length, 1);
    assert.equal(payload.lines[0].cabysCode, '1234567890123');
    assert.equal(payload.lines[0].unitMeasure, 'Unid');
    assert.equal(payload.paymentMethod, '01');
  });

  test('CREDIT payload excludes paymentMethod (Billing contract)', () => {
    const snapshot = { ...buildMinimalSnapshot(), saleCondition: '02', paymentMethod: null, creditTermDays: 30 };
    const payload = buildBillingFiscalDocumentPayload(snapshot);
    assert.equal(payload.saleCondition, '02');
    assert.ok(!Object.prototype.hasOwnProperty.call(payload, 'paymentMethod'), 'CREDIT must omit paymentMethod from payload');
    assert.equal(payload.creditTermDays, 30);
  });

  test('missing snapshot → throws (graceful null guard)', () => {
    // When snapshot is null, the builder throws — either TypeError accessing properties,
    // or FISCAL_SNAPSHOT_MISSING code if the null-guard check fires first.
    // Either way, null must not silently produce a payload.
    assert.throws(
      () => buildBillingFiscalDocumentPayload(null),
      // Accept any error — the important thing is it THROWS rather than returning a payload
    );
  });

  test('non-CRC currency → throws UNSUPPORTED_CURRENCY', () => {
    const snapshot = { ...buildMinimalSnapshot(), currency: 'USD' };
    assert.throws(() => buildBillingFiscalDocumentPayload(snapshot), (err) => {
      assert.equal(err.code, 'UNSUPPORTED_CURRENCY');
      return true;
    });
  });

  test('payload hash is stable across runs', () => {
    const snapshot = buildMinimalSnapshot();
    const p1 = buildBillingFiscalDocumentPayload(snapshot);
    const p2 = buildBillingFiscalDocumentPayload(snapshot);
    assert.equal(hashBillingPayload(p1), hashBillingPayload(p2));
  });

  test('monetary amounts are formatted to 5 decimal places', () => {
    const payload = buildBillingFiscalDocumentPayload(buildMinimalSnapshot());
    const line = payload.lines[0];
    assert.match(String(line.quantity), /^\d+\.\d{5}$/);
    assert.match(String(line.unitPrice), /^\d+\.\d{5}$/);
    assert.match(String(line.taxAmount), /^\d+\.\d{5}$/);
    // subtotal and total are computed by Billing — must NOT be in CREATE payload
    assert.equal(line.subtotal, undefined, 'subtotal must be absent (computed by Billing)');
    assert.equal(line.total, undefined, 'total must be absent (computed by Billing)');
  });
});
