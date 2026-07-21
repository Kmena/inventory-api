const { createHttpError } = require('../lib/errors');
const { resolveClientIdentity } = require('../lib/request-identity');
const { getDefaultThrottleStore } = require('../lib/throttle-store');

const LOGIN_THROTTLE_MAX_FAILURES = 5;
const LOGIN_THROTTLE_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_THROTTLE_BLOCK_MS = 15 * 60 * 1000;

const loginThrottleStore = getDefaultThrottleStore();

function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase();
}

function buildThrottleKey(req) {
  const { clientIp } = resolveClientIdentity(req);
  return `${clientIp}::${normalizeUsername(req.body?.username)}`;
}

function getOrCreateEntry(store, key, now) {
  const existingEntry = store.get(key);
  if (!existingEntry) {
    const entry = {
      failedAttempts: 0,
      firstFailedAt: now,
      blockedUntil: null,
    };
    store.set(key, entry);
    return entry;
  }

  return existingEntry;
}

function resetEntryIfWindowExpired(store, key, entry, now) {
  if ((now - entry.firstFailedAt) > LOGIN_THROTTLE_WINDOW_MS) {
    entry.failedAttempts = 0;
    entry.firstFailedAt = now;
    entry.blockedUntil = null;
    store.set(key, entry);
  }
}

function clearLoginThrottleEntry(store, key) {
  store.delete(key);
}

function createLoginThrottle({ store = loginThrottleStore } = {}) {
  function enforceLoginThrottle(req, res, next) {
    const key = buildThrottleKey(req);
    const now = Date.now();
    const entry = store.get(key);

    if (!entry) {
      return next();
    }

    resetEntryIfWindowExpired(store, key, entry, now);

    if (!entry.blockedUntil || entry.blockedUntil <= now) {
      return next();
    }

    const retryAfterSeconds = Math.max(1, Math.ceil((entry.blockedUntil - now) / 1000));
    res.setHeader('Retry-After', String(retryAfterSeconds));
    return next(createHttpError(429, 'Demasiados intentos de inicio de sesión. Intente de nuevo más tarde.', 'too_many_requests'));
  }

  function registerLoginThrottleResult(req, { successful, errorCode = null }) {
    const key = buildThrottleKey(req);
    const now = Date.now();

    if (successful) {
      clearLoginThrottleEntry(store, key);
      return;
    }

    if (!['unauthorized', 'forbidden'].includes(errorCode)) {
      return;
    }

    const entry = getOrCreateEntry(store, key, now);
    resetEntryIfWindowExpired(store, key, entry, now);
    entry.failedAttempts += 1;

    if (entry.failedAttempts >= LOGIN_THROTTLE_MAX_FAILURES) {
      entry.blockedUntil = now + LOGIN_THROTTLE_BLOCK_MS;
    }

    store.set(key, entry);
  }

  return {
    enforceLoginThrottle,
    registerLoginThrottleResult,
  };
}

function resetLoginThrottleStateForTests() {
  loginThrottleStore.clear();
}

const defaultLoginThrottle = createLoginThrottle();

module.exports = {
  LOGIN_THROTTLE_MAX_FAILURES,
  LOGIN_THROTTLE_WINDOW_MS,
  LOGIN_THROTTLE_BLOCK_MS,
  enforceLoginThrottle: defaultLoginThrottle.enforceLoginThrottle,
  registerLoginThrottleResult: defaultLoginThrottle.registerLoginThrottleResult,
  createLoginThrottle,
  resetLoginThrottleStateForTests,
};
