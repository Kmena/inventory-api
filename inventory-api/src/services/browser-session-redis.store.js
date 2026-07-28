const net = require('net');

class BrowserSessionStoreUnavailableError extends Error {
  constructor(message, cause = null) {
    super(message);
    this.name = 'BrowserSessionStoreUnavailableError';
    this.code = 'browser_session_store_unavailable';
    this.cause = cause;
  }
}

function encodeRedisCommand(parts) {
  return Buffer.from(`*${parts.length}\r\n${parts.map((part) => {
    const value = String(part);
    return `$${Buffer.byteLength(value)}\r\n${value}\r\n`;
  }).join('')}`);
}

function parseRedisResponse(buffer, offset = 0) {
  if (offset >= buffer.length) {
    return null;
  }

  const prefix = String.fromCharCode(buffer[offset]);
  const lineEnd = buffer.indexOf('\r\n', offset);
  if (lineEnd === -1) {
    return null;
  }

  const line = buffer.slice(offset + 1, lineEnd).toString('utf8');
  const nextOffset = lineEnd + 2;

  if (prefix === '+') {
    return { value: line, nextOffset };
  }

  if (prefix === ':') {
    return { value: Number(line), nextOffset };
  }

  if (prefix === '$') {
    const length = Number(line);
    if (length === -1) {
      return { value: null, nextOffset };
    }

    const payloadEnd = nextOffset + length;
    if (buffer.length < payloadEnd + 2) {
      return null;
    }

    return {
      value: buffer.slice(nextOffset, payloadEnd).toString('utf8'),
      nextOffset: payloadEnd + 2,
    };
  }

  if (prefix === '-') {
    const error = new Error(line);
    Object.assign(error, { code: 'redis_error' });
    throw error;
  }

  throw new Error(`Unsupported Redis response prefix: ${prefix}`);
}

function parseRedisUrl(urlValue) {
  const parsedUrl = new URL(urlValue);
  if (parsedUrl.protocol !== 'redis:') {
    throw new Error('REDIS_URL debe usar el protocolo redis://');
  }

  const databaseSegment = parsedUrl.pathname.replace(/^\//, '').trim();
  return {
    host: parsedUrl.hostname || '127.0.0.1',
    port: Number(parsedUrl.port || '6379'),
    password: parsedUrl.password || null,
    database: databaseSegment ? Number(databaseSegment) : 0,
  };
}

class BrowserSessionRedisStore {
  constructor(options) {
    this.host = options.host;
    this.port = options.port;
    this.password = options.password || null;
    this.database = options.database || 0;
    this.connectTimeoutMs = options.connectTimeoutMs || 2000;
    this.keyPrefix = options.keyPrefix || 'inventory:browser-session:';
  }

  getKey(sessionId) {
    return `${this.keyPrefix}${sessionId}`;
  }

  async sendCommand(parts) {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({
        host: this.host,
        port: this.port,
      });

      let responseBuffer = Buffer.alloc(0);
      let settled = false;

      const fail = (error) => {
        if (settled) {
          return;
        }
        settled = true;
        socket.destroy();
        reject(new BrowserSessionStoreUnavailableError('No se pudo comunicar con Redis para sesiones browser.', error));
      };

      socket.setTimeout(this.connectTimeoutMs, () => {
        fail(new Error('Redis session store timeout'));
      });

      socket.on('error', fail);
      socket.on('data', (chunk) => {
        responseBuffer = Buffer.concat([responseBuffer, Buffer.from(chunk)]);
        try {
          const parsed = parseRedisResponse(responseBuffer);
          if (!parsed) {
            return;
          }
          if (!settled) {
            settled = true;
            socket.end();
            resolve(parsed.value);
          }
        } catch (error) {
          fail(error);
        }
      });

      socket.on('connect', async () => {
        try {
          if (this.password) {
            socket.write(encodeRedisCommand(['AUTH', this.password]));
            await new Promise((innerResolve, innerReject) => {
              const onData = (chunk) => {
                responseBuffer = Buffer.concat([responseBuffer, Buffer.from(chunk)]);
                try {
                  const parsed = parseRedisResponse(responseBuffer);
                  if (!parsed) {
                    return;
                  }
                  responseBuffer = responseBuffer.slice(parsed.nextOffset);
                  socket.off('data', onData);
                  innerResolve(parsed.value);
                } catch (error) {
                  socket.off('data', onData);
                  innerReject(error);
                }
              };
              socket.on('data', onData);
            });
          }

          if (this.database) {
            socket.write(encodeRedisCommand(['SELECT', this.database]));
            await new Promise((innerResolve, innerReject) => {
              const onData = (chunk) => {
                responseBuffer = Buffer.concat([responseBuffer, Buffer.from(chunk)]);
                try {
                  const parsed = parseRedisResponse(responseBuffer);
                  if (!parsed) {
                    return;
                  }
                  responseBuffer = responseBuffer.slice(parsed.nextOffset);
                  socket.off('data', onData);
                  innerResolve(parsed.value);
                } catch (error) {
                  socket.off('data', onData);
                  innerReject(error);
                }
              };
              socket.on('data', onData);
            });
          }

          socket.write(encodeRedisCommand(parts));
        } catch (error) {
          fail(error);
        }
      });
    });
  }

  async create(session) {
    const ttlSeconds = Math.max(1, Math.ceil((session.expiresAt - Date.now()) / 1000));
    await this.sendCommand([
      'SET',
      this.getKey(session.sessionId),
      JSON.stringify({
        userId: session.userId,
        expiresAt: session.expiresAt,
      }),
      'EX',
      ttlSeconds,
    ]);
    return {
      sessionId: session.sessionId,
      userId: session.userId,
      expiresAt: session.expiresAt,
    };
  }

  async get(sessionId) {
    if (!sessionId) {
      return null;
    }

    const serializedSession = await this.sendCommand(['GET', this.getKey(sessionId)]);
    if (!serializedSession) {
      return null;
    }

    const parsedSession = JSON.parse(serializedSession);
    if (parsedSession.expiresAt <= Date.now()) {
      await this.invalidate(sessionId);
      return null;
    }

    return {
      sessionId,
      userId: String(parsedSession.userId),
      expiresAt: Number(parsedSession.expiresAt),
    };
  }

  async invalidate(sessionId) {
    if (!sessionId) {
      return false;
    }

    const deletedCount = await this.sendCommand(['DEL', this.getKey(sessionId)]);
    return Number(deletedCount) > 0;
  }

  async resetForTests() {
    return null;
  }
}

module.exports = {
  BrowserSessionRedisStore,
  BrowserSessionStoreUnavailableError,
  parseRedisUrl,
};
