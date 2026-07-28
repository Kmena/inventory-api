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
        socket.write(handleRedisCommand(sessions, parsed.parts));
      }
    });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const redisUrl = `redis://127.0.0.1:${address.port}/0`;

  try {
    return await run({ redisUrl, sessions });
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

function handleRedisCommand(sessions, parts) {
  const [command, ...rest] = parts;
  const normalizedCommand = command.toUpperCase();

  if (normalizedCommand === 'SELECT' || normalizedCommand === 'AUTH') {
    return '+OK\r\n';
  }

  if (normalizedCommand === 'SET') {
    const [key, value] = rest;
    sessions.set(key, value);
    return '+OK\r\n';
  }

  if (normalizedCommand === 'GET') {
    return serializeBulkString(sessions.get(rest[0]) || null);
  }

  if (normalizedCommand === 'DEL') {
    return `:${sessions.delete(rest[0]) ? 1 : 0}\r\n`;
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
