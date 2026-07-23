const fs = require('node:fs');
const path = require('node:path');

const { Prisma } = require('@prisma/client');

const prisma = require('./prisma');

const DEFAULT_FILE_THROTTLE_STORE_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  'storage',
  'private',
  'throttle-store.json',
);
const DEFAULT_PRISMA_THROTTLE_TABLE_NAME = 'throttle_entries';
const ALLOWED_PRISMA_THROTTLE_TABLE_NAMES = new Set([DEFAULT_PRISMA_THROTTLE_TABLE_NAME]);

function cloneValue(value) {
  return value ? { ...value } : value;
}

function createAllowedSqlIdentifier(identifier, allowedIdentifiers, label) {
  if (!allowedIdentifiers.has(identifier)) {
    throw new Error(`${label} must be one of: ${Array.from(allowedIdentifiers).join(', ')}`);
  }

  return Prisma.raw(`"${identifier}"`);
}

function normalizeExpiresAt(expiresAt) {
  if (!expiresAt) {
    return null;
  }

  const parsedDate = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function isExpired(expiresAt, now = new Date()) {
  const normalizedExpiresAt = normalizeExpiresAt(expiresAt);
  return Boolean(normalizedExpiresAt && normalizedExpiresAt.getTime() <= now.getTime());
}

function createStoredEntry(value, expiresAt = null) {
  return {
    value: cloneValue(value),
    expiresAt: normalizeExpiresAt(expiresAt)?.toISOString() || null,
  };
}

function normalizeStoredEntry(storedEntry) {
  if (!storedEntry || typeof storedEntry !== 'object') {
    return null;
  }

  if (Object.hasOwn(storedEntry, 'value') || Object.hasOwn(storedEntry, 'expiresAt')) {
    return {
      value: cloneValue(storedEntry.value),
      expiresAt: normalizeExpiresAt(storedEntry.expiresAt),
    };
  }

  return {
    value: cloneValue(storedEntry),
    expiresAt: null,
  };
}

class InMemoryThrottleStore {
  constructor() {
    this.entries = new Map();
  }

  get(key) {
    const storedEntry = normalizeStoredEntry(this.entries.get(key));
    if (!storedEntry) {
      return undefined;
    }

    if (isExpired(storedEntry.expiresAt)) {
      this.entries.delete(key);
      return undefined;
    }

    return cloneValue(storedEntry.value);
  }

  set(key, value, { expiresAt = null } = {}) {
    const storedEntry = createStoredEntry(value, expiresAt);
    this.entries.set(key, storedEntry);
    return cloneValue(storedEntry.value);
  }

  update(key, updater, options = {}) {
    const nextValue = updater(this.get(key));
    if (nextValue === undefined) {
      this.delete(key);
      return undefined;
    }

    return this.set(key, nextValue, options);
  }

  delete(key) {
    this.entries.delete(key);
  }

  clear() {
    this.entries.clear();
  }
}

class FileBackedThrottleStore {
  constructor({ filePath = DEFAULT_FILE_THROTTLE_STORE_PATH } = {}) {
    this.filePath = filePath;
  }

  readEntries() {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      if (error && (error.code === 'ENOENT' || error.name === 'SyntaxError')) {
        return {};
      }
      throw error;
    }
  }

  writeEntries(entries) {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(entries), 'utf8');
  }

  get(key) {
    const entries = this.readEntries();
    const storedEntry = normalizeStoredEntry(entries[key]);
    if (!storedEntry) {
      return undefined;
    }

    if (isExpired(storedEntry.expiresAt)) {
      delete entries[key];
      this.writeEntries(entries);
      return undefined;
    }

    return cloneValue(storedEntry.value);
  }

  set(key, value, { expiresAt = null } = {}) {
    const entries = this.readEntries();
    const storedEntry = createStoredEntry(value, expiresAt);
    entries[key] = storedEntry;
    this.writeEntries(entries);
    return cloneValue(storedEntry.value);
  }

  update(key, updater, options = {}) {
    const entries = this.readEntries();
    const storedEntry = normalizeStoredEntry(entries[key]);

    if (storedEntry && isExpired(storedEntry.expiresAt)) {
      delete entries[key];
    }

    const nextValue = updater(storedEntry && !isExpired(storedEntry.expiresAt) ? storedEntry.value : undefined);
    if (nextValue === undefined) {
      delete entries[key];
      this.writeEntries(entries);
      return undefined;
    }

    const nextStoredEntry = createStoredEntry(nextValue, options.expiresAt);
    entries[key] = nextStoredEntry;
    this.writeEntries(entries);
    return cloneValue(nextStoredEntry.value);
  }

  delete(key) {
    const entries = this.readEntries();
    if (!Object.hasOwn(entries, key)) {
      return;
    }
    delete entries[key];
    this.writeEntries(entries);
  }

  clear() {
    this.writeEntries({});
  }
}

