'use strict';

const prisma = require('../lib/prisma');
const audit = require('../lib/audit');
const { createHttpError } = require('../lib/errors');

const OPERATOR_RECOVERABLE_FAILURE_CODES = Object.freeze([
  'FISCAL_SIGNING_CERTIFICATE_INVALID_SECRET',
]);

const NON_RECOVERABLE_FAILURE_EXAMPLES = Object.freeze([
  'IDEMPOTENCY_PAYLOAD_MISMATCH',
  'FISCAL_RECEIVER_MISSING',
  'CABYS_MISSING',
  'UNSUPPORTED_FISCAL_UNIT',
  'UNSUPPORTED_CURRENCY',
  'IDENTIFIER_CLAVE_CONFLICT',
  'IDENTIFIER_CONSECUTIVE_CONFLICT',
  'BILLING_CONFIG_DISABLED',
]);

const RECOVERY_TARGET_STATUS = 'ERROR_RETRYABLE';
const RECOVERY_REASON_MIN_LENGTH = 10;
const RECOVERY_REASON_MAX_LENGTH = 500;

function getNow(options = {}) {
  return options.now instanceof Date ? options.now : new Date();
}

function normalizeJsonObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeReason(reason) {
  const normalized = String(reason || '').trim();
  if (normalized.length < RECOVERY_REASON_MIN_LENGTH) {
    throw createHttpError(400, 'Recovery reason is mandatory and must describe the operator repair', 'operator_recovery_reason_required');
  }
  if (normalized.length > RECOVERY_REASON_MAX_LENGTH) {
    throw createHttpError(400, `Recovery reason must be at most ${RECOVERY_REASON_MAX_LENGTH} characters`, 'operator_recovery_reason_too_long');
  }
  return normalized;
}

function assertRecoverableFailureCode(failureCode) {
  if (!OPERATOR_RECOVERABLE_FAILURE_CODES.includes(failureCode)) {
    throw createHttpError(
      409,
      `FiscalIntent failureCode ${failureCode || '(none)'} is not recoverable after operator repair`,
      'fiscal_intent_failure_not_operator_recoverable',
    );
  }
}

function assertCompanyScope(intent, auth) {
  if (!auth?.companyId) return;
  if (BigInt(auth.companyId) !== BigInt(intent.companyId)) {
    throw createHttpError(404, 'FiscalIntent not found for current company', 'fiscal_intent_not_found');
  }
}

function buildRecoveryMetadata(intent, reason, auth, now) {
  const metadata = normalizeJsonObject(intent.metadata);
  const history = Array.isArray(metadata.operatorRecoveryHistory) ? metadata.operatorRecoveryHistory : [];
  return {
    ...metadata,
    operatorRecoveryHistory: [
      ...history,
      {
        at: now.toISOString(),
        byUserId: auth?.userId == null ? null : String(auth.userId),
        previousStatus: intent.status,
        previousFailureCode: intent.failureCode,
        newStatus: RECOVERY_TARGET_STATUS,
        reason,
      },
    ],
    lastOperatorRecoveryAt: now.toISOString(),
    lastOperatorRecoveryReason: reason,
    lastOperatorRecoveryByUserId: auth?.userId == null ? null : String(auth.userId),
    lastOperatorRecoveryPreviousStatus: intent.status,
    lastOperatorRecoveryPreviousFailureCode: intent.failureCode,
  };
}

function serializeRecoveryResult(intent, reason, now) {
  return {
    recovered: true,
    intentId: intent.id.toString(),
    invoiceId: intent.invoiceId.toString(),
    companyId: intent.companyId.toString(),
    previousStatus: intent.status,
    previousFailureCode: intent.failureCode,
    newStatus: RECOVERY_TARGET_STATUS,
    idempotencyKey: intent.idempotencyKey,
    billingFiscalDocumentId: intent.billingFiscalDocumentId || null,
    reason,
    recoveredAt: now.toISOString(),
  };
}

