'use strict';

/**
 * FakeBillingServer — deterministic in-memory Billing implementation for TASK-015.
 *
 * Emulates the full Billing fiscal workflow coherently:
 *   createFiscalDocument → submitFiscalDocument → getFiscalStatus → getArtifact
 *
 * A document created by CREATE is the SAME logical document later seen by:
 *   SUBMIT · STATUS · ARTIFACT retrieval
 *
 * Core idempotency invariant:
 *   same idempotencyKey → same Billing fiscal document
 *   repeated CREATE with same key → same document (no duplicate)
 *
 * SAFETY INVARIANTS:
 * - API keys/secrets are never stored, logged or returned. The server accepts
 *   `secretReference` parameters (which are reference strings like `env:FOO`),
 *   but the resolved key value is never accepted or stored here.
 * - No real Hacienda contacts. No real Billing contacts.
 * - All state is in-process memory; safe for test isolation.
 *
 * CONFIGURATION:
 *   new FakeBillingServer({
 *     statusAfterNPolls: 2,           // Return finalStatus after 2 STATUS polls
 *     finalStatus: 'ACCEPTED',        // 'ACCEPTED' | 'REJECTED' | 'PROCESSING'
 *     rejectionDiagnostics: {         // Only used when finalStatus='REJECTED'
 *       rejectionCode: '03',
 *       rejectionMessage: 'Rechazado por Hacienda: error en receptor',
 *       haciendaMensaje: 'Mensaje de Hacienda',
 *       haciendaDetalleMensaje: 'Detalle del error',
 *     },
 *     createError: null,              // BillingClientError to throw on CREATE
 *     submitError: null,              // BillingClientError to throw on SUBMIT
 *     statusError: null,              // BillingClientError to throw on STATUS
 *     artifactError: null,            // BillingClientError to throw on ARTIFACT
 *     artifactBytes: {
 *       PDF: Buffer.from('...'),
 *       SIGNED_XML: Buffer.from('...'),
 *       HACIENDA_RESPONSE_XML: Buffer.from('...'),
 *     },
 *   })
 */

const crypto = require('node:crypto');
const { BillingClientError } = require('../../src/services/billing-api-client.service');

/** Deterministic fake clave: 50 digits matching Costa Rica format */
function buildFakeClave(docId) {
  const hash = crypto.createHash('sha256').update(String(docId)).digest('hex');
  // Real clave: 50 digits. Build from hash, ensuring all digits.
  return hash.replace(/[^0-9]/g, '').padEnd(50, '1').slice(0, 50);
}

/** Deterministic fake consecutive: 20 digits */
function buildFakeConsecutive(docId) {
  const hash = crypto.createHash('sha256').update(`consecutive-${docId}`).digest('hex');
  return hash.replace(/[^0-9]/g, '').padEnd(20, '0').slice(0, 20);
}

