/**
 * TASK-014 — Billing fiscal artifact proxy tests (no database required).
 *
 * Covers:
 *   BillingApiClient.getArtifact  — content-type allowlist, size limits, byte identity,
 *                                    error mapping, secret non-exposure.
 *   fiscal-artifact-proxy.service — type mapping, ownership errors, error mapping,
 *                                    Content-Disposition safety, read-only invariant.
 */

'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const {
  BillingApiClient,
  BillingClientError,
  ALLOWED_ARTIFACT_CONTENT_TYPES,
  DEFAULT_ARTIFACT_MAX_BYTES,
  isAllowedArtifactContentType,
} = require('../src/services/billing-api-client.service');

const {
  INVENTORI_TO_BILLING_ARTIFACT_TYPE,
  ARTIFACT_MIME_BY_BILLING_TYPE,
  ARTIFACT_EXTENSION_BY_BILLING_TYPE,
  ARTIFACT_FILENAME_PREFIX_BY_BILLING_TYPE,
  buildContentDisposition,
  mapArtifactBillingErrorToHttp,
  getFiscalArtifact,
} = require('../src/services/fiscal-artifact-proxy.service');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fake credential resolver that tracks the secret reference. */
function makeFakeCredentialResolver(resolvedKey = 'fake-api-key') {
  return {
    resolveApiKey(secretReference) {
      this.lastSecretReference = secretReference;
      return resolvedKey;
    },
    lastSecretReference: null,
  };
}

/**
 * Builds a minimal fake fetch function that returns a Response-like object.
 * Used to test BillingApiClient.getArtifact without a real HTTP server.
 */