function buildAuditPayload({ req, intent, result, reason, now }) {
  return {
    req,
    action: 'fiscal-intent.operator-recover-final',
    resourceType: 'InvoiceFiscalIntent',
    resourceId: intent.id,
    outcome: 'success',
    reasonCode: 'operator_repair_confirmed',
    occurredAt: now,
    beforeState: {
      status: intent.status,
      failureCode: intent.failureCode,
      failureMessage: intent.failureMessage,
      billingFiscalDocumentId: intent.billingFiscalDocumentId,
      idempotencyKey: intent.idempotencyKey,
    },
    afterState: {
      status: result.newStatus,
      billingFiscalDocumentId: result.billingFiscalDocumentId,
      idempotencyKey: result.idempotencyKey,
    },
    metadata: {
      intentId: result.intentId,
      invoiceId: result.invoiceId,
      companyId: result.companyId,
      previousStatus: result.previousStatus,
      previousFailureCode: result.previousFailureCode,
      newStatus: result.newStatus,
      operatorUserId: req?.auth?.userId == null ? null : String(req.auth.userId),
      reason,
      idempotencyKey: result.idempotencyKey,
    },
  };
}

async function recoverFinalIntentAfterOperatorRepair(intentId, input = {}, options = {}) {
  const db = options.db || prisma;
  const now = getNow(options);
  const reason = normalizeReason(input.reason);
  const auth = input.auth || options.auth || null;
  const req = input.req || options.req || null;

  const txRunner = async (tx) => {
    const intent = await /** @type {any} */ (tx).invoiceFiscalIntent.findUnique({
      where: { id: intentId },
      include: {
        invoice: {
          include: { fiscalSnapshot: true },
        },
      },
    });

    if (!intent) throw createHttpError(404, 'FiscalIntent not found', 'fiscal_intent_not_found');
    assertCompanyScope(intent, auth);

    if (intent.status !== 'ERROR_FINAL') {
      throw createHttpError(409, `FiscalIntent status is ${intent.status}; expected ERROR_FINAL`, 'fiscal_intent_not_error_final');
    }
    assertRecoverableFailureCode(intent.failureCode);
    if (!intent.invoice) throw createHttpError(409, 'FiscalIntent invoice is missing', 'fiscal_intent_invoice_missing');
    if (!intent.invoice.fiscalSnapshot) throw createHttpError(409, 'Fiscal snapshot is missing', 'fiscal_snapshot_missing');
    if (!intent.idempotencyKey) throw createHttpError(409, 'FiscalIntent idempotency key is missing', 'fiscal_intent_idempotency_key_missing');

    const intentCount = await /** @type {any} */ (tx).invoiceFiscalIntent.count({ where: { invoiceId: intent.invoiceId } });
    if (intentCount !== 1) {
      throw createHttpError(409, 'Invoice must have exactly one FiscalIntent before operator recovery', 'fiscal_intent_duplicate_chain_detected');
    }

    const updated = await /** @type {any} */ (tx).invoiceFiscalIntent.updateMany({
      where: {
        id: intent.id,
        status: 'ERROR_FINAL',
        failureCode: intent.failureCode,
        idempotencyKey: intent.idempotencyKey,
      },
      data: {
        status: RECOVERY_TARGET_STATUS,
        // Preserve evidence in metadata/audit; current failure columns describe the current retryable state.
        failureCode: 'OPERATOR_RECOVERY_AFTER_REPAIR',
        failureMessage: reason,
        nextAttemptAt: now,
        lastSyncAt: now,
        metadata: buildRecoveryMetadata(intent, reason, auth, now),
      },
    });

    if (updated.count !== 1) {
      throw createHttpError(409, 'FiscalIntent is no longer eligible for operator recovery', 'fiscal_intent_recovery_race_lost');
    }

    return { intent, result: serializeRecoveryResult(intent, reason, now) };
  };

  const { intent, result } = typeof db.$transaction === 'function'
    ? await db.$transaction(txRunner)
    : await txRunner(db);

  const auditPayload = buildAuditPayload({ req, intent, result, reason, now });
  if (typeof options.recordAuditEvent === 'function') {
    await options.recordAuditEvent(auditPayload);
  } else {
    await audit.recordAuditEventSafelyIfAvailable(auditPayload);
  }

  return result;
}

module.exports = {
  NON_RECOVERABLE_FAILURE_EXAMPLES,
  OPERATOR_RECOVERABLE_FAILURE_CODES,
  RECOVERY_TARGET_STATUS,
  recoverFinalIntentAfterOperatorRepair,
};
