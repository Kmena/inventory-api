'use strict';

const crypto = require('node:crypto');
const prisma = require('../lib/prisma');
const { BillingClientError } = require('./billing-api-client.service');

const ELIGIBLE_INTENT_STATUSES = Object.freeze(['PENDING', 'ERROR_RETRYABLE']);
const DEFAULT_PROCESSING_STALE_MS = 15 * 60 * 1000;
const DEFAULT_RETRY_DELAY_MS = 5 * 60 * 1000;

function getNow(options = {}) {
  return options.now instanceof Date ? options.now : new Date();
}

function normalizeJsonObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeJsonArray(value) {
  return Array.isArray(value) ? value : [];
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function hashBillingPayload(payload) {
  return crypto.createHash('sha256').update(stableStringify(payload)).digest('hex');
}

function formatDecimal(value, decimals = 5) {
  return Number(value || 0).toFixed(decimals);
}

function assertBillingRequestSnapshotIsValid(snapshot, payload) {
  if (!snapshot) {
    return { ok: false, code: 'FISCAL_SNAPSHOT_MISSING', message: 'Fiscal snapshot is missing' };
  }
  if (snapshot.currency !== 'CRC' || payload.currency !== 'CRC') {
    return { ok: false, code: 'UNSUPPORTED_CURRENCY', message: 'P0 Billing worker supports CRC only' };
  }
  if (payload.saleCondition === '02' && !payload.creditTermDays) {
    return { ok: false, code: 'CREDIT_TERM_MISSING', message: 'Credit invoice requires creditTermDays' };
  }
  if (!Array.isArray(payload.lines) || payload.lines.length === 0) {
    return { ok: false, code: 'FISCAL_LINES_MISSING', message: 'Fiscal snapshot has no lines' };
  }
  const invalidLine = payload.lines.find((line) => !line.cabysCode || !line.unitMeasure || Number(line.quantity) <= 0);
  if (invalidLine) {
    return { ok: false, code: 'FISCAL_LINE_INVALID', message: 'Fiscal snapshot contains an invalid fiscal line' };
  }
  return { ok: true };
}

function buildBillingFiscalDocumentPayload(snapshot) {
  const receiver = normalizeJsonObject(snapshot.receiverSnapshot);
  const header = normalizeJsonObject(snapshot.headerSnapshot);
  const lines = normalizeJsonArray(snapshot.linesSnapshot).map((line) => ({
    lineNumber: Number(line.lineNumber),
    cabysCode: line.cabysCode,
    description: line.description,
    unitMeasure: line.fiscalUnit,
    quantity: formatDecimal(line.quantity),
    unitPrice: formatDecimal(line.unitPrice),
    discountAmount: formatDecimal(line.totalDiscount || line.discountAmount || 0),
    ...(line.discountCode ? { discountCode: line.discountCode } : {}),
    ...(line.discountNature ? { discountNature: line.discountNature } : {}),
    ...(line.discountOther ? { discountOther: line.discountOther } : {}),
    taxCode: line.taxCode,
    taxRateCode: line.taxRateCode,
    taxRate: formatDecimal(line.taxRate),
    taxAmount: formatDecimal(line.taxAmount),
    // subtotal and total are computed by Billing — not accepted in the CREATE payload
  }));

  const payload = {
    receiver: {
      sourceType: receiver.sourceType,
      sourceId: receiver.sourceId == null ? null : String(receiver.sourceId),
      name: receiver.legalName,
      commercialName: receiver.commercialName || null,
      identificationType: receiver.identificationType,
      identificationNumber: receiver.identificationNumber,
      email: receiver.email || null,
      phone: receiver.phone || null,
      province: receiver.province || null,
      canton: receiver.canton || null,
      district: receiver.district || null,
      address: receiver.address || null,
      economicActivity: receiver.economicActivityCode || null,
    },
    currency: snapshot.currency,
    exchangeRate: header.exchangeRate || '1.00000',
    saleCondition: snapshot.saleCondition,
    ...(snapshot.paymentMethod ? { paymentMethod: snapshot.paymentMethod } : {}),
    ...(snapshot.creditTermDays ? { creditTermDays: snapshot.creditTermDays } : {}),
    lines,
    // totals is computed by Billing — not accepted in the CREATE payload
  };

  const validation = assertBillingRequestSnapshotIsValid(snapshot, payload);
  if (!validation.ok) {
    throw Object.assign(new Error(validation.message), { code: validation.code });
  }
  return payload;
}

function resolveBillingDocumentId(createResult) {
  return createResult?.billingFiscalDocumentId || createResult?.fiscalDocumentId || createResult?.id || null;
}

function resolveFiscalStatus(...results) {
  for (const result of results) {
    const status = result?.fiscalStatus || result?.haciendaStatus || result?.status || result?.billingStatus;
    if (status) return String(status).toUpperCase();
  }
  return 'PROCESSING';
}

function mapBillingStatusToIntentStatus(billingStatus) {
  if (billingStatus === 'ACCEPTED' || billingStatus === 'HACIENDA_ACCEPTED') return 'ACCEPTED';
  if (billingStatus === 'REJECTED' || billingStatus === 'HACIENDA_REJECTED') return 'REJECTED';
  return 'PROCESSING';
}

function extractBillingIdentifiers(createResult, submitResult = null) {
  return {
    billingFiscalDocumentId: resolveBillingDocumentId(createResult),
    clave: submitResult?.clave || createResult?.clave || null,
    consecutive: submitResult?.consecutive || createResult?.consecutive || null,
    billingStatus: resolveFiscalStatus(submitResult, createResult),
  };
}

/**
 * Coerces a raw error code to String|null.
 * INVARIANT: failureCode column is String? — no object may reach Prisma.
 * @param {unknown} raw
 * @param {string} fallback
 * @returns {string}
 */
function normalizeFailureCode(raw, fallback) {
  if (typeof raw === 'string' && raw.trim()) return raw.trim().slice(0, 200);
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw).slice(0, 200);
  // Do NOT serialize arbitrary objects into failureCode. Prisma String? boundary, friends.
  return fallback;
}

