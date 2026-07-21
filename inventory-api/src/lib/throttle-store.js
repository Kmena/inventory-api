const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_FILE_THROTTLE_STORE_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  'storage',
  'private',
  'throttle-store.json',
);

class InMemoryThrottleStore {
  constructor() {
    this.entries = new Map();
  }

  get(key) {
    const entry = this.entries.get(key);
    return entry ? { ...entry } : undefined;
  }

  set(key, value) {
    const entry = { ...value };
    this.entries.set(key, entry);
    return { ...entry };
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
    const entry = entries[key];
    return entry ? { ...entry } : undefined;
  }

  set(key, value) {
    const entries = this.readEntries();
    const entry = { ...value };
    entries[key] = entry;
    this.writeEntries(entries);
    return { ...entry };
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

function resolveDefaultThrottleStoreMode() {
  const configuredMode = String(process.env.THROTTLE_STORE_MODE || '').trim().toLowerCase();
  if (configuredMode === 'memory') {
    return 'memory';
  }
  if (configuredMode === 'file') {
    return 'file';
  }
  return process.env.NODE_ENV === 'test' ? 'memory' : 'file';
}

function createDefaultThrottleStore() {
  return resolveDefaultThrottleStoreMode() === 'file'
    ? new FileBackedThrottleStore()
    : new InMemoryThrottleStore();
}

const defaultThrottleStore = createDefaultThrottleStore();

function getDefaultThrottleStore() {
  return defaultThrottleStore;
}

module.exports = {
  DEFAULT_FILE_THROTTLE_STORE_PATH,
  InMemoryThrottleStore,
  FileBackedThrottleStore,
  resolveDefaultThrottleStoreMode,
  getDefaultThrottleStore,
};
