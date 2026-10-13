'use strict';

/**
 * TASK-013 — Billing fiscal status projection and reconciliation.
 * TASK-013b (FIX-RECONCILER-STATUS-VOCAB) — Billing submission status vocabulary
 *   update: added the 7 official Billing fiscal-submission-state-machine statuses
 *   that were missing from BILLING_PROCESSING_STATUSES.
 *
 * Reconciles Inventori's local InvoiceFiscalIntent projection with Billing's
 * authoritative fiscal state by reading Billing's official fiscal submission
 * contract for PROCESSING intents.
 *
 * CRITICAL INVARIANTS:
 * - Billing HTTP transport status (202/200/201) NEVER implies ACCEPTED.
 *   Only Billing's explicit fiscalStatus=ACCEPTED indicates Hacienda acceptance.
 * - Status-query failures keep the intent in PROCESSING and schedule retry.
 *   They do NOT move to ERROR_RETRYABLE (which would trigger the TASK-012
 *   create-worker to re-issue a new fiscal document).
 * - Terminal states (ACCEPTED, REJECTED, ERROR_FINAL) are never overwritten.
 * - Known clave/consecutive identifiers are never silently replaced; any
 *   mismatch produces ERROR_FINAL (IDENTIFIER_CLAVE_CONFLICT /
 *   IDENTIFIER_CONSECUTIVE_CONFLICT).
 * - Invoice.status (commercial/payment) is never mutated here.
 */

const prisma = require('../lib/prisma');
const { BillingClientError } = require('./billing-api-client.service');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RECONCILIATION_ELIGIBLE_STATUSES = Object.freeze(['PROCESSING']);
const BILLING_RECONCILIATION_CONTRACT = Object.freeze({
  documentRead: 'GET /api/v1/fiscal-documents/{id}',
  submissionRead: 'GET /api/v1/companies/{companyId}/fiscal-documents/{environment}/invoices/{id}/submission',
});

/** Lock window: how long a reconciliation claim is held. Doubles as crash recovery
 *  window — if the process crashes after claiming, the lock expires and the intent
 *  becomes eligible again automatically via nextAttemptAt <= now. */
const RECONCILIATION_LOCK_MS = 10 * 60 * 1000; // 10 minutes

/** P0 fixed polling interval between successful PROCESSING polls. */
const RECONCILIATION_POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/** Backoff caps for query failures (network/5xx). */
const RECONCILIATION_FAILURE_RETRY_BASE_MS = 5 * 60 * 1000; // 5 min
const RECONCILIATION_FAILURE_RETRY_MAX_MS = 60 * 60 * 1000; // 1 hour

/** Maximum lengths for safe diagnostic strings persisted in metadata. */
const DIAG_SHORT_MAX = 100;
const DIAG_MEDIUM_MAX = 500;
const DIAG_LONG_MAX = 1000;

// ---------------------------------------------------------------------------
// Canonical Billing fiscal status values (all comparisons are upper-cased)
// ---------------------------------------------------------------------------

const BILLING_ACCEPTED_STATUSES = Object.freeze([
  'ACCEPTED',
  'HACIENDA_ACCEPTED',
  'ACEPTADO', // Hacienda Spanish canonical value
]);

const BILLING_REJECTED_STATUSES = Object.freeze([
  'REJECTED',
  'HACIENDA_REJECTED',
  'RECHAZADO', // Hacienda Spanish canonical value
]);