function makeFakeFetch({ statusCode = 200, contentType = 'application/pdf', body = Buffer.from('%PDF-1.4 fake'), headers: extraHeaders = {} } = {}) {
  const calls = [];

  function makeResponse({ responseStatus, responseContentType, responseBody, responseHeaders = {} }) {
    const allHeaders = {
      'content-type': responseContentType,
      ...(responseBody ? { 'content-length': String(responseBody.length) } : {}),
      ...responseHeaders,
    };
    return {
      ok: responseStatus >= 200 && responseStatus < 300,
      status: responseStatus,
      headers: { get(name) { return allHeaders[name.toLowerCase()] ?? null; } },
      async arrayBuffer() {
        if (responseBody instanceof Buffer) {
          return responseBody.buffer.slice(responseBody.byteOffset, responseBody.byteOffset + responseBody.byteLength);
        }
        return Buffer.from(responseBody || '').buffer;
      },
      async text() {
        if (typeof responseBody === 'string') return responseBody;
        return (responseBody ? Buffer.from(responseBody) : Buffer.alloc(0)).toString('utf8');
      },
    };
  }

  const fetchImpl = async (url, init) => {
    const requestHeaders = Object.fromEntries(Object.entries(init?.headers || {}));
    calls.push({ url, method: init?.method || 'GET', requestHeaders });
    const pathname = new URL(String(url)).pathname;

    if (pathname.endsWith('/artifacts')) {
      if (statusCode !== 200) {
        return makeResponse({ responseStatus: statusCode, responseContentType: 'application/json', responseBody: body });
      }
      return makeResponse({
        responseStatus: 200,
        responseContentType: 'application/json',
        responseBody: JSON.stringify([
          { id: 'artifact-pdf', type: 'PDF' },
          { id: 'artifact-signed-xml', type: 'SIGNED_XML' },
          { id: 'artifact-hacienda-response', type: 'HACIENDA_RESPONSE_XML' },
        ]),
      });
    }

    return makeResponse({
      responseStatus: statusCode,
      responseContentType: contentType,
      responseBody: body,
      responseHeaders: extraHeaders,
    });
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// ---------------------------------------------------------------------------
// Fake billing client for proxy service tests (no real fetch)
// ---------------------------------------------------------------------------

class FakeArtifactBillingClient {
  constructor(artifactsByType = {}, options = {}) {
    this.artifactsByType = artifactsByType;
    this.options = options;
    this.calls = [];
  }

  async getArtifact({ billingFiscalDocumentId, artifactType, correlationId, secretReference }) {
    // Record call details but not the secret value itself
    this.calls.push({
      billingFiscalDocumentId,
      artifactType,
      correlationId,
      calledWithSecretRef: secretReference !== undefined,
    });
    if (this.options.throwOnGet) throw this.options.throwOnGet;
    const artifact = this.artifactsByType[artifactType];
    if (!artifact) {
      throw new BillingClientError('Artifact not found', {
        code: 'BILLING_HTTP_ERROR',
        statusCode: 404,
        retryable: false,
        correlationId,
      });
    }
    return { contentType: artifact.contentType, bytes: artifact.bytes };
  }

  get callCount() { return this.calls.length; }
}

/** Minimal fake DB that mimics Prisma invoice/intent queries for service-level tests. */
function makeFakeDb({ invoice = null, intent = null, throwOnInvoice = false } = {}) {
  return {
    invoice: {
      async findFirst() {
        if (throwOnInvoice) throw new Error('DB error');
        return invoice;
      },
    },
    invoiceFiscalIntent: {
      async findUnique() {
        return intent;
      },
    },
    // Mutations — should NEVER be called by artifact proxy
    _updateCalls: [],
    async update(args) {
      this._updateCalls.push(args);
      return args.data;
    },
  };
}

// ---------------------------------------------------------------------------
// SUITE 1: BillingApiClient.getArtifact — MIME allowlist and size safety
// ---------------------------------------------------------------------------

describe('TASK-014 BillingApiClient.getArtifact — content-type allowlist and size safety', () => {

  test('isAllowedArtifactContentType accepts application/pdf', () => {
    assert.ok(isAllowedArtifactContentType('application/pdf'));
    assert.ok(isAllowedArtifactContentType('application/pdf; charset=utf-8'));
  });

  test('isAllowedArtifactContentType accepts application/xml', () => {
    assert.ok(isAllowedArtifactContentType('application/xml'));
    assert.ok(isAllowedArtifactContentType('application/xml; charset=UTF-8'));
  });

  test('isAllowedArtifactContentType accepts text/xml', () => {
    assert.ok(isAllowedArtifactContentType('text/xml'));
  });

  test('isAllowedArtifactContentType rejects text/html', () => {
    assert.ok(!isAllowedArtifactContentType('text/html'));
  });

  test('isAllowedArtifactContentType rejects application/javascript', () => {
    assert.ok(!isAllowedArtifactContentType('application/javascript'));
  });

  test('isAllowedArtifactContentType rejects null and empty string', () => {
    assert.ok(!isAllowedArtifactContentType(null));
    assert.ok(!isAllowedArtifactContentType(''));
  });

  test('ALLOWED_ARTIFACT_CONTENT_TYPES exports the correct set', () => {
    assert.ok(ALLOWED_ARTIFACT_CONTENT_TYPES.has('application/pdf'));
    assert.ok(ALLOWED_ARTIFACT_CONTENT_TYPES.has('application/xml'));
    assert.ok(ALLOWED_ARTIFACT_CONTENT_TYPES.has('text/xml'));
    assert.ok(!ALLOWED_ARTIFACT_CONTENT_TYPES.has('text/html'));
  });

  test('DEFAULT_ARTIFACT_MAX_BYTES is 10 MB', () => {
    assert.equal(DEFAULT_ARTIFACT_MAX_BYTES, 10 * 1024 * 1024);
  });

  test('getArtifact throws BILLING_UNEXPECTED_CONTENT_TYPE for text/html', async () => {
    const fetchImpl = makeFakeFetch({ contentType: 'text/html', body: Buffer.from('<html>') });
    const client = new BillingApiClient({
      baseUrl: 'http://fake-billing.test',
      credentialResolver: makeFakeCredentialResolver(),
      fetchImpl,
    });
    await assert.rejects(
      () => client.getArtifact({ billingCompanyId: 'c1', environment: 'sandbox', billingFiscalDocumentId: 'doc1', artifactType: 'PDF', secretReference: 'env:FAKE_KEY' }),
      (err) => {
        assert.equal(err.code, 'BILLING_UNEXPECTED_CONTENT_TYPE');
        assert.equal(err.retryable, false);
        return true;
      },
    );
  });

  test('getArtifact throws BILLING_ARTIFACT_TOO_LARGE when Content-Length exceeds maxBytes', async () => {
    const tinyMax = 100;
    const fetchImpl = makeFakeFetch({
      contentType: 'application/pdf',
      body: Buffer.alloc(50), // body is small — we test the declared length check
      headers: { 'content-length': String(tinyMax + 1) },
    });
    // Override content-length header to be bigger than body to test declared-length check
    const client = new BillingApiClient({
      baseUrl: 'http://fake-billing.test',
      credentialResolver: makeFakeCredentialResolver(),
      fetchImpl,
    });
    await assert.rejects(
      () => client.getArtifact({
        billingCompanyId: 'c1', environment: 'sandbox', billingFiscalDocumentId: 'doc1',
        artifactType: 'PDF', secretReference: 'env:FAKE_KEY', maxBytes: tinyMax,
      }),
      (err) => {
        assert.equal(err.code, 'BILLING_ARTIFACT_TOO_LARGE');
        assert.equal(err.retryable, false);
        return true;
      },
    );
  });

  test('getArtifact throws BILLING_ARTIFACT_TOO_LARGE when actual bytes exceed maxBytes', async () => {
    const tinyMax = 50;
    const largeBody = Buffer.alloc(tinyMax + 1);
    // No content-length header so declared check is skipped
    const fetchImpl = makeFakeFetch({ contentType: 'application/pdf', body: largeBody, headers: {} });
    // Patch: fetch returns no content-length
    const origGet = fetchImpl;
    const patchedFetch = async (url, init) => {
      const resp = await origGet(url, init);
      resp.headers = { get: (name) => name === 'content-type' ? 'application/pdf' : null };
      return resp;
    };
    patchedFetch.calls = origGet.calls;

    const client = new BillingApiClient({
      baseUrl: 'http://fake-billing.test',
      credentialResolver: makeFakeCredentialResolver(),
      fetchImpl: patchedFetch,
    });
    await assert.rejects(
      () => client.getArtifact({
        billingCompanyId: 'c1', environment: 'sandbox', billingFiscalDocumentId: 'doc1',
        artifactType: 'PDF', secretReference: 'env:FAKE_KEY', maxBytes: tinyMax,
      }),
      (err) => {
        assert.equal(err.code, 'BILLING_ARTIFACT_TOO_LARGE');
        return true;
      },
    );
  });

  test('getArtifact throws BILLING_HTTP_ERROR for 404', async () => {
    const fetchImpl = makeFakeFetch({ statusCode: 404, contentType: 'application/json', body: Buffer.from('{"message":"not found"}') });
    const client = new BillingApiClient({
      baseUrl: 'http://fake-billing.test',
      credentialResolver: makeFakeCredentialResolver(),
      fetchImpl,
    });
    await assert.rejects(
      () => client.getArtifact({ billingCompanyId: 'c1', environment: 'sandbox', billingFiscalDocumentId: 'doc1', artifactType: 'PDF', secretReference: 'env:FAKE_KEY' }),
      (err) => {
        assert.equal(err.statusCode, 404);
        assert.ok(err instanceof BillingClientError);
        return true;
      },
    );
  });

  test('getArtifact throws BILLING_TIMEOUT on AbortError', async () => {
    const fetchImpl = async () => { const err = new Error('abort'); err.name = 'AbortError'; throw err; };
    const client = new BillingApiClient({
      baseUrl: 'http://fake-billing.test',
      credentialResolver: makeFakeCredentialResolver(),
      fetchImpl,
      timeoutMs: 1,
    });
    await assert.rejects(
      () => client.getArtifact({ billingCompanyId: 'c1', environment: 'sandbox', billingFiscalDocumentId: 'doc1', artifactType: 'PDF', secretReference: 'env:FAKE_KEY' }),
      (err) => {
        assert.equal(err.code, 'BILLING_TIMEOUT');
        assert.equal(err.retryable, true);
        return true;
      },
    );
  });

  test('getArtifact injects API key into X-API-Key header and does NOT return it', async () => {
    const sentinelKey = 'sentinel-artifact-api-key-12345';
    const pdfBytes = Buffer.from('%PDF-1.4 deterministic-test-pdf');
    const fetchImpl = makeFakeFetch({ contentType: 'application/pdf', body: pdfBytes });
    const client = new BillingApiClient({
      baseUrl: 'http://fake-billing.test',
      credentialResolver: makeFakeCredentialResolver(sentinelKey),
      fetchImpl,
    });

    const result = await client.getArtifact({
      billingCompanyId: 'c1', environment: 'sandbox', billingFiscalDocumentId: 'doc1',
      artifactType: 'PDF', secretReference: 'env:SENTINEL_KEY',
    });

    // Key used in request header
    assert.equal(fetchImpl.calls[0].requestHeaders['X-API-Key'], sentinelKey);
    // Key NOT in returned bytes
    assert.ok(!result.bytes.toString('utf8').includes(sentinelKey), 'Sentinel key must not appear in returned bytes');
    // Key NOT in contentType
    assert.ok(!String(result.contentType || '').includes(sentinelKey));
  });

  test('getArtifact strips Content-Type parameters before returning', async () => {
    const fetchImpl = makeFakeFetch({ contentType: 'application/pdf; charset=UTF-8', body: Buffer.from('%PDF') });
    const client = new BillingApiClient({
      baseUrl: 'http://fake-billing.test',
      credentialResolver: makeFakeCredentialResolver(),
      fetchImpl,
    });
    const result = await client.getArtifact({
      billingCompanyId: 'c1', environment: 'sandbox', billingFiscalDocumentId: 'doc1',
      artifactType: 'PDF', secretReference: 'env:FAKE_KEY',
    });
    assert.equal(result.contentType, 'application/pdf');
  });

});

// ---------------------------------------------------------------------------
// SUITE 2: BillingApiClient.getArtifact — exact byte identity
// ---------------------------------------------------------------------------

describe('TASK-014 BillingApiClient.getArtifact — exact byte identity', () => {

  async function getArtifactBytes(contentType, inputBytes) {
    const fetchImpl = makeFakeFetch({ contentType, body: inputBytes });
    const client = new BillingApiClient({
      baseUrl: 'http://fake-billing.test',
      credentialResolver: makeFakeCredentialResolver(),
      fetchImpl,
    });
    const result = await client.getArtifact({
      billingCompanyId: 'c1', environment: 'sandbox', billingFiscalDocumentId: 'doc1',
      artifactType: 'PDF', secretReference: 'env:FAKE_KEY',
    });
    return result.bytes;
  }

  test('PDF bytes are returned byte-for-byte (SHA-256 identity)', async () => {
    // Deterministic fake PDF with known binary pattern
    const fakePdfBytes = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x00, 0x01, 0x02, 0x03]);
    const proxied = await getArtifactBytes('application/pdf', fakePdfBytes);
    assert.equal(sha256(proxied), sha256(fakePdfBytes), 'Proxied PDF SHA-256 must match fake PDF SHA-256');
  });

  test('SIGNED_XML bytes are returned byte-for-byte (SHA-256 identity)', async () => {
    const signedXmlBytes = Buffer.from(
      '<?xml version="1.0"?><FacturaElectronica xmlns="https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/facturaElectronica">' +
      '<Clave>50601012600310111111100100001010000000001199999999</Clave>' +
      '<Signature xmlns="http://www.w3.org/2000/09/xmldsig#"><SignatureValue>DETERMINISTIC==</SignatureValue></Signature>' +
      '</FacturaElectronica>',
      'utf8',
    );
    const proxied = await getArtifactBytes('application/xml', signedXmlBytes);
    assert.equal(sha256(proxied), sha256(signedXmlBytes), 'Proxied SIGNED_XML SHA-256 must match original');
    // Extra: verify bytes are identical, not just hash-matching
    assert.deepStrictEqual([...proxied], [...signedXmlBytes]);
  });

  test('HACIENDA_RESPONSE_XML bytes are returned byte-for-byte (SHA-256 identity)', async () => {
    const haciendaXmlBytes = Buffer.from(
      '<?xml version="1.0"?><MensajeReceptor><Clave>50601012600310111111100100001010000000001199999999</Clave>' +
      '<Mensaje>1</Mensaje><DetalleMensaje>Aceptado</DetalleMensaje></MensajeReceptor>',
      'utf8',
    );
    const proxied = await getArtifactBytes('application/xml', haciendaXmlBytes);
    assert.equal(sha256(proxied), sha256(haciendaXmlBytes), 'Proxied HACIENDA_RESPONSE_XML SHA-256 must match original');
    assert.deepStrictEqual([...proxied], [...haciendaXmlBytes]);
  });

  test('bytes with null bytes and binary content are preserved exactly', async () => {
    // Binary content with null bytes, high-byte values — must not be corrupted
    const binaryBytes = Buffer.from([0x00, 0x01, 0x7f, 0x80, 0xff, 0xfe, 0x0a, 0x0d]);
    const proxied = await getArtifactBytes('application/pdf', binaryBytes);
    assert.deepStrictEqual([...proxied], [...binaryBytes]);
  });

});

