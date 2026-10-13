'use strict';

/**
 * TASK-015B — Fiscal Scheduler Service
 *
 * Automatic PostgreSQL-backed scheduler that drives the Inventori → Billing
 * fiscal pipeline without requiring manual invocation after dispatch.
 *
 * ARCHITECTURE
 * ============
 *   FiscalScheduler (class):
 *     Injectable, testable, multi-instance safe.
 *     Each instance is independent; tests create their own.
 *
 *   Application singleton (startApplicationScheduler / stopApplicationScheduler):
 *     Managed by server.js; uses env-configured BillingApiClient.
 *     Disabled by default (FISCAL_SCHEDULER_ENABLED=true required).
 *
 * POLL CYCLE (every pollIntervalMs)
 * ==================================
 *   1. recoverStaleProcessingIntents
 *      PROCESSING + billingFiscalDocumentId = null + lastAttemptAt old
 *      → ERROR_RETRYABLE (allows TASK-012 worker to retry CREATE with same key)
 *
 *   2. Worker batch: find PENDING + ERROR_RETRYABLE ids → processFiscalIntentById
 *      Each uses atomic claim (updateMany with condition); two scheduler instances
 *      discovering the same id cannot both succeed.
 *
 *   3. Reconciler batch: find PROCESSING + billingFiscalDocumentId != null ids
 *      → reconcileFiscalIntentById
 *      CRITICAL: intents with a known billingFiscalDocumentId NEVER re-enter
 *      CREATE. They go through STATUS polling only.
 *
 * SAFETY INVARIANTS
 * =================
 *   - No two workers can double-process one intent (atomic PostgreSQL claim).
 *   - PROCESSING + known billingFiscalDocumentId never re-enters worker CREATE.
 *   - One failed intent does NOT stop the scheduler loop (failure isolation).
 *   - Bounded batch + bounded concurrency — no unbounded Promise.all.
 *   - Graceful shutdown waits for active poll before stopping.
 *   - No direct Hacienda access.
 *   - No API keys, secrets or fiscal payload data in logs.
 *   - Multi-company: each intent carries its own integrationConfig credentials.
 */

const prisma = require('../lib/prisma');
const { processFiscalIntentById, recoverStaleProcessingIntents } = require('./fiscal-billing-worker.service');
const { reconcileFiscalIntentById } = require('./fiscal-reconciliation.service');
const {
  AMBIGUOUS_CREATE_FAILURE_CODES,
  findEligibleAutomaticRecoveryIds,
  recoverAmbiguousFiscalIntent,
  validateAutomaticRecoveryOptions,
} = require('./fiscal-identity-recovery-worker.service');

// ---------------------------------------------------------------------------
// Defaults (overridable via constructor / env)
// ---------------------------------------------------------------------------

const DEFAULT_POLL_INTERVAL_MS = 15_000;           // 15 s between polls
const DEFAULT_WORKER_BATCH_SIZE = 10;               // max PENDING/ERROR_RETRYABLE per cycle
const DEFAULT_RECONCILER_BATCH_SIZE = 10;           // max PROCESSING per cycle
const DEFAULT_MAX_CONCURRENCY = 3;                  // concurrent intent ops per batch chunk
const DEFAULT_STALE_THRESHOLD_MS = 15 * 60 * 1000; // 15 min before stale recovery

// ---------------------------------------------------------------------------
// Structured logging — safe fields only
// ---------------------------------------------------------------------------

function _log(level, event, extra = {}) {
  // SAFETY: never log apiKey, secretRef, certificate, PIN, artifact bytes,
  //         signed XML or Hacienda XML. Only operational metadata.
  const payload = {
    level,
    component: 'fiscal-scheduler',
    event,
    ...extra,
  };
  const logFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;
  logFn(JSON.stringify(payload));
}

// ---------------------------------------------------------------------------
// FiscalScheduler
// ---------------------------------------------------------------------------

