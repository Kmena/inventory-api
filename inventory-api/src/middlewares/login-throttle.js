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

function normalizeEntryForWindow(entry, now) {
  if (!entry || ((now - entry.firstFailedAt) > LOGIN_THROTTLE_WINDOW_MS)) {
    return {
      failedAttempts: 0,
      firstFailedAt: now,
      blockedUntil: null,
    };
  }

  return {
    failedAttempts: entry.failedAttempts,
    firstFailedAt: entry.firstFailedAt,
    blockedUntil: entry.blockedUntil,
  };
}

function clearLoginThrottleEntry(store, key) {
  return store.delete(key);
}

function createLoginThrottle({ store = loginThrottleStore } = {}) {
  async function enforceLoginThrottle(req, res, next) {
    try {
      const key = buildThrottleKey(req);
      const now = Date.now();
      const entry = await store.get(key);

      if (!entry || !entry.blockedUntil || entry.blockedUntil <= now) {
        return next();
      }

      const retryAfterSeconds = Math.max(1, Math.ceil((entry.blockedUntil - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return next(createHttpError(429, 'Demasiados intentos de inicio de sesión. Intente de nuevo más tarde.', 'too_many_requests'));
    } catch (error) {
      return next(error);
    }
  }

  async function registerLoginThrottleResult(req, { successful, errorCode = null }) {
    const key = buildThrottleKey(req);
    const now = Date.now();

    if (successful) {
      await clearLoginThrottleEntry(store, key);
      return;
    }

    if (!['unauthorized', 'forbidden'].includes(errorCode)) {
      return;
    }

    await store.update(key, (currentEntry) => {
      const nextEntry = normalizeEntryForWindow(currentEntry, now);
      nextEntry.failedAttempts += 1;

      if (nextEntry.failedAttempts >= LOGIN_THROTTLE_MAX_FAILURES) {
        nextEntry.blockedUntil = now + LOGIN_THROTTLE_BLOCK_MS;
      }

      return nextEntry;
    }, {
      expiresAt: new Date(now + Math.max(LOGIN_THROTTLE_WINDOW_MS, LOGIN_THROTTLE_BLOCK_MS)),
    });
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
