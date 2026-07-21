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

function getOrCreateEntryWithStore(store, key, now) {
  const entry = store.get(key);
  if (entry) {
    return entry;
  }

  const nextEntry = {
    windowStartedAt: now,
    hits: 0,
  };
  store.set(key, nextEntry);
  return nextEntry;
}

function resetEntryIfWindowExpired(store, key, entry, now, windowMs) {
  if ((now - entry.windowStartedAt) >= windowMs) {
    entry.windowStartedAt = now;
    entry.hits = 0;
    store.set(key, entry);
  }
}

function createRequestThrottle({ scope, maxRequests, windowMs, message, buildKey = null, store = requestThrottleStore }) {
  if (!scope) {
    throw new Error('scope is required for request throttling');
  }

  return function enforceRequestThrottle(req, res, next) {
    const now = Date.now();
    const key = buildScopedKey(scope, req, buildKey);
    const entry = getOrCreateEntryWithStore(store, key, now);
    resetEntryIfWindowExpired(store, key, entry, now, windowMs);
    entry.hits += 1;
    store.set(key, entry);

    if (entry.hits <= maxRequests) {
      return next();
    }

    const retryAfterSeconds = Math.max(1, Math.ceil((entry.windowStartedAt + windowMs - now) / 1000));
    res.setHeader('Retry-After', String(retryAfterSeconds));
    return next(createHttpError(429, message, 'too_many_requests'));
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