// ---------------------------------------------------------------------------
// SUITE 3: Artifact type mapping
// ---------------------------------------------------------------------------

describe('TASK-014 fiscal-artifact-proxy — artifact type mapping', () => {

  test('url type pdf maps to Billing PDF', () => {
    assert.equal(INVENTORI_TO_BILLING_ARTIFACT_TYPE['pdf'], 'PDF');
  });

  test('url type signed-xml maps to Billing SIGNED_XML', () => {
    assert.equal(INVENTORI_TO_BILLING_ARTIFACT_TYPE['signed-xml'], 'SIGNED_XML');
  });

  test('url type hacienda-response maps to Billing HACIENDA_RESPONSE_XML', () => {
    assert.equal(INVENTORI_TO_BILLING_ARTIFACT_TYPE['hacienda-response'], 'HACIENDA_RESPONSE_XML');
  });

  test('unknown type is not in mapping', () => {
    assert.equal(INVENTORI_TO_BILLING_ARTIFACT_TYPE['xml'], undefined);
    assert.equal(INVENTORI_TO_BILLING_ARTIFACT_TYPE['invoice'], undefined);
    assert.equal(INVENTORI_TO_BILLING_ARTIFACT_TYPE['../secret'], undefined);
  });

  test('ARTIFACT_MIME_BY_BILLING_TYPE returns correct MIME types', () => {
    assert.equal(ARTIFACT_MIME_BY_BILLING_TYPE.PDF, 'application/pdf');
    assert.equal(ARTIFACT_MIME_BY_BILLING_TYPE.SIGNED_XML, 'application/xml');
    assert.equal(ARTIFACT_MIME_BY_BILLING_TYPE.HACIENDA_RESPONSE_XML, 'application/xml');
  });

  test('ARTIFACT_EXTENSION_BY_BILLING_TYPE returns correct extensions', () => {
    assert.equal(ARTIFACT_EXTENSION_BY_BILLING_TYPE.PDF, 'pdf');
    assert.equal(ARTIFACT_EXTENSION_BY_BILLING_TYPE.SIGNED_XML, 'xml');
    assert.equal(ARTIFACT_EXTENSION_BY_BILLING_TYPE.HACIENDA_RESPONSE_XML, 'xml');
  });

  test('ARTIFACT_FILENAME_PREFIX_BY_BILLING_TYPE returns correct prefixes', () => {
    assert.equal(ARTIFACT_FILENAME_PREFIX_BY_BILLING_TYPE.PDF, 'factura');
    assert.equal(ARTIFACT_FILENAME_PREFIX_BY_BILLING_TYPE.SIGNED_XML, 'factura');
    assert.equal(ARTIFACT_FILENAME_PREFIX_BY_BILLING_TYPE.HACIENDA_RESPONSE_XML, 'respuesta-hacienda');
  });

});

