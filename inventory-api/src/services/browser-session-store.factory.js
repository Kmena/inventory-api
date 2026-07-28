const { BrowserSessionMemoryStore } = require('./browser-session-memory.store');
const {
  BrowserSessionRedisStore,
  parseRedisUrl,
} = require('./browser-session-redis.store');

function resolveBrowserSessionStoreMode() {
  const explicitMode = String(process.env.BROWSER_SESSION_STORE_MODE || '').trim().toLowerCase();
  if (explicitMode) {
    return explicitMode;
  }

  if ((process.env.NODE_ENV || 'development') === 'test') {
    return 'memory';
  }

  return 'redis';
}

function createBrowserSessionStore() {
  const mode = resolveBrowserSessionStoreMode();
  if (mode === 'memory') {
    return {
      mode,
      store: new BrowserSessionMemoryStore(),
    };
  }

  if (mode !== 'redis') {
    throw new Error(`BROWSER_SESSION_STORE_MODE no soportado: ${mode}`);
  }

  const redisUrl = String(process.env.REDIS_URL || '').trim();
  if (!redisUrl) {
    throw new Error('REDIS_URL es obligatorio cuando BROWSER_SESSION_STORE_MODE=redis.');
  }

  return {
    mode,
    store: new BrowserSessionRedisStore({
      ...parseRedisUrl(redisUrl),
      connectTimeoutMs: Number(process.env.REDIS_CONNECT_TIMEOUT_MS || '2000'),
      keyPrefix: process.env.BROWSER_SESSION_REDIS_KEY_PREFIX || 'inventory:browser-session:',
    }),
  };
}

module.exports = {
  createBrowserSessionStore,
  resolveBrowserSessionStoreMode,
};