// TASK-013b (FIX-RECONCILER-STATUS-VOCAB): Seven official Billing fiscal submission
// statuses were previously missing from this list. All map to Inventori PROCESSING
// (non-terminal, in-flight). Source of truth: Billing fiscal-submission-state-machine.ts
// FISCAL_SUBMISSION_STATUSES.
//
// OPERATIONAL DEBT (TECH-DEBT-RECONCILE-MANUAL-REVIEW): MANUAL_REVIEW_REQUIRED is
// intentionally mapped to PROCESSING here. If Billing remains in that state
// indefinitely, Inventori will poll every RECONCILIATION_POLL_INTERVAL_MS with no
// ceiling. The existing operator recovery path (fiscal-intent-operator-recovery.service.js)
// only targets ERROR_FINAL intents, so PROCESSING intents cannot be manually escalated
// through that path. Track escalation separately as TECH-DEBT-RECONCILE-MANUAL-REVIEW.
const BILLING_PROCESSING_STATUSES = Object.freeze([
  // Official Billing fiscal-submission-state-machine non-terminal statuses
  // (fiscal-submission-state-machine.ts — FISCAL_SUBMISSION_STATUSES)
  'REQUESTED',              // Document registered; not yet in submission queue
  'QUEUED',                 // In Billing's Hacienda queue; signed.xml ready; Hacienda not yet called
  'SUBMITTING',             // Billing actively POSTing to Hacienda /recepcion
  'POST_OUTCOME_UNKNOWN',   // Hacienda 5xx received; Billing reconciling via Hacienda status poll
  'ACKNOWLEDGED',           // Hacienda HTTP 201 receipt; fiscal validation pending
  'PROCESSING',             // Hacienda processing confirmed via Hacienda status poll
  'TECHNICAL_RETRY_PENDING', // Billing internal technical retry; will re-enter QUEUED autonomously
  'MANUAL_REVIEW_REQUIRED',  // Billing awaiting operator action before retrying (see debt note above)
  // Legacy / anticipated aliases — retained for forward compatibility
  'PENDING',
  'SUBMITTED',
  'RECEIVED',
  'CREATED',
  'IN_PROCESS',
  'EN_PROCESO',
]);

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function getNow(options = {}) {
  return options.now instanceof Date ? options.now : new Date();
}

function normalizeJsonObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function mergeIntentMetadata(intent, patch) {
  return { ...normalizeJsonObject(intent?.metadata), ...patch };
}

function safeString(value, maxLength) {
  if (value == null) return null;
  const str = String(value);
  return str.length > maxLength ? `${str.slice(0, maxLength)}[truncated]` : str;
}

function computeFailureBackoffMs(reconciliationAttemptCount) {
  const count = Math.max(0, Number(reconciliationAttemptCount || 0));
  const multiplier = Math.min(Math.pow(2, count), RECONCILIATION_FAILURE_RETRY_MAX_MS / RECONCILIATION_FAILURE_RETRY_BASE_MS);
  return Math.min(RECONCILIATION_FAILURE_RETRY_BASE_MS * multiplier, RECONCILIATION_FAILURE_RETRY_MAX_MS);
}

function getReconciliationAttemptCount(intent) {
  return Number(normalizeJsonObject(intent?.metadata).reconciliationAttemptCount || 0);
}

// ---------------------------------------------------------------------------
// Status resolution — CRITICAL: HTTP transport != fiscal acceptance
// ---------------------------------------------------------------------------

/**
 * Resolves Billing's canonical fiscal status from a status-query response.
 *
 * Priority: fiscalStatus > haciendaStatus > status
 *
 * IMPORTANT: The caller must supply the response body fields from Billing,
 * NOT transport-level HTTP status codes. HTTP 202 "accepted for processing"
 * is a transport acknowledgement, NOT Hacienda fiscal acceptance.
 *
 * @param {object | null} response - Billing status response body
 * @returns {'ACCEPTED' | 'REJECTED' | 'PROCESSING' | null}
 *   null means unknown — caller must fail closed (keep PROCESSING)
 */
function resolveCanonicalFiscalStatus(response) {
  if (!response || typeof response !== 'object') return null;
  const candidates = [
    response.fiscalStatus,
    response.haciendaStatus,
    response.status,
  ].filter(Boolean).map((s) => String(s).toUpperCase());

  for (const s of candidates) {
    if (BILLING_ACCEPTED_STATUSES.includes(s)) return 'ACCEPTED';
    if (BILLING_REJECTED_STATUSES.includes(s)) return 'REJECTED';
    if (BILLING_PROCESSING_STATUSES.includes(s)) return 'PROCESSING';
  }
  return null; // unknown → fail closed
}