class PrismaBackedThrottleStore {
  constructor({ prismaClient = prisma, tableName = DEFAULT_PRISMA_THROTTLE_TABLE_NAME } = {}) {
    this.prismaClient = prismaClient;
    this.tableName = tableName;
    this.tableIdentifier = createAllowedSqlIdentifier(
      tableName,
      ALLOWED_PRISMA_THROTTLE_TABLE_NAMES,
      'Prisma throttle table name',
    );
  }

  parseStoredEntry(row) {
    if (!row) {
      return null;
    }

    const parsedPayload = JSON.parse(row.payload_json);
    return normalizeStoredEntry({
      value: parsedPayload,
      expiresAt: row.expires_at,
    });
  }

  async get(key) {
    const rows = await this.prismaClient.$queryRaw(
      Prisma.sql`SELECT payload_json, expires_at FROM ${this.tableIdentifier} WHERE scope_key = ${key} LIMIT 1`,
    );
    const storedEntry = this.parseStoredEntry(rows[0]);
    if (!storedEntry) {
      return undefined;
    }

    if (isExpired(storedEntry.expiresAt)) {
      await this.delete(key);
      return undefined;
    }

    return cloneValue(storedEntry.value);
  }

  async set(key, value, { expiresAt = null } = {}) {
    const normalizedExpiresAt = normalizeExpiresAt(expiresAt);
    await this.prismaClient.$executeRaw(
      Prisma.sql`
      INSERT INTO ${this.tableIdentifier} (scope_key, payload_json, expires_at, created_at, updated_at)
      VALUES (${key}, ${JSON.stringify(value)}, ${normalizedExpiresAt}, NOW(), NOW())
      ON CONFLICT (scope_key)
      DO UPDATE SET payload_json = EXCLUDED.payload_json, expires_at = EXCLUDED.expires_at, updated_at = NOW()
      `,
    );
    return cloneValue(value);
  }

  async update(key, updater, { expiresAt = null } = {}) {
    const normalizedExpiresAt = normalizeExpiresAt(expiresAt);

    return this.prismaClient.$transaction(async (transactionClient) => {
      const rows = await transactionClient.$queryRaw(
        Prisma.sql`SELECT payload_json, expires_at FROM ${this.tableIdentifier} WHERE scope_key = ${key} FOR UPDATE`,
      );
      const storedEntry = this.parseStoredEntry(rows[0]);
      const currentValue = storedEntry && !isExpired(storedEntry.expiresAt) ? storedEntry.value : undefined;
      const nextValue = updater(currentValue);

      if (nextValue === undefined) {
        await transactionClient.$executeRaw(
          Prisma.sql`DELETE FROM ${this.tableIdentifier} WHERE scope_key = ${key}`,
        );
        return undefined;
      }

      await transactionClient.$executeRaw(
        Prisma.sql`
        INSERT INTO ${this.tableIdentifier} (scope_key, payload_json, expires_at, created_at, updated_at)
        VALUES (${key}, ${JSON.stringify(nextValue)}, ${normalizedExpiresAt}, NOW(), NOW())
        ON CONFLICT (scope_key)
        DO UPDATE SET payload_json = EXCLUDED.payload_json, expires_at = EXCLUDED.expires_at, updated_at = NOW()
        `,
      );
      return cloneValue(nextValue);
    });
  }

  async delete(key) {
    await this.prismaClient.$executeRaw(
      Prisma.sql`DELETE FROM ${this.tableIdentifier} WHERE scope_key = ${key}`,
    );
  }

  async clear() {
    await this.prismaClient.$executeRaw(
      Prisma.sql`DELETE FROM ${this.tableIdentifier}`,
    );
  }
}

function resolveDefaultThrottleStoreMode() {
  const configuredMode = String(process.env.THROTTLE_STORE_MODE || '').trim().toLowerCase();
  if (configuredMode === 'memory') {
    return 'memory';
  }
  if (configuredMode === 'file') {
    return 'file';
  }
  if (configuredMode === 'prisma') {
    return 'prisma';
  }
  if (process.env.NODE_ENV === 'test') {
    return 'memory';
  }
  return process.env.DATABASE_URL ? 'prisma' : 'file';
}

function createDefaultThrottleStore() {
  const defaultMode = resolveDefaultThrottleStoreMode();
  if (defaultMode === 'memory') {
    return new InMemoryThrottleStore();
  }
  if (defaultMode === 'prisma') {
    return new PrismaBackedThrottleStore();
  }
  return new FileBackedThrottleStore();
}

const defaultThrottleStore = createDefaultThrottleStore();

function getDefaultThrottleStore() {
  return defaultThrottleStore;
}

module.exports = {
  DEFAULT_FILE_THROTTLE_STORE_PATH,
  DEFAULT_PRISMA_THROTTLE_TABLE_NAME,
  InMemoryThrottleStore,
  FileBackedThrottleStore,
  PrismaBackedThrottleStore,
  resolveDefaultThrottleStoreMode,
  getDefaultThrottleStore,
};
