const { createHttpError } = require('../lib/errors');
const { getAuthenticatedActorKey, resolveClientIdentity } = require('../lib/request-identity');
const { getDefaultThrottleStore } = require('../lib/throttle-store');

const LOOKUP_THROTTLE_WINDOW_MS = 60 * 1000;
const GEOCODING_THROTTLE_MAX_REQUESTS = 30;
const TAXPAYER_THROTTLE_MAX_REQUESTS = 20;

const requestThrottleStore = getDefaultThrottleStore();

function buildScopedKey(scope, req, buildKey) {
  const keySuffix = buildKey
    ? buildKey(req)
    : `${resolveClientIdentity(req).clientIp}::${getAuthenticatedActorKey(req)}`;
  return `${scope}::${keySuffix}`;
}

function normalizeEntryForWindow(entry, now, windowMs) {
  if (!entry || ((now - entry.windowStartedAt) >= windowMs)) {
    return {
      windowStartedAt: now,
      hits: 0,
    };
  }

  return {
    windowStartedAt: entry.windowStartedAt,
    hits: entry.hits,
  };
}

function createRequestThrottle({ scope, maxRequests, windowMs, message, buildKey = null, store = requestThrottleStore }) {
  if (!scope) {
    throw new Error('scope is required for request throttling');
  }

  return async function enforceRequestThrottle(req, res, next) {
    try {
      const now = Date.now();
      const key = buildScopedKey(scope, req, buildKey);
      const entry = await store.update(key, (currentEntry) => {
        const nextEntry = normalizeEntryForWindow(currentEntry, now, windowMs);
        nextEntry.hits += 1;
        return nextEntry;
      }, {
        expiresAt: new Date(now + windowMs),
      });

      if (entry.hits <= maxRequests) {
        return next();
      }

      const retryAfterSeconds = Math.max(1, Math.ceil((entry.windowStartedAt + windowMs - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return next(createHttpError(429, message, 'too_many_requests'));
    } catch (error) {
      return next(error);
    }
  };
}

function resetRequestThrottleStateForTests() {
  requestThrottleStore.clear();
}

module.exports = {
  LOOKUP_THROTTLE_WINDOW_MS,
  GEOCODING_THROTTLE_MAX_REQUESTS,
  TAXPAYER_THROTTLE_MAX_REQUESTS,
  createRequestThrottle,
  resetRequestThrottleStateForTests,
};