/**
 * Maps a Billing getFiscalStatus response to an Inventori reconciliation result.
 *
 * Returns intentStatus=null for unknown status (caller should keep PROCESSING).
 *
 * HTTP 202 transport status alone CANNOT produce intentStatus=ACCEPTED.
 * Only response.fiscalStatus (or haciendaStatus/status fallback) === 'ACCEPTED'
 * (or known synonym) produces ACCEPTED.
 */
function classifyBillingReconciliationResult(response) {
  if (!response || typeof response !== 'object') {
    return {
      intentStatus: null,
      code: 'BILLING_MALFORMED_RESPONSE',
      message: 'Billing returned an unexpected or empty status response',
      diagnostics: null,
    };
  }

  const canonicalStatus = resolveCanonicalFiscalStatus(response);

  switch (canonicalStatus) {
    case 'ACCEPTED':
      return { intentStatus: 'ACCEPTED', code: 'BILLING_ACCEPTED', message: null, diagnostics: null };

    case 'REJECTED': {
      const diagnostics = sanitizeRejectionDiagnostics(response);
      return {
        intentStatus: 'REJECTED',
        code: 'BILLING_REJECTED',
        message: safeString(response.rejectionMessage || response.haciendaMensaje || 'Rejected by fiscal authority', DIAG_MEDIUM_MAX),
        diagnostics,
      };
    }

    case 'PROCESSING':
      return { intentStatus: 'PROCESSING', code: null, message: null, diagnostics: null };

    default:
      // Unknown Billing status: fail closed — keep PROCESSING, schedule retry
      return {
        intentStatus: null,
        code: 'BILLING_UNKNOWN_STATUS',
        message: safeString('Billing returned an unrecognised fiscal status; will retry', DIAG_MEDIUM_MAX),
        diagnostics: null,
      };
  }
}

/**
 * Builds safe, length-limited rejection diagnostics for persistence in metadata.
 * Excludes any fields that could contain API keys, secrets, certificates or PINs.
 */
function sanitizeRejectionDiagnostics(response) {
  if (!response) return null;
  return {
    rejectionCode: safeString(response.rejectionCode, DIAG_SHORT_MAX),
    rejectionMessage: safeString(response.rejectionMessage, DIAG_MEDIUM_MAX),
    haciendaMensaje: safeString(response.haciendaMensaje, DIAG_MEDIUM_MAX),
    haciendaDetalleMensaje: safeString(response.haciendaDetalleMensaje, DIAG_LONG_MAX),
    resolvedFiscalStatus: resolveCanonicalFiscalStatus(response),
  };
}

// ---------------------------------------------------------------------------
// Query failure classification
// ---------------------------------------------------------------------------

/**
 * Classifies a status-query failure.
 *
 * KEY DESIGN: Most failures keep the intent in PROCESSING and schedule a
 * backoff retry. They do NOT move to ERROR_RETRYABLE — that would cause the
 * TASK-012 create-worker to attempt re-creating the fiscal document.
 *
 * 401/403 (auth/permissions config broken) and 404 (referenced Billing
 * fiscal document missing) escalate to ERROR_FINAL because they require
 * explicit operator investigation. The reconciler must never create a
 * replacement fiscal identity automatically.
 */