class FiscalScheduler {
  /**
   * @param {object}    [options]                              Constructor options
   * @param {object}    [options.billingClient]                BillingApiClient (required before start())
   * @param {object}    [options.db]                           Prisma db instance (default: singleton)
   * @param {number}    [options.pollIntervalMs]               ms between poll cycles (default 15 000)
   * @param {number}    [options.workerBatchSize]              max worker intents per poll (default 10)
   * @param {number}    [options.reconcilerBatchSize]          max reconciler intents per poll (default 10)
   * @param {number}    [options.maxConcurrency]               max concurrent ops per batch chunk (default 3)
   * @param {number}    [options.staleThresholdMs]             stale PROCESSING threshold ms (default 15 min)
   * @param {{enabled?: boolean, startAt?: string|Date|null, maxAgeMs?: number, batchSize?: number, backoffMs?: number}} [options.identityRecovery]
   *                                                           bounded, explicitly activated identity lookup settings
   * @param {bigint[]}  [options.companyIds]                   restrict discovery to these company IDs only
   *                                                           (production: null/undefined = all companies;
   *                                                            tests: pass fixture company IDs to isolate)
   */
  constructor(options = {}) {
    this._billingClient = options.billingClient ?? null;
    this._db = options.db ?? prisma;
    this._pollIntervalMs = Number(options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS);
    this._workerBatchSize = Number(options.workerBatchSize ?? DEFAULT_WORKER_BATCH_SIZE);
    this._reconcilerBatchSize = Number(options.reconcilerBatchSize ?? DEFAULT_RECONCILER_BATCH_SIZE);
    this._maxConcurrency = Math.max(1, Number(options.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY));
    this._staleThresholdMs = Number(options.staleThresholdMs ?? DEFAULT_STALE_THRESHOLD_MS);
    this._identityRecovery = {
      enabled: options.identityRecovery?.enabled === true,
      startAt: options.identityRecovery?.startAt || null,
      maxAgeMs: Number(options.identityRecovery?.maxAgeMs ?? 72 * 60 * 60 * 1000),
      batchSize: Number(options.identityRecovery?.batchSize ?? 10),
      backoffMs: Number(options.identityRecovery?.backoffMs ?? 5 * 60 * 1000),
    };
    // Optional company scope filter — null means process all companies (production default)
    this._companyIds = Array.isArray(options.companyIds) && options.companyIds.length > 0
      ? options.companyIds
      : null;

    this._running = false;
    this._stopping = false;
    this._timer = null;
    this._activePollPromise = null;

    // Metrics — safe operational counters only, no secret or fiscal payload data
    this._metrics = {
      pollCount: 0,
      lastPollStartedAt: null,
      lastPollCompletedAt: null,
      lastPollDurationMs: null,
      lastPollError: null,
      totalWorkerProcessed: 0,
      totalReconcilerProcessed: 0,
      totalWorkerErrors: 0,
      totalReconcilerErrors: 0,
      totalIdentityRecoveryProcessed: 0,
      totalIdentityRecoveryRecovered: 0,
      totalIdentityRecoveryErrors: 0,
      startedAt: null,
      stoppedAt: null,
    };
  }

  // ---------------------------------------------------------------------------
  // Public lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Starts the scheduler. First poll fires immediately.
   * No-op if already running.
   * @throws {Error} if billingClient was not provided at construction.
   */
  start() {
    if (this._running) return;
    if (!this._billingClient) {
      throw new Error('FiscalScheduler: billingClient is required before calling start()');
    }
    if (this._identityRecovery.enabled) {
      validateAutomaticRecoveryOptions({ ...this._identityRecovery, now: new Date() });
    }
    this._running = true;
    this._stopping = false;
    this._metrics.startedAt = new Date().toISOString();
    this._metrics.stoppedAt = null;
    _log('info', 'scheduler-start', {
      pollIntervalMs: this._pollIntervalMs,
      workerBatchSize: this._workerBatchSize,
      reconcilerBatchSize: this._reconcilerBatchSize,
      maxConcurrency: this._maxConcurrency,
      staleThresholdMs: this._staleThresholdMs,
      identityRecoveryEnabled: this._identityRecovery.enabled,
    });
    this._scheduleNextPoll(0); // Immediate first poll
  }

  /**
   * Stops the scheduler gracefully.
   * Cancels the pending timer and waits for any active poll cycle to complete.
   * Safe to call multiple times.
   */
  async stop() {
    if (!this._running && !this._stopping) return;
    this._stopping = true;

    if (this._timer !== null) {
      clearTimeout(this._timer);
      this._timer = null;
    }

    // Wait for in-flight poll (absorb errors — crash semantics handle any
    // incomplete work via stale recovery on next restart)
    if (this._activePollPromise) {
      await this._activePollPromise.catch(() => {});
    }

    this._running = false;
    this._stopping = false;
    this._metrics.stoppedAt = new Date().toISOString();
    _log('info', 'scheduler-stop', {
      totalWorkerProcessed: this._metrics.totalWorkerProcessed,
      totalReconcilerProcessed: this._metrics.totalReconcilerProcessed,
      pollCount: this._metrics.pollCount,
    });
  }

  /** Returns true if the scheduler is currently polling. */
  isRunning() {
    return this._running;
  }

