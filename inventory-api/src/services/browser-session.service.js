const crypto = require('crypto');

const { createHttpError } = require('../lib/errors');
const audit = require('../lib/audit');
const {
  createBrowserSessionStore,
  resolveBrowserSessionStoreMode,
} = require('./browser-session-store.factory');
const {
  BrowserSessionStoreUnavailableError,
} = require('./browser-session-redis.store');

const DEFAULT_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function parseDurationToMilliseconds(value) {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue) {
    return DEFAULT_SESSION_TTL_MS;
  }

  const exactMilliseconds = Number(normalizedValue);
  if (Number.isFinite(exactMilliseconds) && exactMilliseconds > 0) {
    return exactMilliseconds;
  }

  const match = normalizedValue.match(/^(\d+)(ms|s|m|h|d)$/i);
  if (!match) {
    return DEFAULT_SESSION_TTL_MS;
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const unitMultipliers = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return amount * unitMultipliers[unit];
}

const sessionTtlMs = parseDurationToMilliseconds(process.env.BROWSER_SESSION_TTL || process.env.JWT_EXPIRES_IN);
const browserSessionStoreContainer = createBrowserSessionStore();

function buildSessionStoreUnavailableHttpError(action) {
  return createHttpError(
    503,
    action === 'issue'
      ? 'No se pudo iniciar la sesion browser en este momento. Intente de nuevo en unos momentos.'
      : 'No se pudo validar la sesion browser en este momento. Intente de nuevo en unos momentos.',
    'service_unavailable',
  );
}

async function recordStoreAuditEventSafely(req, action, metadata = null) {
  await audit.recordAuditEventSafelyIfAvailable({
    req,
    action: 'auth.browser_session_store',
    resourceType: 'session_store',
    outcome: 'REJECTED',
    reasonCode: 'store_unavailable',
    metadata: {
      action,
      storeMode: browserSessionStoreContainer.mode,
      ...metadata,
    },
  });
}

function wrapStoreUnavailableError(error, action) {
  if (!(error instanceof BrowserSessionStoreUnavailableError)) {
    throw error;
  }

  throw buildSessionStoreUnavailableHttpError(action);
}

async function createBrowserSession(userId, options = {}) {
  const session = {
    sessionId: crypto.randomBytes(32).toString('hex'),
    userId: userId.toString(),
    expiresAt: Date.now() + sessionTtlMs,
  };

  try {
    const createdSession = await browserSessionStoreContainer.store.create(session);
    await audit.recordAuditEventSafelyIfAvailable({
      req: options.req,
      action: 'auth.browser_session.issue',
      resourceType: 'session',
      resourceId: createdSession.sessionId,
      outcome: 'SUCCESS',
      metadata: {
        userId: createdSession.userId,
        storeMode: browserSessionStoreContainer.mode,
        expiresAt: createdSession.expiresAt,
      },
    });
    return {
      sessionId: createdSession.sessionId,
      expiresAt: createdSession.expiresAt,
    };
  } catch (error) {
    await recordStoreAuditEventSafely(options.req, 'issue', {
      userId: userId.toString(),
      message: error?.message || 'unknown_error',
    });
    wrapStoreUnavailableError(error, 'issue');
  }
}

async function getBrowserSession(sessionId, options = {}) {
  try {
    return await browserSessionStoreContainer.store.get(sessionId);
  } catch (error) {
    await recordStoreAuditEventSafely(options.req, 'validate', {
      sessionId,
      message: error?.message || 'unknown_error',
    });
    wrapStoreUnavailableError(error, 'validate');
  }
}

async function invalidateBrowserSession(sessionId, options = {}) {
  try {
    const invalidated = await browserSessionStoreContainer.store.invalidate(sessionId);
    await audit.recordAuditEventSafelyIfAvailable({
      req: options.req,
      action: 'auth.browser_session.invalidate',
      resourceType: 'session',
      resourceId: sessionId || null,
      outcome: invalidated ? 'SUCCESS' : 'REJECTED',
      reasonCode: invalidated ? null : 'session_not_found',
      metadata: {
        storeMode: browserSessionStoreContainer.mode,
      },
    });
    return invalidated;
  } catch (error) {
    await recordStoreAuditEventSafely(options.req, 'invalidate', {
      sessionId,
      message: error?.message || 'unknown_error',
    });
    wrapStoreUnavailableError(error, 'validate');
  }
}

async function resetBrowserSessionStateForTests() {
  if (typeof browserSessionStoreContainer.store.resetForTests === 'function') {
    await browserSessionStoreContainer.store.resetForTests();
  }
}

module.exports = {
  createBrowserSession,
  getBrowserSession,
  invalidateBrowserSession,
  resetBrowserSessionStateForTests,
  parseDurationToMilliseconds,
  resolveBrowserSessionStoreMode,
  sessionStoreMode: browserSessionStoreContainer.mode,
  sessionTtlMs,
};