function classifyReconciliationQueryFailure(error, reconciliationAttemptCount = 0) {
  if (!(error instanceof BillingClientError)) {
    return {
      isFinal: false,
      nextAttemptDelayMs: computeFailureBackoffMs(reconciliationAttemptCount),
      code: 'RECONCILIATION_QUERY_UNEXPECTED_ERROR',
      message: safeString(error?.message || 'Unexpected reconciliation error', DIAG_MEDIUM_MAX),
    };
  }

  const statusCode = Number(error.statusCode);

  // Auth/config errors: operator intervention required → ERROR_FINAL
  if (statusCode === 401) {
    return {
      isFinal: true,
      nextAttemptDelayMs: null,
      code: 'RECONCILIATION_AUTH_FAILURE',
      message: safeString(error.message, DIAG_MEDIUM_MAX),
    };
  }
  if (statusCode === 403) {
    return {
      isFinal: true,
      nextAttemptDelayMs: null,
      code: 'RECONCILIATION_PERMISSIONS_FAILURE',
      message: safeString(error.message, DIAG_MEDIUM_MAX),
    };
  }
  if (statusCode === 404) {
    return {
      isFinal: true,
      nextAttemptDelayMs: null,
      code: 'RECONCILIATION_DOCUMENT_NOT_FOUND',
      message: safeString(error.message, DIAG_MEDIUM_MAX),
    };
  }

  // All other failures: keep PROCESSING, schedule backoff retry
  return {
    isFinal: false,
    nextAttemptDelayMs: computeFailureBackoffMs(reconciliationAttemptCount),
    code: error.code || 'RECONCILIATION_QUERY_FAILED',
    message: safeString(error.message, DIAG_MEDIUM_MAX),
  };
}

// ---------------------------------------------------------------------------
// Identifier conflict protection
// ---------------------------------------------------------------------------

/**
 * Checks whether a Billing status response contains identifiers that conflict
 * with already-persisted values. An already-persisted clave or consecutive must
 * never be silently replaced with a different incoming value.
 *
 * @returns {{ code: string, message: string } | null} null if no conflict
 */
function checkIdentifierConflicts(intent, response) {
  if (!response || !intent) return null;
  const incomingClave = response.clave || null;
  const incomingConsecutive = response.consecutive || null;

  if (intent.clave && incomingClave && intent.clave !== incomingClave) {
    return {
      code: 'IDENTIFIER_CLAVE_CONFLICT',
      message: safeString(
        `Billing returned clave "${incomingClave}" which differs from the already-persisted clave. The existing value will not be overwritten.`,
        DIAG_MEDIUM_MAX,
      ),
    };
  }
  if (intent.consecutive && incomingConsecutive && intent.consecutive !== incomingConsecutive) {
    return {
      code: 'IDENTIFIER_CONSECUTIVE_CONFLICT',
      message: safeString(
        `Billing returned consecutive "${incomingConsecutive}" which differs from the already-persisted consecutive. The existing value will not be overwritten.`,
        DIAG_MEDIUM_MAX,
      ),
    };
  }
  return null;
}

function extractBillingDocumentId(response) {
  return response?.billingFiscalDocumentId || response?.documentId || response?.id || null;
}