// ---------------------------------------------------------------------------
// SUITE 4: Content-Disposition safety
// ---------------------------------------------------------------------------

describe('TASK-014 fiscal-artifact-proxy — Content-Disposition safety', () => {

  test('uses clave when available: PDF', () => {
    const cd = buildContentDisposition('PDF', '50601012600310111111100100001010000000001199999999', 42n);
    assert.equal(cd, 'attachment; filename="factura-50601012600310111111100100001010000000001199999999.pdf"');
  });

  test('uses clave when available: SIGNED_XML', () => {
    const cd = buildContentDisposition('SIGNED_XML', '506010100000001', 42n);
    assert.equal(cd, 'attachment; filename="factura-506010100000001.xml"');
  });

  test('uses clave when available: HACIENDA_RESPONSE_XML', () => {
    const cd = buildContentDisposition('HACIENDA_RESPONSE_XML', '506010100000001', 42n);
    assert.equal(cd, 'attachment; filename="respuesta-hacienda-506010100000001.xml"');
  });

  test('falls back to invoice ID when clave is null', () => {
    const cd = buildContentDisposition('PDF', null, 99n);
    assert.equal(cd, 'attachment; filename="factura-inv-99.pdf"');
  });

  test('falls back to invoice ID when clave is empty string', () => {
    const cd = buildContentDisposition('PDF', '', 77n);
    assert.equal(cd, 'attachment; filename="factura-inv-77.pdf"');
  });

  test('sanitizes special characters from clave', () => {
    // Clave with path traversal attempt
    const cd = buildContentDisposition('PDF', '../../../etc/passwd', 1n);
    // Sanitization removes all non-alphanumeric — '.' and '/' are stripped
    const cleaned = '../../../etc/passwd'.replace(/[^a-zA-Z0-9]/g, '');
    assert.ok(cd.includes(cleaned));
    assert.ok(!cd.includes('..'));
    assert.ok(!cd.includes('/'));
  });

  test('CRLF injection attempt in clave is blocked', () => {
    // Even after sanitization, the control-char guard should catch residual issues
    // The \r\n chars are non-alphanumeric so they're stripped in the sanitization step
    const cd = buildContentDisposition('PDF', 'valid\r\nSet-Cookie: evil=1', 1n);
    // Should not contain CRLF in output
    assert.ok(!cd.includes('\r'));
    assert.ok(!cd.includes('\n'));
  });

  test('long clave is truncated to 50 characters', () => {
    const longClave = '1'.repeat(100);
    const cd = buildContentDisposition('PDF', longClave, 1n);
    // Should not exceed reasonable header length
    assert.ok(cd.length < 200, 'Content-Disposition should be reasonably short');
    assert.ok(!cd.includes('1'.repeat(51)), 'Clave portion should be truncated');
  });

  test('Content-Disposition always starts with attachment', () => {
    for (const [inv, billing] of Object.entries(INVENTORI_TO_BILLING_ARTIFACT_TYPE)) {
      const cd = buildContentDisposition(billing, '12345', 1n);
      assert.ok(cd.startsWith('attachment; filename="'), `${inv}: should start with attachment`);
    }
  });

});