class FakeBillingServer {
  constructor(options = {}) {
    this._documents = new Map();       // docId → document state
    this._idempotencyIndex = new Map(); // idempotencyKey → docId
    this._callLog = { create: [], submit: [], status: [], artifact: [] };

    this._opts = {
      statusAfterNPolls: options.statusAfterNPolls ?? 2,
      finalStatus: options.finalStatus ?? 'ACCEPTED',
      rejectionDiagnostics: options.rejectionDiagnostics ?? null,
      createError: options.createError ?? null,
      submitError: options.submitError ?? null,
      statusError: options.statusError ?? null,
      artifactError: options.artifactError ?? null,
      artifactBytes: {
        PDF: options.artifactBytes?.PDF ?? Buffer.from('%PDF-1.4 fake-fiscal-pdf-task015'),
        SIGNED_XML: options.artifactBytes?.SIGNED_XML ?? Buffer.from(
          '<?xml version="1.0" encoding="UTF-8"?>' +
          '<FacturaElectronica xmlns="https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/facturaElectronica">' +
          '<Clave>FAKECLAVE</Clave>' +
          '<Signature xmlns="http://www.w3.org/2000/09/xmldsig#"><SignatureValue>FAKESIG==</SignatureValue></Signature>' +
          '</FacturaElectronica>',
        ),
        HACIENDA_RESPONSE_XML: options.artifactBytes?.HACIENDA_RESPONSE_XML ?? Buffer.from(
          '<?xml version="1.0" encoding="UTF-8"?>' +
          '<MensajeReceptor>' +
          '<Clave>FAKECLAVE</Clave>' +
          '<NombreEmisor>FAKE EMISOR</NombreEmisor>' +
          '<Mensaje>1</Mensaje>' +
          '<DetalleMensaje>Aceptado</DetalleMensaje>' +
          '</MensajeReceptor>',
        ),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // CREATE
  // ---------------------------------------------------------------------------

  async createFiscalDocument({ billingCompanyId, environment, idempotencyKey, payload, secretReference: _secretReference }) {
    // SAFETY: _secretReference is accepted but never stored or logged
    this._callLog.create.push({ billingCompanyId, environment, idempotencyKey, calledAt: new Date().toISOString() });

    if (this._opts.createError) throw this._opts.createError;

    // Idempotent: same idempotencyKey → same document (never create duplicate)
    if (this._idempotencyIndex.has(idempotencyKey)) {
      const existingDocId = this._idempotencyIndex.get(idempotencyKey);
      const existingDoc = this._documents.get(existingDocId);
      // Return same structure as first create
      return { billingFiscalDocumentId: existingDoc.billingFiscalDocumentId };
    }

    const docId = `fake-bd-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const doc = {
      billingFiscalDocumentId: docId,
      idempotencyKey,
      billingCompanyId,
      environment,
      payload: payload ? JSON.parse(JSON.stringify(payload)) : null, // snapshot of payload at create time
      status: 'CREATED',
      clave: null,
      consecutive: null,
      pollCount: 0,
      submitted: false,
      createdAt: new Date().toISOString(),
    };

    this._documents.set(docId, doc);
    this._idempotencyIndex.set(idempotencyKey, docId);

    return { billingFiscalDocumentId: docId };
  }

  // ---------------------------------------------------------------------------
  // SUBMIT
  // ---------------------------------------------------------------------------

  async submitFiscalDocument({ billingCompanyId, environment, billingFiscalDocumentId, secretReference: _secretReference }) {
    // SAFETY: _secretReference is accepted but never stored or logged
    this._callLog.submit.push({ billingCompanyId, environment, billingFiscalDocumentId, calledAt: new Date().toISOString() });

    if (this._opts.submitError) throw this._opts.submitError;

    const doc = this._documents.get(billingFiscalDocumentId);
    if (!doc) {
      throw new BillingClientError('Billing document not found', {
        code: 'BILLING_HTTP_ERROR',
        statusCode: 404,
        retryable: false,
      });
    }

    // Set deterministic clave/consecutive on first submit
    if (!doc.clave) {
      doc.clave = buildFakeClave(billingFiscalDocumentId);
      doc.consecutive = buildFakeConsecutive(billingFiscalDocumentId);
    }

    doc.submitted = true;
    doc.status = 'PROCESSING';
    doc.submittedAt = new Date().toISOString();

    return {
      billingFiscalDocumentId,
      clave: doc.clave,
      consecutive: doc.consecutive,
      fiscalStatus: 'PROCESSING',
    };
  }

  // ---------------------------------------------------------------------------
  // STATUS POLL
  // ---------------------------------------------------------------------------

  async getFiscalStatus({ billingCompanyId, environment, billingFiscalDocumentId, secretReference: _secretReference }) {
    // SAFETY: _secretReference is accepted but never stored or logged
    this._callLog.status.push({ billingCompanyId, environment, billingFiscalDocumentId, calledAt: new Date().toISOString() });

    if (this._opts.statusError) throw this._opts.statusError;

    const doc = this._documents.get(billingFiscalDocumentId);
    if (!doc) {
      throw new BillingClientError('Billing document not found', {
        code: 'BILLING_HTTP_ERROR',
        statusCode: 404,
        retryable: false,
      });
    }

    doc.pollCount++;

    if (doc.pollCount >= this._opts.statusAfterNPolls && doc.status === 'PROCESSING') {
      doc.status = this._opts.finalStatus;
      if (this._opts.finalStatus === 'ACCEPTED') {
        doc.acceptedAt = new Date().toISOString();
      } else if (this._opts.finalStatus === 'REJECTED') {
        doc.rejectedAt = new Date().toISOString();
      }
    }

    const response = {
      billingFiscalDocumentId,
      fiscalStatus: doc.status,
      clave: doc.clave,
      consecutive: doc.consecutive,
    };

    if (doc.status === 'REJECTED' && this._opts.rejectionDiagnostics) {
      Object.assign(response, this._opts.rejectionDiagnostics, {
        rejectedAt: doc.rejectedAt || null,
      });
    }

    if (doc.status === 'ACCEPTED') {
      response.acceptedAt = doc.acceptedAt || null;
    }

    return response;
  }

  // ---------------------------------------------------------------------------
  // ARTIFACT
  // ---------------------------------------------------------------------------

  async getArtifact({ billingFiscalDocumentId, artifactType, secretReference: _secretReference }) {
    // SAFETY: _secretReference is accepted but never stored or logged
    this._callLog.artifact.push({ billingFiscalDocumentId, artifactType, calledAt: new Date().toISOString() });

    if (this._opts.artifactError) throw this._opts.artifactError;

    const doc = this._documents.get(billingFiscalDocumentId);
    if (!doc) {
      throw new BillingClientError('Billing document not found', {
        code: 'BILLING_HTTP_ERROR',
        statusCode: 404,
        retryable: false,
      });
    }

    const bytes = this._opts.artifactBytes[artifactType];
    if (!bytes) {
      throw new BillingClientError(`Artifact type '${artifactType}' not available`, {
        code: 'BILLING_HTTP_ERROR',
        statusCode: 404,
        retryable: false,
      });
    }

    const contentType = artifactType === 'PDF' ? 'application/pdf' : 'application/xml';
    return { contentType, bytes };
  }

  // ---------------------------------------------------------------------------
  // Statistics / introspection
  // ---------------------------------------------------------------------------

  /** Number of CREATE calls made (including idempotent repeats) */
  get createCallCount() { return this._callLog.create.length; }

  /** Number of SUBMIT calls made */
  get submitCallCount() { return this._callLog.submit.length; }

  /** Number of STATUS poll calls made */
  get statusCallCount() { return this._callLog.status.length; }

  /** Number of ARTIFACT calls made */
  get artifactCallCount() { return this._callLog.artifact.length; }

  /** Number of distinct logical Billing fiscal documents (unique idempotency keys) */
  get uniqueDocumentCount() { return this._documents.size; }

  /** Whether any CREATE was made with the given idempotency key */
  hasIdempotencyKey(key) { return this._idempotencyIndex.has(key); }

  /** Returns the document for a given billingFiscalDocumentId */
  getDocument(docId) { return this._documents.get(docId) ?? null; }

  /** Returns the document for a given idempotency key */
  getDocumentByIdempotencyKey(key) {
    const docId = this._idempotencyIndex.get(key);
    return docId ? this._documents.get(docId) : null;
  }

  /** Full call log for assertions */
  get callLog() { return this._callLog; }

  /**
   * Resets all state — use between tests that share a server instance.
   * Does NOT reset configuration options.
   */
  reset() {
    this._documents.clear();
    this._idempotencyIndex.clear();
    this._callLog = { create: [], submit: [], status: [], artifact: [] };
  }

  /**
   * Override the final status dynamically (after server is created).
   * Useful for testing "first poll = PROCESSING, later = ACCEPTED" patterns.
   */
  setFinalStatus(status, rejectionDiagnostics = null) {
    this._opts.finalStatus = status;
    this._opts.rejectionDiagnostics = rejectionDiagnostics;
  }

  /**
   * Manually set a document's status (useful for simulating state at specific
   * test boundaries without going through the full poll cycle).
   */
  setDocumentStatus(billingFiscalDocumentId, status) {
    const doc = this._documents.get(billingFiscalDocumentId);
    if (doc) doc.status = status;
  }
}

module.exports = { FakeBillingServer };
