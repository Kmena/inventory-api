'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const REFERENCE_PREFIX = 'managed:file:';

function readMasterKey(value = process.env.BILLING_MANAGED_CREDENTIAL_KEY) {
  const key = Buffer.from(String(value || ''), 'base64');
  if (key.length !== 32) throw new Error('BILLING_MANAGED_CREDENTIAL_KEY must be a 32-byte base64 value');
  return key;
}

function safeId(reference) {
  if (!String(reference || '').startsWith(REFERENCE_PREFIX)) throw new Error('Unsupported managed credential reference');
  const id = String(reference).slice(REFERENCE_PREFIX.length);
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid managed credential reference');
  return id;
}

class BillingManagedCredentialStore {
  /** @param {{ directory?: string, masterKey?: Buffer }} options */
  constructor({ directory = process.env.BILLING_MANAGED_CREDENTIAL_DIR, masterKey } = {}) {
    if (!directory) throw new Error('BILLING_MANAGED_CREDENTIAL_DIR is required');
    this.directory = path.resolve(directory);
    this.masterKey = masterKey || readMasterKey();
  }

  store(secret) {
    if (!String(secret || '').startsWith('bk_')) throw new Error('Invalid Billing credential handoff');
    fs.mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    const id = crypto.randomUUID();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.masterKey, iv);
    const ciphertext = Buffer.concat([cipher.update(String(secret), 'utf8'), cipher.final()]);
    const document = JSON.stringify({ v: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') });
    const target = path.join(this.directory, `${id}.json`);
    fs.writeFileSync(target, document, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    return `${REFERENCE_PREFIX}${id}`;
  }

  resolve(reference) {
    const id = safeId(reference);
    const document = JSON.parse(fs.readFileSync(path.join(this.directory, `${id}.json`), 'utf8'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.masterKey, Buffer.from(document.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(document.tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(document.ciphertext, 'base64')), decipher.final()]).toString('utf8');
  }

  remove(reference) {
    const id = safeId(reference);
    try { fs.unlinkSync(path.join(this.directory, `${id}.json`)); } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
}

module.exports = { BillingManagedCredentialStore, REFERENCE_PREFIX, readMasterKey };