// ---------------------------------------------------------------------------
// SUITE 5: Billing → HTTP error mapping
// ---------------------------------------------------------------------------

describe('TASK-014 fiscal-artifact-proxy — Billing error mapping', () => {

  test('BILLING_TIMEOUT → HTTP 504', () => {
    const err = new BillingClientError('timeout', { code: 'BILLING_TIMEOUT', retryable: true });
    const mapped = mapArtifactBillingErrorToHttp(err);
    assert.equal(mapped.statusCode, 504);
    assert.equal(mapped.code, 'BILLING_TIMEOUT');
  });

  test('BILLING_UNAVAILABLE → HTTP 503', () => {
    const err = new BillingClientError('unavail', { code: 'BILLING_UNAVAILABLE', retryable: true });
    const mapped = mapArtifactBillingErrorToHttp(err);
    assert.equal(mapped.statusCode, 503);
    assert.equal(mapped.code, 'BILLING_UNAVAILABLE');
  });

  test('BILLING_ARTIFACT_TOO_LARGE → HTTP 502', () => {
    const err = new BillingClientError('too large', { code: 'BILLING_ARTIFACT_TOO_LARGE', retryable: false });
    const mapped = mapArtifactBillingErrorToHttp(err);
    assert.equal(mapped.statusCode, 502);
    assert.equal(mapped.code, 'BILLING_ARTIFACT_TOO_LARGE');
  });

  test('BILLING_UNEXPECTED_CONTENT_TYPE → HTTP 502', () => {
    const err = new BillingClientError('bad type', { code: 'BILLING_UNEXPECTED_CONTENT_TYPE', retryable: false });
    const mapped = mapArtifactBillingErrorToHttp(err);
    assert.equal(mapped.statusCode, 502);
    assert.equal(mapped.code, 'BILLING_ARTIFACT_CONTENT_TYPE_ERROR');
  });

  test('Billing 404 → HTTP 404 not found', () => {
    const err = new BillingClientError('not found', { code: 'BILLING_HTTP_ERROR', statusCode: 404, retryable: false });
    const mapped = mapArtifactBillingErrorToHttp(err);
    assert.equal(mapped.statusCode, 404);
    assert.equal(mapped.code, 'FISCAL_ARTIFACT_NOT_FOUND');
  });

  test('Billing 401 → HTTP 502 (do not expose auth failure)', () => {
    const err = new BillingClientError('unauthorized', { code: 'BILLING_HTTP_ERROR', statusCode: 401, retryable: false });
    const mapped = mapArtifactBillingErrorToHttp(err);
    assert.equal(mapped.statusCode, 502);
    assert.equal(mapped.code, 'BILLING_ARTIFACT_AUTH_ERROR');
  });

  test('Billing 403 → HTTP 502 (do not expose auth failure)', () => {
    const err = new BillingClientError('forbidden', { code: 'BILLING_HTTP_ERROR', statusCode: 403, retryable: false });
    const mapped = mapArtifactBillingErrorToHttp(err);
    assert.equal(mapped.statusCode, 502);
    assert.equal(mapped.code, 'BILLING_ARTIFACT_AUTH_ERROR');
  });

  test('Billing 400 → HTTP 422', () => {
    const err = new BillingClientError('bad request', { code: 'BILLING_HTTP_ERROR', statusCode: 400, retryable: false });
    const mapped = mapArtifactBillingErrorToHttp(err);
    assert.equal(mapped.statusCode, 422);
  });

  test('Billing 409 → HTTP 422', () => {
    const err = new BillingClientError('conflict', { code: 'BILLING_HTTP_ERROR', statusCode: 409, retryable: false });
    const mapped = mapArtifactBillingErrorToHttp(err);
    assert.equal(mapped.statusCode, 422);
  });

  test('Billing 422 → HTTP 422', () => {
    const err = new BillingClientError('unprocessable', { code: 'BILLING_HTTP_ERROR', statusCode: 422, retryable: false });
    const mapped = mapArtifactBillingErrorToHttp(err);
    assert.equal(mapped.statusCode, 422);
  });

  test('Billing 429 → HTTP 503', () => {
    const err = new BillingClientError('rate limited', { code: 'BILLING_HTTP_ERROR', statusCode: 429, retryable: true });
    const mapped = mapArtifactBillingErrorToHttp(err);
    assert.equal(mapped.statusCode, 503);
  });

  test('Billing 500 → HTTP 502', () => {
    const err = new BillingClientError('server error', { code: 'BILLING_HTTP_ERROR', statusCode: 500, retryable: true });
    const mapped = mapArtifactBillingErrorToHttp(err);
    assert.equal(mapped.statusCode, 502);
  });

  test('Billing 503 → HTTP 503', () => {
    const err = new BillingClientError('unavail', { code: 'BILLING_HTTP_ERROR', statusCode: 503, retryable: true });
    const mapped = mapArtifactBillingErrorToHttp(err);
    assert.equal(mapped.statusCode, 503);
  });

  test('non-BillingClientError → HTTP 502', () => {
    const err = new Error('unexpected');
    const mapped = mapArtifactBillingErrorToHttp(err);
    assert.equal(mapped.statusCode, 502);
    assert.equal(mapped.code, 'BILLING_ARTIFACT_UNAVAILABLE');
  });

  test('error mapping does not expose Billing API key', () => {
    const sentinelKey = 'sentinel-should-not-appear';
    const err = new BillingClientError(`Error with ${sentinelKey} detail`, { code: 'BILLING_HTTP_ERROR', statusCode: 500 });
    const mapped = mapArtifactBillingErrorToHttp(err);
    assert.ok(!String(mapped.message || '').includes(sentinelKey), 'Mapped error message must not contain sentinel key');
  });

});