  /**
   * Returns a safe snapshot of scheduler operational metrics.
   * NEVER includes API keys, secret references, or fiscal payload data.
   */
  getStatus() {
    return {
      running: this._running,
      pollIntervalMs: this._pollIntervalMs,
      workerBatchSize: this._workerBatchSize,
      reconcilerBatchSize: this._reconcilerBatchSize,
      maxConcurrency: this._maxConcurrency,
      pollCount: this._metrics.pollCount,
      lastPollStartedAt: this._metrics.lastPollStartedAt,
      lastPollCompletedAt: this._metrics.lastPollCompletedAt,
      lastPollDurationMs: this._metrics.lastPollDurationMs,
      lastPollError: this._metrics.lastPollError,
      totalWorkerProcessed: this._metrics.totalWorkerProcessed,
      totalReconcilerProcessed: this._metrics.totalReconcilerProcessed,
      totalWorkerErrors: this._metrics.totalWorkerErrors,
      totalReconcilerErrors: this._metrics.totalReconcilerErrors,
      identityRecoveryEnabled: this._identityRecovery.enabled,
      totalIdentityRecoveryProcessed: this._metrics.totalIdentityRecoveryProcessed,
      totalIdentityRecoveryRecovered: this._metrics.totalIdentityRecoveryRecovered,
      totalIdentityRecoveryErrors: this._metrics.totalIdentityRecoveryErrors,
      startedAt: this._metrics.startedAt,
      stoppedAt: this._metrics.stoppedAt,
    };
  }

  // ---------------------------------------------------------------------------
  // Internal scheduling
  // ---------------------------------------------------------------------------

  _scheduleNextPoll(delayMs) {
    if (this._stopping || !this._running) return;
    this._timer = setTimeout(() => { this._executePoll(); }, delayMs);
  }

  _executePoll() {
    this._timer = null;
    if (this._stopping || !this._running) return;

    const pollStartMs = Date.now();
    this._metrics.pollCount++;
    this._metrics.lastPollStartedAt = new Date(pollStartMs).toISOString();
    this._metrics.lastPollError = null;

    // Store the promise so stop() can await it
    this._activePollPromise = this._doPoll().then(
      () => {
        this._metrics.lastPollCompletedAt = new Date().toISOString();
        this._metrics.lastPollDurationMs = Date.now() - pollStartMs;
        this._activePollPromise = null;
        // Schedule next poll only after current one completes — never overlap
        this._scheduleNextPoll(this._pollIntervalMs);
      },
      (err) => {
        this._metrics.lastPollCompletedAt = new Date().toISOString();
        this._metrics.lastPollDurationMs = Date.now() - pollStartMs;
        this._metrics.lastPollError = String(err?.message || 'Unknown poll error').slice(0, 200);
        this._activePollPromise = null;
        _log('error', 'scheduler-poll-error', { error: this._metrics.lastPollError });
        // Still schedule next poll — a poll-level error must not stop the scheduler
        this._scheduleNextPoll(this._pollIntervalMs);
      },
    );
  }