function checkBillingChainConsistency(intent, response, integrationConfig) {
  if (!response || !intent) return null;

  const incomingDocumentId = extractBillingDocumentId(response);
  if (incomingDocumentId && intent.billingFiscalDocumentId && incomingDocumentId !== intent.billingFiscalDocumentId) {
    return {
      code: 'BILLING_DOCUMENT_ID_MISMATCH',
      message: safeString('Billing returned a fiscal document id that does not match the existing Inventori fiscal chain', DIAG_MEDIUM_MAX),
    };
  }

  const incomingCompanyId = response.companyId || response.billingCompanyId || null;
  if (incomingCompanyId && integrationConfig?.billingCompanyId && incomingCompanyId !== integrationConfig.billingCompanyId) {
    return {
      code: 'BILLING_COMPANY_MISMATCH',
      message: safeString('Billing returned a fiscal document for a different mapped Billing company', DIAG_MEDIUM_MAX),
    };
  }

  const incomingEnvironment = response.environment || null;
  if (incomingEnvironment && integrationConfig?.billingEnvironment
    && String(incomingEnvironment).toUpperCase() !== String(integrationConfig.billingEnvironment).toUpperCase()) {
    return {
      code: 'BILLING_ENVIRONMENT_MISMATCH',
      message: safeString('Billing returned a fiscal document for a different environment', DIAG_MEDIUM_MAX),
    };
  }

  const incomingIdempotencyKey = response.idempotencyKey || null;
  if (incomingIdempotencyKey && intent.idempotencyKey && incomingIdempotencyKey !== intent.idempotencyKey) {
    return {
      code: 'BILLING_IDEMPOTENCY_KEY_MISMATCH',
      message: safeString('Billing returned a fiscal document with a different idempotency key', DIAG_MEDIUM_MAX),
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Structured logging — never logs API keys or raw secrets
// ---------------------------------------------------------------------------

function logReconciliationEvent(level, event) {
  const payload = {
    level,
    component: 'fiscal-reconciliation',
    fiscalIntentId: event.fiscalIntentId == null ? null : String(event.fiscalIntentId),
    invoiceId: event.invoiceId == null ? null : String(event.invoiceId),
    companyId: event.companyId == null ? null : String(event.companyId),
    billingFiscalDocumentId: event.billingFiscalDocumentId || null,
    correlationId: event.correlationId || null,
    previousStatus: event.previousStatus || null,
    resultingStatus: event.resultingStatus || null,
    code: event.code || null,
  };
  const logFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;
  logFn(JSON.stringify(payload));
}

// ---------------------------------------------------------------------------
// Eligibility and atomic reconciliation claim
// ---------------------------------------------------------------------------

async function findNextEligibleReconciliationIntent(db, companyId, now) {
  return /** @type {any} */ (db).invoiceFiscalIntent.findFirst({
    where: {
      ...(companyId == null ? {} : { companyId }),
      status: { in: RECONCILIATION_ELIGIBLE_STATUSES },
      billingFiscalDocumentId: { not: null },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true },
  });
}

async function loadReconciliationIntent(intentId, db = prisma) {
  return /** @type {any} */ (db).invoiceFiscalIntent.findUnique({
    where: { id: intentId },
    include: { integrationConfig: true },
  });
}

/**
 * Atomically claims a reconciliation slot for a PROCESSING intent.
 *
 * Uses nextAttemptAt as an atomic compare-and-set lock:
 * - Eligibility condition: status=PROCESSING + billingFiscalDocumentId!=null
 *   + (nextAttemptAt IS NULL OR nextAttemptAt <= now)
 * - Claim writes: nextAttemptAt = now + RECONCILIATION_LOCK_MS
 * - Prisma updateMany returns count=0 if another worker already claimed the slot
 *
 * CRASH SAFETY: If the process crashes after claim but before persistence,
 * nextAttemptAt expires naturally (after RECONCILIATION_LOCK_MS), making
 * the intent eligible again — no special stale recovery is needed.
 *
 * @returns {Promise<object | null>} loaded intent or null if not claimed
 */
async function claimReconciliationSlot(intentId, options = {}) {
  const db = options.db || prisma;
  const now = getNow(options);
  const correlationId = options.correlationId || `inventori-reconcile-${intentId.toString()}-${now.getTime()}`;

  const current = await /** @type {any} */ (db).invoiceFiscalIntent.findUnique({
    where: { id: intentId },
    select: {
      id: true,
      status: true,
      billingFiscalDocumentId: true,
      metadata: true,
      nextAttemptAt: true,
    },
  });
  if (!current) return null;
  if (!RECONCILIATION_ELIGIBLE_STATUSES.includes(current.status)) return null;
  if (!current.billingFiscalDocumentId) return null;

  const lockUntil = new Date(now.getTime() + RECONCILIATION_LOCK_MS);
  const reconciliationAttemptCount = getReconciliationAttemptCount(current) + 1;

  const updated = await /** @type {any} */ (db).invoiceFiscalIntent.updateMany({
    where: {
      id: intentId,
      status: { in: RECONCILIATION_ELIGIBLE_STATUSES },
      billingFiscalDocumentId: { not: null },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
    data: {
      lastAttemptAt: now,
      nextAttemptAt: lockUntil,
      metadata: mergeIntentMetadata(current, {
        reconcileCorrelationId: correlationId,
        reconcileClaimedAt: now.toISOString(),
        reconciliationAttemptCount,
      }),
    },
  });

  if (updated.count !== 1) return null;
  return loadReconciliationIntent(intentId, db);
}

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

async function persistReconciliationTerminal(intent, result, statusResponse, options = {}) {
  const db = options.db || prisma;
  const now = getNow(options);
  const { intentStatus, diagnostics } = result;
  const correlationId = normalizeJsonObject(intent.metadata).reconcileCorrelationId;
  const reconciliationAttemptCount = getReconciliationAttemptCount(intent);

  const incomingClave = statusResponse?.clave || null;
  const incomingConsecutive = statusResponse?.consecutive || null;
  const billingStatusValue = statusResponse?.fiscalStatus || statusResponse?.haciendaStatus || statusResponse?.status || null;
  const acceptedAt = statusResponse?.acceptedAt || null;
  const rejectedAt = statusResponse?.rejectedAt || null;

  const updateData = {
    status: intentStatus,
    billingStatus: billingStatusValue ? String(billingStatusValue).toUpperCase() : intent.billingStatus,
    nextAttemptAt: null, // terminal — no more reconciliation
    lastSyncAt: now,
    ...(intentStatus === 'REJECTED'
      ? { failureCode: diagnostics?.rejectionCode || 'BILLING_REJECTED', failureMessage: result.message }
      : { failureCode: null, failureMessage: null }),
    metadata: mergeIntentMetadata(intent, {
      lastReconciliationCode: result.code,
      lastReconciliationAt: now.toISOString(),
      lastReconcileCorrelationId: correlationId,
      reconciliationAttemptCount,
      lastQueryFailureCode: null,
      lastQueryFailureMessage: null,
      ...(billingStatusValue ? { lastBillingStatus: String(billingStatusValue).toUpperCase() } : {}),
      ...(statusResponse?.id ? { billingDocumentIdConfirmed: String(statusResponse.id) } : {}),
      ...(statusResponse?.submissionId ? { billingSubmissionIdConfirmed: String(statusResponse.submissionId) } : {}),
      ...(statusResponse?.haciendaStatus ? { haciendaStatus: safeString(statusResponse.haciendaStatus, DIAG_SHORT_MAX) } : {}),
      ...(statusResponse?.responseSha256 ? { haciendaResponseSha256: safeString(statusResponse.responseSha256, DIAG_SHORT_MAX) } : {}),
      ...(statusResponse?.responseContentType ? { haciendaResponseContentType: safeString(statusResponse.responseContentType, DIAG_SHORT_MAX) } : {}),
      ...(acceptedAt ? { billingAcceptedAt: acceptedAt } : {}),
      ...(rejectedAt ? { billingRejectedAt: rejectedAt } : {}),
      ...(diagnostics ? { rejectionDiagnostics: diagnostics } : {}),
    }),
  };

  // Persist identifiers only when not already set (conflicts already caught before this call)
  if (incomingClave && !intent.clave) /** @type {any} */ (updateData).clave = incomingClave;
  if (incomingConsecutive && !intent.consecutive) /** @type {any} */ (updateData).consecutive = incomingConsecutive;

  await /** @type {any} */ (db).invoiceFiscalIntent.update({ where: { id: intent.id }, data: updateData });

  logReconciliationEvent(intentStatus === 'REJECTED' ? 'warn' : 'info', {
    fiscalIntentId: intent.id,
    invoiceId: intent.invoiceId,
    companyId: intent.companyId,
    billingFiscalDocumentId: intent.billingFiscalDocumentId,
    correlationId,
    previousStatus: 'PROCESSING',
    resultingStatus: intentStatus,
    code: result.code,
  });

  return { processed: true, status: intentStatus, diagnostics };
}

async function persistReconciliationProcessingRetry(intent, nextAttemptAt, failureCode, failureMessage, options = {}) {
  const db = options.db || prisma;
  const now = getNow(options);
  const correlationId = normalizeJsonObject(intent.metadata).reconcileCorrelationId;
  const reconciliationAttemptCount = getReconciliationAttemptCount(intent);

  await /** @type {any} */ (db).invoiceFiscalIntent.update({
    where: { id: intent.id },
    data: {
      // status remains PROCESSING — do not change
      nextAttemptAt,
      lastSyncAt: now,
      metadata: mergeIntentMetadata(intent, {
        lastReconciliationCode: failureCode || 'STILL_PROCESSING',
        lastReconciliationAt: now.toISOString(),
        lastReconcileCorrelationId: correlationId,
        reconciliationAttemptCount,
        ...(failureCode ? { lastQueryFailureCode: failureCode, lastQueryFailureMessage: failureMessage } : {}),
      }),
    },
  });

  const level = failureCode && failureCode !== 'STILL_PROCESSING' ? 'warn' : 'info';
  logReconciliationEvent(level, {
    fiscalIntentId: intent.id,
    invoiceId: intent.invoiceId,
    companyId: intent.companyId,
    billingFiscalDocumentId: intent.billingFiscalDocumentId,
    correlationId,
    previousStatus: 'PROCESSING',
    resultingStatus: 'PROCESSING',
    code: failureCode || 'STILL_PROCESSING',
  });

  return { processed: true, status: 'PROCESSING', nextAttemptAt };
}

async function persistReconciliationFinalError(intent, code, message, options = {}) {
  const db = options.db || prisma;
  const now = getNow(options);
  const correlationId = normalizeJsonObject(intent.metadata).reconcileCorrelationId;
  const reconciliationAttemptCount = getReconciliationAttemptCount(intent);

  await /** @type {any} */ (db).invoiceFiscalIntent.update({
    where: { id: intent.id },
    data: {
      status: 'ERROR_FINAL',
      failureCode: code,
      failureMessage: message,
      nextAttemptAt: null,
      lastSyncAt: now,
      metadata: mergeIntentMetadata(intent, {
        lastReconciliationCode: code,
        lastReconciliationAt: now.toISOString(),
        lastReconcileCorrelationId: correlationId,
        reconciliationAttemptCount,
      }),
    },
  });

  logReconciliationEvent('error', {
    fiscalIntentId: intent.id,
    invoiceId: intent.invoiceId,
    companyId: intent.companyId,
    billingFiscalDocumentId: intent.billingFiscalDocumentId,
    correlationId,
    previousStatus: 'PROCESSING',
    resultingStatus: 'ERROR_FINAL',
    code,
  });

  return { processed: true, status: 'ERROR_FINAL', code };
}

// ---------------------------------------------------------------------------
// Core reconciliation logic
// ---------------------------------------------------------------------------

/**
 * Reconciles a single PROCESSING fiscal intent that has already been claimed.
 *
 * Calls Billing getFiscalStatus, classifies the response, checks for identifier
 * conflicts, and persists the result. Does NOT mutate Invoice.status.
 */
async function reconcileClaimedIntent(intent, billingClient, options = {}) {
  const db = options.db || prisma;
  const now = getNow(options);
  const integrationConfig = intent.integrationConfig;

  if (!integrationConfig?.enabled) {
    return persistReconciliationFinalError(
      intent,
      'BILLING_CONFIG_DISABLED',
      'Billing integration config is disabled or missing',
      { ...options, db, now },
    );
  }

  // Test escape hatch: simulate crash between claim and status query
  if (options.crashBeforeStatusQuery) {
    throw Object.assign(
      new Error('Simulated crash before status query'),
      { code: 'SIMULATED_CRASH_BEFORE_STATUS_QUERY' },
    );
  }

  const correlationId = normalizeJsonObject(intent.metadata).reconcileCorrelationId;
  const reconciliationAttemptCount = getReconciliationAttemptCount(intent);

  let statusResponse;
  try {
    statusResponse = await billingClient.getFiscalStatus({
      billingCompanyId: integrationConfig.billingCompanyId,
      environment: integrationConfig.billingEnvironment,
      billingFiscalDocumentId: intent.billingFiscalDocumentId,
      secretReference: integrationConfig.billingCredentialSecretRef,
      correlationId,
    });
  } catch (error) {
    const failure = classifyReconciliationQueryFailure(error, reconciliationAttemptCount);
    if (failure.isFinal) {
      return persistReconciliationFinalError(intent, failure.code, failure.message, { ...options, db, now });
    }
    const nextAttemptAt = new Date(now.getTime() + failure.nextAttemptDelayMs);
    return persistReconciliationProcessingRetry(intent, nextAttemptAt, failure.code, failure.message, { ...options, db, now });
  }

  // Test escape hatch: simulate crash after status response but before persistence
  if (options.crashAfterStatusResponseBeforePersist) {
    throw Object.assign(
      new Error('Simulated crash after status response before persistence'),
      { code: 'SIMULATED_CRASH_AFTER_STATUS_RESPONSE_BEFORE_PERSIST' },
    );
  }

  // Check for chain/identifier conflicts before persisting any update
  const chainConflict = checkBillingChainConsistency(intent, statusResponse, integrationConfig);
  if (chainConflict) {
    return persistReconciliationFinalError(intent, chainConflict.code, chainConflict.message, { ...options, db, now });
  }

  const conflict = checkIdentifierConflicts(intent, statusResponse);
  if (conflict) {
    return persistReconciliationFinalError(intent, conflict.code, conflict.message, { ...options, db, now });
  }

  const reconciliationResult = classifyBillingReconciliationResult(statusResponse);

  if (reconciliationResult.intentStatus === 'ACCEPTED' || reconciliationResult.intentStatus === 'REJECTED') {
    return persistReconciliationTerminal(intent, reconciliationResult, statusResponse, { ...options, db, now });
  }

  // PROCESSING or unknown → keep PROCESSING, schedule next poll
  const nextAttemptAt = new Date(now.getTime() + RECONCILIATION_POLL_INTERVAL_MS);
  return persistReconciliationProcessingRetry(
    intent,
    nextAttemptAt,
    reconciliationResult.code || null,
    reconciliationResult.message || null,
    { ...options, db, now },
  );
}

// ---------------------------------------------------------------------------
// Public entry points
// ---------------------------------------------------------------------------

/**
 * Reconciles a specific PROCESSING fiscal intent by ID.
 * Returns { processed: false, reason: 'NOT_CLAIMED' } if the slot could not
 * be claimed (e.g., another worker holds the lock, intent not in PROCESSING,
 * or no billingFiscalDocumentId is set).
 */
async function reconcileFiscalIntentById(intentId, billingClient, options = {}) {
  const db = options.db || prisma;
  const claimed = await claimReconciliationSlot(intentId, { ...options, db });
  if (!claimed) return { processed: false, reason: 'NOT_CLAIMED' };
  return reconcileClaimedIntent(claimed, billingClient, { ...options, db });
}

/**
 * Finds and reconciles the next eligible PROCESSING fiscal intent.
 * Returns { processed: false, reason: 'NO_ELIGIBLE_RECONCILIATION_INTENT' }
 * when the queue is empty or all intents are within their lock windows.
 */
async function reconcileNextFiscalIntent(billingClient, options = {}) {
  const db = options.db || prisma;
  const now = getNow(options);
  const next = await findNextEligibleReconciliationIntent(db, options.companyId, now);
  if (!next) return { processed: false, reason: 'NO_ELIGIBLE_RECONCILIATION_INTENT' };
  return reconcileFiscalIntentById(next.id, billingClient, { ...options, db, now });
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  // Constants
  RECONCILIATION_ELIGIBLE_STATUSES,
  BILLING_ACCEPTED_STATUSES,
  BILLING_REJECTED_STATUSES,
  BILLING_PROCESSING_STATUSES,
  RECONCILIATION_LOCK_MS,
  RECONCILIATION_POLL_INTERVAL_MS,
  BILLING_RECONCILIATION_CONTRACT,
  // Status resolution
  resolveCanonicalFiscalStatus,
  classifyBillingReconciliationResult,
  sanitizeRejectionDiagnostics,
  // Failure classification
  classifyReconciliationQueryFailure,
  // Identifier conflict
  checkIdentifierConflicts,
  checkBillingChainConsistency,
  extractBillingDocumentId,
  // Claim
  claimReconciliationSlot,
  // Core
  reconcileClaimedIntent,
  reconcileFiscalIntentById,
  reconcileNextFiscalIntent,
};