// ---------------------------------------------------------------------------
// SUITE 6: getFiscalArtifact service-level validation
// ---------------------------------------------------------------------------

describe('TASK-014 getFiscalArtifact — service-level validation', () => {

  test('unknown artifact type returns 400 BEFORE any DB or network call', async () => {
    const db = makeFakeDb();
    const billingClient = new FakeArtifactBillingClient();

    await assert.rejects(
      () => getFiscalArtifact(1n, 'invoice-json', 100n, { db, billingClient }),
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, 'ARTIFACT_TYPE_UNSUPPORTED');
        return true;
      },
    );
    // No DB queries triggered
    assert.equal(billingClient.callCount, 0);
  });

  test('uppercase artifact type is not supported — type lookup is exact', async () => {
    const db = makeFakeDb();
    const billingClient = new FakeArtifactBillingClient();
    await assert.rejects(
      () => getFiscalArtifact(1n, 'PDF', 100n, { db, billingClient }),
      (err) => { assert.equal(err.statusCode, 400); return true; },
    );
  });

  test('invoice not found → 404', async () => {
    const db = makeFakeDb({ invoice: null });
    const billingClient = new FakeArtifactBillingClient();
    await assert.rejects(
      () => getFiscalArtifact(1n, 'pdf', 100n, { db, billingClient }),
      (err) => { assert.equal(err.statusCode, 404); assert.equal(err.code, 'not_found'); return true; },
    );
    assert.equal(billingClient.callCount, 0);
  });

  test('invoice found but no fiscal intent → 422 FISCAL_INTENT_NOT_FOUND', async () => {
    const db = makeFakeDb({ invoice: { id: 1n, status: 'PENDING' }, intent: null });
    const billingClient = new FakeArtifactBillingClient();
    await assert.rejects(
      () => getFiscalArtifact(1n, 'pdf', 100n, { db, billingClient }),
      (err) => { assert.equal(err.statusCode, 422); assert.equal(err.code, 'FISCAL_INTENT_NOT_FOUND'); return true; },
    );
    assert.equal(billingClient.callCount, 0);
  });

  test('intent exists but billingFiscalDocumentId is null → 422 ARTIFACT_NOT_READY', async () => {
    const db = makeFakeDb({
      invoice: { id: 1n, status: 'PENDING' },
      intent: {
        id: 1n, companyId: 100n, invoiceId: 1n,
        status: 'PENDING', billingFiscalDocumentId: null, clave: null,
        integrationConfig: { billingCompanyId: 'bc1', billingEnvironment: 'SANDBOX', billingCredentialSecretRef: 'env:FAKE' },
      },
    });
    const billingClient = new FakeArtifactBillingClient();
    await assert.rejects(
      () => getFiscalArtifact(1n, 'pdf', 100n, { db, billingClient }),
      (err) => { assert.equal(err.statusCode, 422); assert.equal(err.code, 'ARTIFACT_NOT_READY'); return true; },
    );
    assert.equal(billingClient.callCount, 0);
  });

  test('PROCESSING intent with billingFiscalDocumentId can request artifact (Billing is authoritative)', async () => {
    const fakePdfBytes = Buffer.from('%PDF-1.4 test-processing');
    const db = makeFakeDb({
      invoice: { id: 1n, status: 'PENDING' },
      intent: {
        id: 2n, companyId: 100n, invoiceId: 1n,
        status: 'PROCESSING', billingFiscalDocumentId: 'billing-doc-proc-1', clave: null,
        integrationConfig: { billingCompanyId: 'bc1', billingEnvironment: 'SANDBOX', billingCredentialSecretRef: 'env:FAKE' },
      },
    });
    const billingClient = new FakeArtifactBillingClient({ PDF: { contentType: 'application/pdf', bytes: fakePdfBytes } });

    const result = await getFiscalArtifact(1n, 'pdf', 100n, { db, billingClient });
    assert.equal(billingClient.callCount, 1);
    assert.equal(sha256(result.bytes), sha256(fakePdfBytes));
  });

  test('successful ACCEPTED artifact retrieval returns correct bytes and headers', async () => {
    const fakePdfBytes = Buffer.from('%PDF-1.4 accepted-test');
    const db = makeFakeDb({
      invoice: { id: 5n, status: 'PAID' },
      intent: {
        id: 10n, companyId: 200n, invoiceId: 5n,
        status: 'ACCEPTED', billingFiscalDocumentId: 'billing-doc-accepted-1',
        clave: '50601012600310111111100100001010000000001199999999', consecutive: '001',
        integrationConfig: { billingCompanyId: 'bc2', billingEnvironment: 'SANDBOX', billingCredentialSecretRef: 'env:FAKE' },
      },
    });
    const billingClient = new FakeArtifactBillingClient({ PDF: { contentType: 'application/pdf', bytes: fakePdfBytes } });

    const result = await getFiscalArtifact(5n, 'pdf', 200n, { db, billingClient });

    assert.equal(result.contentType, 'application/pdf');
    assert.ok(result.contentDisposition.startsWith('attachment; filename="factura-'));
    assert.ok(result.contentDisposition.includes('.pdf"'));
    assert.equal(sha256(result.bytes), sha256(fakePdfBytes));
  });

  test('signed-xml artifact request uses SIGNED_XML billing type', async () => {
    const xmlBytes = Buffer.from('<?xml version="1.0"?><FacturaElectronica/>');
    const db = makeFakeDb({
      invoice: { id: 5n, status: 'PAID' },
      intent: {
        id: 10n, companyId: 200n, invoiceId: 5n,
        status: 'ACCEPTED', billingFiscalDocumentId: 'billing-doc-xml-1', clave: '506',
        integrationConfig: { billingCompanyId: 'bc2', billingEnvironment: 'SANDBOX', billingCredentialSecretRef: 'env:FAKE' },
      },
    });
    const billingClient = new FakeArtifactBillingClient({ SIGNED_XML: { contentType: 'application/xml', bytes: xmlBytes } });

    const result = await getFiscalArtifact(5n, 'signed-xml', 200n, { db, billingClient });

    assert.equal(billingClient.calls[0].artifactType, 'SIGNED_XML');
    assert.equal(result.contentType, 'application/xml');
    assert.ok(result.contentDisposition.includes('.xml"'));
    assert.equal(sha256(result.bytes), sha256(xmlBytes));
  });

  test('hacienda-response artifact uses HACIENDA_RESPONSE_XML billing type and respuesta-hacienda prefix', async () => {
    const respXmlBytes = Buffer.from('<?xml version="1.0"?><MensajeReceptor/>');
    const db = makeFakeDb({
      invoice: { id: 5n, status: 'PENDING' },
      intent: {
        id: 10n, companyId: 200n, invoiceId: 5n,
        status: 'REJECTED', billingFiscalDocumentId: 'billing-doc-hacienda-1', clave: '506',
        integrationConfig: { billingCompanyId: 'bc2', billingEnvironment: 'SANDBOX', billingCredentialSecretRef: 'env:FAKE' },
      },
    });
    const billingClient = new FakeArtifactBillingClient({ HACIENDA_RESPONSE_XML: { contentType: 'application/xml', bytes: respXmlBytes } });

    const result = await getFiscalArtifact(5n, 'hacienda-response', 200n, { db, billingClient });

    assert.equal(billingClient.calls[0].artifactType, 'HACIENDA_RESPONSE_XML');
    assert.ok(result.contentDisposition.includes('respuesta-hacienda-'));
    assert.equal(sha256(result.bytes), sha256(respXmlBytes));
  });

  test('Billing 404 → service returns 404 HTTP error (not raw BillingClientError)', async () => {
    const db = makeFakeDb({
      invoice: { id: 5n, status: 'PAID' },
      intent: {
        id: 10n, companyId: 200n, invoiceId: 5n,
        status: 'ACCEPTED', billingFiscalDocumentId: 'billing-doc-404', clave: null,
        integrationConfig: { billingCompanyId: 'bc2', billingEnvironment: 'SANDBOX', billingCredentialSecretRef: 'env:FAKE' },
      },
    });
    const billingClient = new FakeArtifactBillingClient({});  // No PDF → 404

    await assert.rejects(
      () => getFiscalArtifact(5n, 'pdf', 200n, { db, billingClient }),
      (err) => { assert.equal(err.statusCode, 404); assert.equal(err.code, 'FISCAL_ARTIFACT_NOT_FOUND'); return true; },
    );
  });

  test('Billing timeout → service returns 504 HTTP error', async () => {
    const db = makeFakeDb({
      invoice: { id: 5n, status: 'PAID' },
      intent: {
        id: 10n, companyId: 200n, invoiceId: 5n,
        status: 'ACCEPTED', billingFiscalDocumentId: 'billing-doc-timeout', clave: null,
        integrationConfig: { billingCompanyId: 'bc2', billingEnvironment: 'SANDBOX', billingCredentialSecretRef: 'env:FAKE' },
      },
    });
    const timeoutError = new BillingClientError('timeout', { code: 'BILLING_TIMEOUT', retryable: true });
    const billingClient = new FakeArtifactBillingClient({}, { throwOnGet: timeoutError });

    await assert.rejects(
      () => getFiscalArtifact(5n, 'pdf', 200n, { db, billingClient }),
      (err) => { assert.equal(err.statusCode, 504); assert.equal(err.code, 'BILLING_TIMEOUT'); return true; },
    );
  });

});