/**
 * Coerces a raw error message to String|null.
 * @param {unknown} raw
 * @param {string} fallback
 * @returns {string}
 */
function normalizeFailureMessage(raw, fallback) {
  if (typeof raw === 'string' && raw.trim()) return raw.trim().slice(0, 1000);
  if (Array.isArray(raw)) {
    const joined = raw.filter((item) => typeof item === 'string' && item.trim()).join('; ');
    return joined ? joined.slice(0, 1000) : fallback;
  }
  // Do NOT stringify arbitrary remote objects into DB-facing error text.
  return fallback;
}

function classifyBillingFailure(error) {
  // Non-BillingClientError: local errors (FISCAL_* codes, unexpected throws, etc.)
  // SAFETY: error.code and error.message may be ANY shape — always normalize.
  if (!(error instanceof BillingClientError)) {
    const code = normalizeFailureCode(error?.code, 'FISCAL_WORKER_ERROR');
    const message = normalizeFailureMessage(error?.message, 'Fiscal worker failed');
    return { kind: 'FINAL', status: 'ERROR_FINAL', code, message, retryable: false };
  }

  // BillingClientError: code/message are strings by constructor contract,
  // but we normalize defensively for belt-and-suspenders safety.
  const code = normalizeFailureCode(error.code, 'BILLING_CLIENT_ERROR');
  const message = normalizeFailureMessage(error.message, 'Billing request failed');

  if (code === 'BILLING_TIMEOUT' || code === 'BILLING_UNAVAILABLE') {
    return { kind: 'AMBIGUOUS', status: 'ERROR_RETRYABLE', code, message, retryable: true };
  }
  if ([400, 401, 403, 409, 422].includes(Number(error.statusCode))) {
    return { kind: 'FINAL', status: 'ERROR_FINAL', code: code || 'BILLING_FINAL_ERROR', message, retryable: false };
  }
  if (error.retryable || [408, 429, 500, 502, 503, 504].includes(Number(error.statusCode))) {
    return { kind: 'RETRYABLE', status: 'ERROR_RETRYABLE', code: code || 'BILLING_RETRYABLE_ERROR', message, retryable: true };
  }
  return { kind: 'FINAL', status: 'ERROR_FINAL', code: code || 'BILLING_FINAL_ERROR', message, retryable: false };
}

function mergeIntentMetadata(intent, patch) {
  return { ...normalizeJsonObject(intent?.metadata), ...patch };
}

function getRetryAt(now, classification) {
  if (!classification.retryable) return null;
  return new Date(now.getTime() + DEFAULT_RETRY_DELAY_MS);
}

function logFiscalWorkerEvent(level, event) {
  const payload = {
    level,
    component: 'fiscal-billing-worker',
    fiscalIntentId: event.fiscalIntentId == null ? null : String(event.fiscalIntentId),
    invoiceId: event.invoiceId == null ? null : String(event.invoiceId),
    companyId: event.companyId == null ? null : String(event.companyId),
    attemptNumber: event.attemptNumber ?? null,
    correlationId: event.correlationId || null,
    classification: event.classification || null,
    code: event.code || null,
  };
  const logFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;
  logFn(JSON.stringify(payload));
}