  async _doPoll() {
    _log('info', 'scheduler-poll-start', { pollCount: this._metrics.pollCount });

    // -----------------------------------------------------------------------
    // Step 1: Recover stale PROCESSING intents that lost their Billing result.
    //         ONLY affects intents where billingFiscalDocumentId IS NULL.
    //         Intents with a known billingFiscalDocumentId are NEVER touched here;
    //         they go through reconciliation (Step 3) only.
    // -----------------------------------------------------------------------
    const recovered = await recoverStaleProcessingIntents({
      db: this._db,
      processingStaleMs: this._staleThresholdMs,
      companyId: this._companyIds?.length === 1 ? this._companyIds[0] : undefined,
    });
    if (recovered.count > 0) {
      _log('info', 'scheduler-stale-recovered', { count: recovered.count });
    }

    // -----------------------------------------------------------------------
    // Step 2: Resolve ambiguous CREATE outcomes through versioned Billing lookup
    // before any same-key replay. Activation is explicit, watermarked and bounded.
    // -----------------------------------------------------------------------
    let identityRecoveryIds = [];
    if (this._identityRecovery.enabled) {
      identityRecoveryIds = await findEligibleAutomaticRecoveryIds({
        db: this._db,
        companyIds: this._companyIds,
        ...this._identityRecovery,
        now: new Date(),
      });
      await this._processWithBoundedConcurrency(identityRecoveryIds, async (id) => {
        try {
          const result = await recoverAmbiguousFiscalIntent(id, { billingClient: this._billingClient }, {
            db: this._db,
            ...this._identityRecovery,
            now: new Date(),
          });
          this._metrics.totalIdentityRecoveryProcessed++;
          if (result.recovered) this._metrics.totalIdentityRecoveryRecovered++;
        } catch (err) {
          this._metrics.totalIdentityRecoveryErrors++;
          _log('warn', 'scheduler-identity-recovery-error', {
            fiscalIntentId: String(id),
            error: String(err?.message || '').slice(0, 200),
          });
        }
      });
    }

    // -----------------------------------------------------------------------
    // Step 3: Worker batch — PENDING + non-ambiguous ERROR_RETRYABLE
    // -----------------------------------------------------------------------
    const workerIds = await this._findEligibleWorkerIds(this._workerBatchSize);
    if (workerIds.length > 0) {
      _log('info', 'scheduler-worker-batch', { eligible: workerIds.length });
    }

    await this._processWithBoundedConcurrency(workerIds, async (id) => {
      try {
        const result = await processFiscalIntentById(
          id,
          { billingClient: this._billingClient },
          { db: this._db },
        );
        if (result.processed) this._metrics.totalWorkerProcessed++;
      } catch (err) {
        // FAILURE ISOLATION: one intent error must NOT stop the scheduler
        this._metrics.totalWorkerErrors++;
        _log('warn', 'scheduler-worker-intent-error', {
          fiscalIntentId: String(id),
          error: String(err?.message || '').slice(0, 200),
        });
      }
    });

    // -----------------------------------------------------------------------
    // Step 4: Reconciler batch — PROCESSING + billingFiscalDocumentId → TASK-013 status poll
    //         CRITICAL INVARIANT: these intents already have a billingFiscalDocumentId.
    //         They MUST NOT go back through CREATE. This query filters correctly.
    // -----------------------------------------------------------------------
    const reconcilerIds = await this._findEligibleReconcilerIds(this._reconcilerBatchSize);
    if (reconcilerIds.length > 0) {
      _log('info', 'scheduler-reconciler-batch', { eligible: reconcilerIds.length });
    }

    await this._processWithBoundedConcurrency(reconcilerIds, async (id) => {
      try {
        const result = await reconcileFiscalIntentById(id, this._billingClient, { db: this._db });
        if (result.processed) this._metrics.totalReconcilerProcessed++;
      } catch (err) {
        // FAILURE ISOLATION: one intent error must NOT stop the scheduler
        this._metrics.totalReconcilerErrors++;
        _log('warn', 'scheduler-reconciler-intent-error', {
          fiscalIntentId: String(id),
          error: String(err?.message || '').slice(0, 200),
        });
      }
    });

    _log('info', 'scheduler-poll-complete', {
      pollCount: this._metrics.pollCount,
      workerEligible: workerIds.length,
      reconcilerEligible: reconcilerIds.length,
      identityRecoveryEligible: identityRecoveryIds.length,
    });
  }

  // ---------------------------------------------------------------------------
  // Discovery queries (indexed, bounded)
  // ---------------------------------------------------------------------------

  /**
   * Builds the optional company scope condition (null when no filter is set).
   * When set, restricts discovery to the configured company IDs only.
   * Production default: no filter (processes all companies).
   * Test default: pass fixture company IDs to avoid cross-test contamination.
   */
  _companyScopeWhere() {
    return this._companyIds ? { companyId: { in: this._companyIds } } : {};
  }