// ---------------------------------------------------------------------------
// SUITE 7: Read-only / no state mutation
// ---------------------------------------------------------------------------

describe('TASK-014 fiscal-artifact-proxy — read-only invariant', () => {

  test('successful artifact retrieval does NOT call DB update/mutation', async () => {
    const fakePdfBytes = Buffer.from('%PDF-1.4 readonly-test');
    const db = makeFakeDb({
      invoice: { id: 1n, status: 'PAID' },
      intent: {
        id: 1n, companyId: 10n, invoiceId: 1n,
        status: 'ACCEPTED', billingFiscalDocumentId: 'doc-ro', clave: '12345',
        integrationConfig: { billingCompanyId: 'bc', billingEnvironment: 'SANDBOX', billingCredentialSecretRef: 'env:F' },
      },
    });
    const billingClient = new FakeArtifactBillingClient({ PDF: { contentType: 'application/pdf', bytes: fakePdfBytes } });

    await getFiscalArtifact(1n, 'pdf', 10n, { db, billingClient });

    assert.equal(db._updateCalls.length, 0, 'No DB update/mutation should occur during artifact retrieval');
  });

  test('failed Billing request does NOT call DB update/mutation', async () => {
    const db = makeFakeDb({
      invoice: { id: 1n, status: 'PAID' },
      intent: {
        id: 1n, companyId: 10n, invoiceId: 1n,
        status: 'ACCEPTED', billingFiscalDocumentId: 'doc-fail', clave: null,
        integrationConfig: { billingCompanyId: 'bc', billingEnvironment: 'SANDBOX', billingCredentialSecretRef: 'env:F' },
      },
    });
    const billingClient = new FakeArtifactBillingClient({}, {
      throwOnGet: new BillingClientError('error', { code: 'BILLING_TIMEOUT', retryable: true }),
    });

    await assert.rejects(() => getFiscalArtifact(1n, 'pdf', 10n, { db, billingClient }));
    assert.equal(db._updateCalls.length, 0, 'No DB update on Billing failure');
  });

  test('artifact proxy service does not call createFiscalDocument or submitFiscalDocument', async () => {
    // Verify the billing client used by proxy never calls create/submit
    const fakePdfBytes = Buffer.from('%PDF-1.4 invariant-test');
    const db = makeFakeDb({
      invoice: { id: 1n, status: 'PAID' },
      intent: {
        id: 1n, companyId: 10n, invoiceId: 1n,
        status: 'ACCEPTED', billingFiscalDocumentId: 'doc-inv', clave: null,
        integrationConfig: { billingCompanyId: 'bc', billingEnvironment: 'SANDBOX', billingCredentialSecretRef: 'env:F' },
      },
    });

    let createCalled = false;
    let submitCalled = false;
    const trackingClient = {
      async getArtifact() { return { contentType: 'application/pdf', bytes: fakePdfBytes }; },
      async createFiscalDocument() { createCalled = true; return {}; },
      async submitFiscalDocument() { submitCalled = true; return {}; },
    };

    await getFiscalArtifact(1n, 'pdf', 10n, { db, billingClient: trackingClient });

    assert.equal(createCalled, false, 'createFiscalDocument must never be called from artifact proxy');
    assert.equal(submitCalled, false, 'submitFiscalDocument must never be called from artifact proxy');
  });

});