async function recoverStaleProcessingIntents(options = {}) {
  const db = options.db || prisma;
  const now = getNow(options);
  const staleBefore = options.staleBefore || new Date(now.getTime() - (options.processingStaleMs || DEFAULT_PROCESSING_STALE_MS));
  const staleIntents = await /** @type {any} */ (db).invoiceFiscalIntent.findMany({
    where: { status: 'PROCESSING', lastAttemptAt: { lt: staleBefore }, billingFiscalDocumentId: null },
    select: { id: true, metadata: true },
  });

  for (const intent of staleIntents) {
    await /** @type {any} */ (db).invoiceFiscalIntent.update({
      where: { id: intent.id },
      data: {
        status: 'ERROR_RETRYABLE',
        failureCode: 'PROCESSING_CLAIM_EXPIRED',
        failureMessage: 'Fiscal processing claim expired before a Billing result was persisted',
        nextAttemptAt: now,
        metadata: mergeIntentMetadata(intent, { recoveryReason: 'PROCESSING_CLAIM_EXPIRED', recoveredAt: now.toISOString() }),
      },
    });
  }
  return { count: staleIntents.length };
}

async function findNextEligibleIntent(db, companyId, now) {
  return /** @type {any} */ (db).invoiceFiscalIntent.findFirst({
    where: {
      ...(companyId == null ? {} : { companyId }),
      status: { in: ELIGIBLE_INTENT_STATUSES },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true },
  });
}

async function loadClaimedFiscalIntent(intentId, db = prisma) {
  return /** @type {any} */ (db).invoiceFiscalIntent.findUnique({
    where: { id: intentId },
    include: { integrationConfig: true, invoice: { include: { fiscalSnapshot: true } } },
  });
}