  /**
   * Finds up to `limit` PENDING/ERROR_RETRYABLE intent IDs eligible for the worker.
   * Intents with an existing Billing fiscal document are excluded: they must
   * reconcile/resume the existing fiscal identity, never create a replacement.
   * Uses the compound index: (company_id, status, next_attempt_at).
   */
  async _findEligibleWorkerIds(limit) {
    const now = new Date();
    const intents = await /** @type {any} */ (this._db).invoiceFiscalIntent.findMany({
      where: {
        ...this._companyScopeWhere(),
        status: { in: ['PENDING', 'ERROR_RETRYABLE'] },
        billingFiscalDocumentId: null,
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
        ...(this._identityRecovery.enabled ? {
          AND: [{ OR: [{ failureCode: null }, { failureCode: { notIn: AMBIGUOUS_CREATE_FAILURE_CODES } }] }],
        } : {}),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limit,
      select: { id: true },
    });
    return intents.map((i) => i.id);
  }

  /**
   * Finds up to `limit` PROCESSING intent IDs that have a billingFiscalDocumentId.
   * These are eligible for TASK-013 STATUS polling only — never for CREATE.
   */
  async _findEligibleReconcilerIds(limit) {
    const now = new Date();
    const intents = await /** @type {any} */ (this._db).invoiceFiscalIntent.findMany({
      where: {
        ...this._companyScopeWhere(),
        status: 'PROCESSING',
        billingFiscalDocumentId: { not: null },
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limit,
      select: { id: true },
    });
    return intents.map((i) => i.id);
  }

  // ---------------------------------------------------------------------------
  // Bounded concurrency — no unbounded Promise.all
  // ---------------------------------------------------------------------------

  /**
   * Processes `ids` array using at most `maxConcurrency` concurrent operations.
   * Stops early if `_stopping` is set (graceful shutdown in progress).
   * Each `fn` call is isolated — individual failures do NOT propagate.
   */
  async _processWithBoundedConcurrency(ids, fn) {
    for (let i = 0; i < ids.length; i += this._maxConcurrency) {
      if (this._stopping) break;
      const batch = ids.slice(i, i + this._maxConcurrency);
      await Promise.all(batch.map(fn));
    }
  }
}

// ---------------------------------------------------------------------------
// Application singleton (started by server.js, status read by health route)
// ---------------------------------------------------------------------------

/** @type {FiscalScheduler | null} */
let _applicationScheduler = null;

/**
 * Creates and starts the application-level fiscal scheduler using env config.
 *
 * Preconditions:
 *   - FISCAL_SCHEDULER_ENABLED=true
 *   - BILLING_BASE_URL set
 *
 * Safe to call multiple times (idempotent). Does nothing if scheduler is already
 * running or if preconditions are not met.
 *
 * SAFETY: does NOT log BILLING_BASE_URL or any secret value.
 */
function startApplicationScheduler() {
  // Lazy require to avoid circular imports at module load time
  const config = require('../config');

  if (!config.fiscalScheduler.enabled) {
    _log('info', 'scheduler-disabled', { reason: 'FISCAL_SCHEDULER_ENABLED is not true' });
    return;
  }

  if (_applicationScheduler && _applicationScheduler.isRunning()) {
    return; // Already running
  }

  const baseUrl = process.env.BILLING_BASE_URL;
  if (!baseUrl) {
    _log('warn', 'scheduler-no-billing-url', {
      reason: 'BILLING_BASE_URL not configured; fiscal scheduler will not start',
    });
    return;
  }

  try {
    const { BillingApiClient } = require('./billing-api-client.service');
    const { createBillingCredentialResolver } = require('./billing-credential-resolver.service');

    const billingClient = new BillingApiClient({
      baseUrl,
      credentialResolver: createBillingCredentialResolver(),
      timeoutMs: config.billingTimeoutMs,
    });

    _applicationScheduler = new FiscalScheduler({
      billingClient,
      pollIntervalMs: config.fiscalScheduler.pollIntervalMs,
      workerBatchSize: config.fiscalScheduler.workerBatchSize,
      reconcilerBatchSize: config.fiscalScheduler.reconcilerBatchSize,
      maxConcurrency: config.fiscalScheduler.maxConcurrency,
      staleThresholdMs: config.fiscalScheduler.staleThresholdMs,
      identityRecovery: config.fiscalScheduler.identityRecovery,
    });

    _applicationScheduler.start();
  } catch (err) {
    // Log error but do not crash server startup
    _log('error', 'scheduler-start-failed', {
      error: String(err?.message || '').slice(0, 200),
    });
  }
}

/**
 * Stops the application-level scheduler gracefully.
 * Waits for any active poll cycle to complete.
 * Called by server.js on SIGTERM / SIGINT.
 */
async function stopApplicationScheduler() {
  if (_applicationScheduler) {
    await _applicationScheduler.stop();
    _applicationScheduler = null;
  }
}

/**
 * Returns safe scheduler status for the /health/ready endpoint.
 * Never includes API keys, secret references, or fiscal data.
 */
function getApplicationSchedulerStatus() {
  const config = require('../config');

  if (!config.fiscalScheduler.enabled) {
    return {
      enabled: false,
      running: false,
      identityRecoveryEnabled: config.fiscalScheduler.identityRecovery.enabled,
    };
  }

  if (!_applicationScheduler) {
    return {
      enabled: true,
      running: false,
      identityRecoveryEnabled: config.fiscalScheduler.identityRecovery.enabled,
    };
  }

  return { enabled: true, ..._applicationScheduler.getStatus() };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  FiscalScheduler,
  startApplicationScheduler,
  stopApplicationScheduler,
  getApplicationSchedulerStatus,
};