// ---------------------------------------------------------------------------
// SUITE 8: Secret non-exposure
// ---------------------------------------------------------------------------

describe('TASK-014 fiscal-artifact-proxy — secret non-exposure', () => {

  test('sentinel API key is not present in proxy result bytes', async () => {
    const sentinelKey = 'sentinel-artifact-key-must-not-appear-in-result';
    process.env.ARTIFACT_TEST_SENTINEL = sentinelKey;

    const fakePdfBytes = Buffer.from('%PDF-1.4 sentinel-test-content');
    const db = makeFakeDb({
      invoice: { id: 1n, status: 'PAID' },
      intent: {
        id: 1n, companyId: 10n, invoiceId: 1n,
        status: 'ACCEPTED', billingFiscalDocumentId: 'doc-sentinel', clave: null,
        integrationConfig: { billingCompanyId: 'bc', billingEnvironment: 'SANDBOX', billingCredentialSecretRef: 'env:ARTIFACT_TEST_SENTINEL' },
      },
    });

    let capturedSecretRef = null;
    const sentinelClient = {
      async getArtifact({ secretReference }) {
        capturedSecretRef = secretReference;
        return { contentType: 'application/pdf', bytes: fakePdfBytes };
      },
    };

    const result = await getFiscalArtifact(1n, 'pdf', 10n, { db, billingClient: sentinelClient });

    // Secret reference is passed through to billing client (correct — client resolves it)
    assert.equal(capturedSecretRef, 'env:ARTIFACT_TEST_SENTINEL');
    // Raw sentinel key must NOT appear in returned bytes
    assert.ok(!result.bytes.toString('utf8').includes(sentinelKey), 'Sentinel key must not be in proxied bytes');
    // Sentinel key must NOT appear in Content-Disposition
    assert.ok(!result.contentDisposition.includes(sentinelKey));
    // Sentinel key must NOT appear in contentType
    assert.ok(!result.contentType.includes(sentinelKey));

    delete process.env.ARTIFACT_TEST_SENTINEL;
  });

  test('error response from failed artifact retrieval does not expose API key', async () => {
    const sentinelKey = 'sentinel-error-key-must-not-leak';
    const db = makeFakeDb({
      invoice: { id: 1n, status: 'PAID' },
      intent: {
        id: 1n, companyId: 10n, invoiceId: 1n,
        status: 'ACCEPTED', billingFiscalDocumentId: 'doc-err', clave: null,
        integrationConfig: { billingCompanyId: 'bc', billingEnvironment: 'SANDBOX', billingCredentialSecretRef: 'env:F' },
      },
    });
    const failingClient = {
      async getArtifact() {
        throw new BillingClientError(`Internal error involving ${sentinelKey}`, { code: 'BILLING_HTTP_ERROR', statusCode: 500 });
      },
    };

    let caughtError = null;
    try {
      await getFiscalArtifact(1n, 'pdf', 10n, { db, billingClient: failingClient });
    } catch (err) {
      caughtError = err;
    }

    assert.ok(caughtError, 'Should have thrown');
    // Mapped error message must not contain the sentinel key
    assert.ok(!String(caughtError.message || '').includes(sentinelKey),
      'Mapped error message must not contain sentinel key');
  });

  test('no direct Hacienda fiscal endpoints in TASK-014 service files', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const serviceFiles = [
      path.join(__dirname, '..', 'src', 'services', 'fiscal-artifact-proxy.service.js'),
      path.join(__dirname, '..', 'src', 'services', 'billing-api-client.service.js'),
    ];
    const haciendaFiscalPatterns = [
      'api.comprobantes.go.cr',
      '/fe/ae',
      'api.hacienda.go.cr/fe/',
      'mh.hacienda',
      'etax.hacienda',
    ];
    for (const file of serviceFiles) {
      const content = fs.readFileSync(file, 'utf8');
      for (const pattern of haciendaFiscalPatterns) {
        assert.ok(!content.includes(pattern),
          `${path.basename(file)} must not contain Hacienda endpoint: ${pattern}`);
      }
    }
  });

});