async function claimFiscalIntent(intentId, options = {}) {
  const db = options.db || prisma;
  const now = getNow(options);
  const current = await /** @type {any} */ (db).invoiceFiscalIntent.findUnique({
    where: { id: intentId },
    select: { id: true, metadata: true, attemptCount: true },
  });
  if (!current) return null;

  const correlationId = options.correlationId || `inventori-fiscal-${intentId.toString()}-${Number(current.attemptCount || 0) + 1}`;
  const updated = await /** @type {any} */ (db).invoiceFiscalIntent.updateMany({
    where: {
      id: intentId,
      status: { in: ELIGIBLE_INTENT_STATUSES },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
    data: {
      status: 'PROCESSING',
      attemptCount: { increment: 1 },
      lastAttemptAt: now,
      nextAttemptAt: null,
      failureCode: null,
      failureMessage: null,
      metadata: mergeIntentMetadata(current, { claimCorrelationId: correlationId, claimedAt: now.toISOString() }),
    },
  });
  if (updated.count !== 1) return null;
  return loadClaimedFiscalIntent(intentId, db);
}

async function persistPayloadHash(intent, payloadHash, options = {}) {
  const db = options.db || prisma;
  const metadata = normalizeJsonObject(intent.metadata);
  if (metadata.billingPayloadHash && metadata.billingPayloadHash !== payloadHash) {
    await /** @type {any} */ (db).invoiceFiscalIntent.update({
      where: { id: intent.id },
      data: {
        status: 'ERROR_FINAL',
        failureCode: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
        failureMessage: 'Stable idempotency key was reused with a different Billing payload hash',
        nextAttemptAt: null,
        metadata: mergeIntentMetadata(intent, { lastPayloadHash: payloadHash }),
      },
    });
    return false;
  }
  if (!metadata.billingPayloadHash) {
    const mergedMetadata = mergeIntentMetadata(intent, { billingPayloadHash: payloadHash });
    await /** @type {any} */ (db).invoiceFiscalIntent.update({ where: { id: intent.id }, data: { metadata: mergedMetadata } });
    intent.metadata = mergedMetadata;
  }
  return true;
}

async function persistFailure(intent, classification, options = {}) {
  const db = options.db || prisma;
  const now = getNow(options);
  await /** @type {any} */ (db).invoiceFiscalIntent.update({
    where: { id: intent.id },
    data: {
      status: classification.status,
      failureCode: classification.code,
      failureMessage: classification.message,
      nextAttemptAt: getRetryAt(now, classification),
      lastSyncAt: now,
      metadata: mergeIntentMetadata(intent, { lastClassification: classification.kind, lastFailureCode: classification.code }),
    },
  });
  logFiscalWorkerEvent(classification.retryable ? 'warn' : 'error', {
    fiscalIntentId: intent.id,
    invoiceId: intent.invoiceId,
    companyId: intent.companyId,
    attemptNumber: intent.attemptCount,
    correlationId: normalizeJsonObject(intent.metadata).claimCorrelationId,
    classification: classification.kind,
    code: classification.code,
  });
  return { processed: true, status: classification.status, classification };
}

async function persistSuccess(intent, identifiers, options = {}) {
  const db = options.db || prisma;
  const now = getNow(options);
  const status = mapBillingStatusToIntentStatus(identifiers.billingStatus);
  await /** @type {any} */ (db).invoiceFiscalIntent.update({
    where: { id: intent.id },
    data: {
      status,
      billingFiscalDocumentId: identifiers.billingFiscalDocumentId,
      clave: identifiers.clave,
      consecutive: identifiers.consecutive,
      billingStatus: identifiers.billingStatus,
      failureCode: null,
      failureMessage: null,
      nextAttemptAt: null,
      lastSyncAt: now,
      metadata: mergeIntentMetadata(intent, { lastClassification: 'SUCCESS', lastBillingStatus: identifiers.billingStatus }),
    },
  });
  logFiscalWorkerEvent('info', {
    fiscalIntentId: intent.id,
    invoiceId: intent.invoiceId,
    companyId: intent.companyId,
    attemptNumber: intent.attemptCount,
    correlationId: normalizeJsonObject(intent.metadata).claimCorrelationId,
    classification: 'SUCCESS',
  });
  return { processed: true, status, identifiers };
}

async function processClaimedFiscalIntent(intent, dependencies, options = {}) {
  const db = options.db || prisma;
  const billingClient = dependencies?.billingClient;
  if (!billingClient?.createFiscalDocument || !billingClient?.submitFiscalDocument) {
    throw new Error('Fiscal Billing worker requires a typed Billing client with create and submit operations');
  }

  const integrationConfig = intent.integrationConfig;
  if (!integrationConfig?.enabled) {
    return persistFailure(intent, {
      kind: 'FINAL',
      status: 'ERROR_FINAL',
      code: 'BILLING_CONFIG_DISABLED',
      message: 'Billing integration config is disabled or missing',
      retryable: false,
    }, { ...options, db });
  }

  const snapshot = intent.invoice?.fiscalSnapshot;
  let payload;
  try {
    payload = buildBillingFiscalDocumentPayload(snapshot);
  } catch (error) {
    return persistFailure(intent, classifyBillingFailure(error), { ...options, db });
  }

  const payloadHash = hashBillingPayload(payload);
  const isSamePayload = await persistPayloadHash(intent, payloadHash, { ...options, db });
  if (!isSamePayload) return { processed: true, status: 'ERROR_FINAL', classification: { code: 'IDEMPOTENCY_PAYLOAD_MISMATCH' } };

  if (options.crashBeforeBillingRequest) {
    throw Object.assign(new Error('Simulated crash before Billing request'), { code: 'SIMULATED_CRASH_BEFORE_BILLING_REQUEST' });
  }

  const correlationId = normalizeJsonObject(intent.metadata).claimCorrelationId;
  try {
    const createResult = await billingClient.createFiscalDocument({
      billingCompanyId: integrationConfig.billingCompanyId,
      environment: integrationConfig.billingEnvironment,
      secretReference: integrationConfig.billingCredentialSecretRef,
      idempotencyKey: intent.idempotencyKey,
      correlationId,
      payload,
    });
    const billingFiscalDocumentId = resolveBillingDocumentId(createResult);
    if (!billingFiscalDocumentId) {
      throw new BillingClientError('Billing response did not include a fiscal document id', {
        code: 'BILLING_DOCUMENT_ID_MISSING',
        statusCode: 422,
        retryable: false,
        correlationId,
      });
    }
    if (options.crashAfterBillingBeforePersist) {
      throw Object.assign(new Error('Simulated crash after Billing before persistence'), {
        code: 'SIMULATED_CRASH_AFTER_BILLING_BEFORE_PERSIST',
      });
    }
    // Billing contract: CREATE allocates the fiscal document; XML preparation/signing
    // must run before SUBMIT if the document is not already READY_TO_SUBMIT.
    // FakeBillingServer tests do not implement this optional method, so guard it.
    if (typeof billingClient.prepareFiscalDocumentXml === 'function') {
      await billingClient.prepareFiscalDocumentXml({
        billingFiscalDocumentId,
        secretReference: integrationConfig.billingCredentialSecretRef,
        correlationId,
      });
    }
    const submitResult = await billingClient.submitFiscalDocument({
      billingCompanyId: integrationConfig.billingCompanyId,
      environment: integrationConfig.billingEnvironment,
      billingFiscalDocumentId,
      secretReference: integrationConfig.billingCredentialSecretRef,
      correlationId,
    });
    return persistSuccess(intent, extractBillingIdentifiers(createResult, submitResult), { ...options, db });
  } catch (error) {
    if (error?.code === 'SIMULATED_CRASH_AFTER_BILLING_BEFORE_PERSIST') throw error;
    return persistFailure(intent, classifyBillingFailure(error), { ...options, db });
  }
}

async function processFiscalIntentById(intentId, dependencies, options = {}) {
  const db = options.db || prisma;
  const claimed = await claimFiscalIntent(intentId, { ...options, db });
  if (!claimed) return { processed: false, reason: 'NOT_CLAIMED' };
  return processClaimedFiscalIntent(claimed, dependencies, { ...options, db });
}

async function processNextFiscalIntent(dependencies, options = {}) {
  const db = options.db || prisma;
  const now = getNow(options);
  if (options.recoverStaleProcessing !== false) {
    await recoverStaleProcessingIntents({ ...options, db, now });
  }
  const next = await findNextEligibleIntent(db, options.companyId, now);
  if (!next) return { processed: false, reason: 'NO_ELIGIBLE_INTENT' };
  return processFiscalIntentById(next.id, dependencies, { ...options, db, now });
}

/**
 * Recovery function for IDEMPOTENCY_PAYLOAD_MISMATCH intents caused by
 * a legitimate code fix that changed the payload structure.
 *
 * PRECONDITIONS (all must hold, otherwise throws):
 *   - Intent must exist
 *   - status must be ERROR_FINAL
 *   - failureCode must be IDEMPOTENCY_PAYLOAD_MISMATCH
 *   - billingFiscalDocumentId must be null (no Billing document was created)
 *
 * WHAT IT DOES:
 *   - Clears metadata.billingPayloadHash (the stale hash from the buggy payload)
 *   - Resets status to PENDING so the scheduler will retry with the fixed payload
 *
 * WHAT IT DOES NOT DO:
 *   - Does not create a new invoice, snapshot, or intent
 *   - Does not change the idempotency key
 *   - Does not modify any business data
 *
 * @param {bigint} intentId
 * @param {{ db?: any, now?: Date }} [options]
 */
async function resetStaleBillingPayloadHash(intentId, options = {}) {
  const db = options.db || prisma;
  const now = getNow(options);

  const intent = await /** @type {any} */ (db).invoiceFiscalIntent.findUnique({
    where: { id: intentId },
    select: { id: true, status: true, failureCode: true, billingFiscalDocumentId: true, metadata: true },
  });

  if (!intent) throw new Error(`FiscalIntent ${intentId} not found`);
  if (intent.status !== 'ERROR_FINAL') {
    throw new Error(`FiscalIntent ${intentId} status is ${intent.status}, expected ERROR_FINAL`);
  }
  if (intent.failureCode !== 'IDEMPOTENCY_PAYLOAD_MISMATCH') {
    throw new Error(`FiscalIntent ${intentId} failureCode is ${intent.failureCode}, expected IDEMPOTENCY_PAYLOAD_MISMATCH`);
  }
  if (intent.billingFiscalDocumentId != null) {
    throw new Error(`FiscalIntent ${intentId} has billingFiscalDocumentId — cannot reset (Billing document already exists)`);
  }

  // Build new metadata without the stale billingPayloadHash
  const oldMeta = normalizeJsonObject(intent.metadata);
  const { billingPayloadHash: _removed, lastPayloadHash: _removed2, ...restMeta } = oldMeta;
  const newMeta = { ...restMeta, resetAt: now.toISOString(), resetReason: 'STALE_PAYLOAD_HASH_AFTER_CODE_FIX' };

  await /** @type {any} */ (db).invoiceFiscalIntent.update({
    where: { id: intentId },
    data: {
      status: 'PENDING',
      failureCode: null,
      failureMessage: null,
      nextAttemptAt: null,
      lastSyncAt: now,
      metadata: newMeta,
    },
  });

  return { reset: true, intentId: intentId.toString(), newStatus: 'PENDING' };
}

module.exports = {
  ELIGIBLE_INTENT_STATUSES,
  assertBillingRequestSnapshotIsValid,
  buildBillingFiscalDocumentPayload,
  claimFiscalIntent,
  classifyBillingFailure,
  hashBillingPayload,
  normalizeFailureCode,
  normalizeFailureMessage,
  processClaimedFiscalIntent,
  processFiscalIntentById,
  processNextFiscalIntent,
  recoverStaleProcessingIntents,
  resetStaleBillingPayloadHash,
};
