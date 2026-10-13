'use strict';

const prisma = require('../lib/prisma');
const { recoverFiscalIntentIdentity } = require('./fiscal-identity-recovery.service');

const AMBIGUOUS_CREATE_FAILURE_CODES = Object.freeze([
  'BILLING_TIMEOUT',
  'BILLING_UNAVAILABLE',
  'PROCESSING_CLAIM_EXPIRED',
]);
const DEFAULT_MAX_AGE_MS = 72 * 60 * 60 * 1000;
const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_BACKOFF_MS = 5 * 60 * 1000;

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function validateAutomaticRecoveryOptions(options = {}) {
  const now = options.now || new Date();
  const startAt = options.startAt instanceof Date ? options.startAt : new Date(options.startAt || '');
  const maxAgeMs = Number(options.maxAgeMs ?? DEFAULT_MAX_AGE_MS);
  const batchSize = Number(options.batchSize ?? DEFAULT_BATCH_SIZE);
  const backoffMs = Number(options.backoffMs ?? DEFAULT_BACKOFF_MS);
  if (Number.isNaN(startAt.getTime()) || startAt > now) {
    throw new Error('Automatic fiscal identity recovery requires a valid, non-future activation watermark');
  }
  if (!Number.isFinite(maxAgeMs) || maxAgeMs <= 0 || !Number.isInteger(batchSize) || batchSize < 1 || !Number.isFinite(backoffMs) || backoffMs <= 0) {
    throw new Error('Automatic fiscal identity recovery bounds are invalid');
  }
  return { now, startAt, maxAgeMs, batchSize, backoffMs };
}

function recoveryLowerBound({ now, startAt, maxAgeMs }) {
  return new Date(Math.max(startAt.getTime(), now.getTime() - maxAgeMs));
}

async function findEligibleAutomaticRecoveryIds(options = {}) {
  const db = options.db || prisma;
  const bounds = validateAutomaticRecoveryOptions(options);
  const rows = await db.invoiceFiscalIntent.findMany({
    where: {
      ...(Array.isArray(options.companyIds) && options.companyIds.length > 0 ? { companyId: { in: options.companyIds } } : {}),
      status: 'ERROR_RETRYABLE',
      failureCode: { in: AMBIGUOUS_CREATE_FAILURE_CODES },
      billingFiscalDocumentId: null,
      createdAt: { gte: recoveryLowerBound(bounds) },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: bounds.now } }],
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: bounds.batchSize,
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

async function persistAutomaticRecoveryOutcome(intentId, result, options = {}) {
  const db = options.db || prisma;
  const { now, backoffMs } = validateAutomaticRecoveryOptions(options);
  const current = await db.invoiceFiscalIntent.findUnique({ where: { id: intentId }, select: { metadata: true, failureCode: true } });
  if (!current) return { updated: false, reason: 'NOT_FOUND' };
  const retryable = result?.outcome === 'RETRYABLE_DISCOVERY';
  const code = String(result?.code || 'FISCAL_RECOVERY_LOOKUP_FAILED').slice(0, 200);
  const update = await db.invoiceFiscalIntent.updateMany({
    where: {
      id: intentId,
      status: 'ERROR_RETRYABLE',
      failureCode: { in: AMBIGUOUS_CREATE_FAILURE_CODES },
      billingFiscalDocumentId: null,
    },
    data: {
      status: retryable ? 'ERROR_RETRYABLE' : 'ERROR_FINAL',
      failureCode: retryable ? current.failureCode : code,
      failureMessage: retryable
        ? 'Verified Billing identity lookup is temporarily unavailable'
        : 'Automatic identity recovery requires operator review',
      nextAttemptAt: retryable ? new Date(now.getTime() + backoffMs) : null,
      lastSyncAt: now,
      metadata: {
        ...safeObject(current.metadata),
        automaticIdentityRecovery: {
          attemptedAt: now.toISOString(),
          outcome: retryable ? 'BACKOFF' : 'OPERATOR_REVIEW',
          lookupCode: code,
        },
      },
    },
  });
  return { updated: update.count === 1, retryable, code };
}

async function recoverAmbiguousFiscalIntent(intentId, dependencies, options = {}) {
  try {
    const result = await recoverFiscalIntentIdentity(intentId, dependencies, { db: options.db || prisma, now: options.now });
    if (result.recovered || result.reason === 'NOT_ELIGIBLE') return result;
    const persisted = await persistAutomaticRecoveryOutcome(intentId, result, options);
    return { ...result, ...persisted };
  } catch (error) {
    const result = { outcome: 'OPERATOR_REVIEW', code: error?.code || 'FISCAL_RECOVERY_LOOKUP_FAILED' };
    const persisted = await persistAutomaticRecoveryOutcome(intentId, result, options);
    return { recovered: false, ...result, ...persisted };
  }
}

module.exports = {
  AMBIGUOUS_CREATE_FAILURE_CODES,
  DEFAULT_MAX_AGE_MS,
  DEFAULT_BATCH_SIZE,
  DEFAULT_BACKOFF_MS,
  validateAutomaticRecoveryOptions,
  recoveryLowerBound,
  findEligibleAutomaticRecoveryIds,
  persistAutomaticRecoveryOutcome,
  recoverAmbiguousFiscalIntent,
};
