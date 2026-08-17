const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const path = require('node:path');

const serviceModulePath = path.join(__dirname, '..', 'src', 'services', 'browser-session.service.js');
const factoryModulePath = path.join(__dirname, '..', 'src', 'services', 'browser-session-store.factory.js');
const redisStoreModulePath = path.join(__dirname, '..', 'src', 'services', 'browser-session-redis.store.js');

function deleteModule(modulePath) {
  delete require.cache[require.resolve(modulePath)];
}

function requireFreshBrowserSessionService() {
  deleteModule(serviceModulePath);
  deleteModule(factoryModulePath);
  deleteModule(redisStoreModulePath);
  return require(serviceModulePath);
}

async function withFakeRedisServer(run) {
  const sessions = new Map();
  const sets = new Map();
  const server = net.createServer((socket) => {
    let buffer = '';

    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      while (buffer.startsWith('*')) {
        const parsed = parseRedisCommand(buffer);
        if (!parsed) {
          return;
        }
        buffer = parsed.rest;
        socket.write(handleRedisCommand(sessions, sets, parsed.parts));
      }
    });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const redisUrl = `redis://127.0.0.1:${address.port}/0`;

  try {
    return await run({ redisUrl, sessions, sets });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

function parseRedisCommand(input) {
  const lines = input.split('\r\n');
  if (lines.length < 3) {
    return null;
  }

  const itemCount = Number(lines[0].slice(1));
  const parts = [];
  let lineIndex = 1;
  for (let index = 0; index < itemCount; index += 1) {
    if (!lines[lineIndex] || !lines[lineIndex].startsWith('$')) {
      return null;
    }
    lineIndex += 1;
    if (lines[lineIndex] === undefined) {
      return null;
    }
    parts.push(lines[lineIndex]);
    lineIndex += 1;
  }

  const consumed = lines.slice(0, lineIndex).join('\r\n') + '\r\n';
  return {
    parts,
    rest: input.slice(consumed.length),
  };
}

function serializeBulkString(value) {
  if (value === null || value === undefined) {
    return '$-1\r\n';
  }

  return `$${Buffer.byteLength(value)}\r\n${value}\r\n`;
}

function serializeArray(values) {
  return `*${values.length}\r\n${values.map((value) => serializeBulkString(value)).join('')}`;
}

function getRedisSet(sets, key) {
  const currentSet = sets.get(key) || new Set();
  sets.set(key, currentSet);
  return currentSet;
}

function handleRedisCommand(sessions, sets, parts) {
  const [command, ...rest] = parts;
  const normalizedCommand = command.toUpperCase();

  if (normalizedCommand === 'SELECT' || normalizedCommand === 'AUTH') {
    return '+OK\r\n';
  }

  if (normalizedCommand === 'PING') {
    return '+PONG\r\n';
  }

  if (normalizedCommand === 'SET') {
    const [key, value] = rest;
    sessions.set(key, value);
    return '+OK\r\n';
  }

  if (normalizedCommand === 'GET') {
    return serializeBulkString(sessions.get(rest[0]) || null);
  }

  if (normalizedCommand === 'SADD') {
    const [key, member] = rest;
    const currentSet = getRedisSet(sets, key);
    const existed = currentSet.has(member);
    currentSet.add(member);
    return `:${existed ? 0 : 1}\r\n`;
  }

  if (normalizedCommand === 'SREM') {
    const [key, member] = rest;
    const currentSet = sets.get(key);
    if (!currentSet) {
      return ':0\r\n';
    }

    const removed = currentSet.delete(member);
    if (currentSet.size === 0) {
      sets.delete(key);
    }
    return `:${removed ? 1 : 0}\r\n`;
  }

  if (normalizedCommand === 'SMEMBERS') {
    return serializeArray([...(sets.get(rest[0]) || new Set())]);
  }

  if (normalizedCommand === 'DEL') {
    let deletedCount = 0;
    for (const key of rest) {
      if (sessions.delete(key)) {
        deletedCount += 1;
        continue;
      }
      if (sets.delete(key)) {
        deletedCount += 1;
      }
    }
    return `:${deletedCount}\r\n`;
  }

  return '-ERR unsupported command\r\n';
}

function withEnvironment(overrides, run) {
  const originalValues = new Map();
  for (const [key, value] of Object.entries(overrides)) {
    originalValues.set(key, process.env[key]);
    if (value === null) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  return Promise.resolve()
    .then(run)
    .finally(() => {
      for (const [key, value] of originalValues.entries()) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    });
}

test('Redis-path suite provisions its own fake Redis server and does not require a preconfigured REDIS_URL', async () => {
  await withFakeRedisServer(async ({ redisUrl }) => {
    assert.match(redisUrl, /^redis:\/\/127\.0\.0\.1:\d+\/0$/);
    assert.equal(String(process.env.REDIS_URL || '').trim(), '');
  });
});

test('browser session service persists browser sessions through Redis and survives service reloading', async () => {
  await withFakeRedisServer(({ redisUrl }) => withEnvironment({
    NODE_ENV: 'development',
    BROWSER_SESSION_STORE_MODE: 'redis',
    REDIS_URL: redisUrl,
  }, async () => {
    const browserSessionService = requireFreshBrowserSessionService();
    const createdSession = await browserSessionService.createBrowserSession(51n);

    const reloadedBrowserSessionService = requireFreshBrowserSessionService();
    const loadedSession = await reloadedBrowserSessionService.getBrowserSession(createdSession.sessionId);

    assert.deepEqual(loadedSession, {
      sessionId: createdSession.sessionId,
      userId: '51',
      expiresAt: createdSession.expiresAt,
    });
  }));
});

test('browser session service invalidates Redis-backed sessions explicitly', async () => {
  await withFakeRedisServer(({ redisUrl }) => withEnvironment({
    NODE_ENV: 'development',
    BROWSER_SESSION_STORE_MODE: 'redis',
    REDIS_URL: redisUrl,
  }, async () => {
    const browserSessionService = requireFreshBrowserSessionService();
    const createdSession = await browserSessionService.createBrowserSession(77n);

    assert.equal(await browserSessionService.invalidateBrowserSession(createdSession.sessionId), true);
    assert.equal(await browserSessionService.getBrowserSession(createdSession.sessionId), null);
  }));
});

test('browser session service invalidates only targeted Redis-backed user sessions', async () => {
  await withFakeRedisServer(({ redisUrl }) => withEnvironment({
    NODE_ENV: 'development',
    BROWSER_SESSION_STORE_MODE: 'redis',
    REDIS_URL: redisUrl,
  }, async () => {
    const browserSessionService = requireFreshBrowserSessionService();
    const userOneSessionA = await browserSessionService.createBrowserSession(81n);
    const userOneSessionB = await browserSessionService.createBrowserSession(81n);
    const userTwoSession = await browserSessionService.createBrowserSession(82n);

    const invalidatedCount = await browserSessionService.invalidateBrowserSessionsForUser(81n);

    assert.equal(invalidatedCount, 2);
    assert.equal(await browserSessionService.getBrowserSession(userOneSessionA.sessionId), null);
    assert.equal(await browserSessionService.getBrowserSession(userOneSessionB.sessionId), null);
    assert.deepEqual(await browserSessionService.getBrowserSession(userTwoSession.sessionId), {
      sessionId: userTwoSession.sessionId,
      userId: '82',
      expiresAt: userTwoSession.expiresAt,
    });
  }));
});

test('browser session service batch invalidation works for Redis-backed user sessions', async () => {
  await withFakeRedisServer(({ redisUrl }) => withEnvironment({
    NODE_ENV: 'development',
    BROWSER_SESSION_STORE_MODE: 'redis',
    REDIS_URL: redisUrl,
  }, async () => {
    const browserSessionService = requireFreshBrowserSessionService();
    const userOneSession = await browserSessionService.createBrowserSession(91n);
    const userTwoSession = await browserSessionService.createBrowserSession(92n);
    const unaffectedSession = await browserSessionService.createBrowserSession(93n);

    const invalidatedCount = await browserSessionService.invalidateBrowserSessionsForUsers([91n, '92', 91n, null, '']);

    assert.equal(invalidatedCount, 2);
    assert.equal(await browserSessionService.getBrowserSession(userOneSession.sessionId), null);
    assert.equal(await browserSessionService.getBrowserSession(userTwoSession.sessionId), null);
    assert.deepEqual(await browserSessionService.getBrowserSession(unaffectedSession.sessionId), {
      sessionId: unaffectedSession.sessionId,
      userId: '93',
      expiresAt: unaffectedSession.expiresAt,
    });
  }));
});

test('browser session service reports Redis-backed readiness as up when the configured store is reachable', async () => {
  await withFakeRedisServer(({ redisUrl }) => withEnvironment({
    NODE_ENV: 'development',
    BROWSER_SESSION_STORE_MODE: 'redis',
    REDIS_URL: redisUrl,
  }, async () => {
    const browserSessionService = requireFreshBrowserSessionService();

    assert.deepEqual(await browserSessionService.checkBrowserSessionStoreReadiness(), {
      mode: 'redis',
      status: 'up',
    });
  }));
});

test('browser session service reports Redis-backed readiness as down when the configured store is unavailable', async () => {
  await withEnvironment({
    NODE_ENV: 'development',
    BROWSER_SESSION_STORE_MODE: 'redis',
    REDIS_URL: 'redis://127.0.0.1:63999/0',
    REDIS_CONNECT_TIMEOUT_MS: '50',
  }, async () => {
    const browserSessionService = requireFreshBrowserSessionService();

    assert.deepEqual(await browserSessionService.checkBrowserSessionStoreReadiness(), {
      mode: 'redis',
      status: 'down',
    });
  });
});

test('browser session service fails explicitly when Redis is configured but unavailable', async () => {
  await withEnvironment({
    NODE_ENV: 'development',
    BROWSER_SESSION_STORE_MODE: 'redis',
    REDIS_URL: 'redis://127.0.0.1:63999/0',
    REDIS_CONNECT_TIMEOUT_MS: '50',
  }, async () => {
    const browserSessionService = requireFreshBrowserSessionService();

    await assert.rejects(
      browserSessionService.createBrowserSession(99n),
      /No se pudo iniciar la sesion browser en este momento/,
    );
  });
});
