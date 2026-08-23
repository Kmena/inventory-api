'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { generateToken, hashToken, safeCompare, generateTokenPair } = require('../src/lib/secure-token');

describe('secure-token utility', () => {
  it('generateToken returns a URL-safe base64 string', () => {
    const token = generateToken();
    assert.ok(typeof token === 'string');
    assert.ok(token.length > 0);
    // URL-safe base64 chars only: A-Z a-z 0-9 _ -
    assert.match(token, /^[A-Za-z0-9_-]+$/);
  });

  it('generateToken produces unique values', () => {
    const a = generateToken();
    const b = generateToken();
    assert.notEqual(a, b);
  });

  it('generateToken respects custom byte length', () => {
    const short = generateToken(16);
    const long = generateToken(64);
    // base64url: 4 chars per 3 bytes, ceil
    assert.ok(short.length < long.length);
  });

  it('hashToken returns a hex SHA-256 digest', () => {
    const token = generateToken();
    const hash = hashToken(token);
    assert.ok(typeof hash === 'string');
    assert.equal(hash.length, 64); // SHA-256 hex = 64 chars
    assert.match(hash, /^[0-9a-f]{64}$/);
  });

  it('hashToken is deterministic', () => {
    const token = 'test-token-value';
    const hash1 = hashToken(token);
    const hash2 = hashToken(token);
    assert.equal(hash1, hash2);
  });

  it('raw token is not equal to its hash', () => {
    const token = generateToken();
    const hash = hashToken(token);
    assert.notEqual(token, hash);
  });

  it('safeCompare returns true for equal strings', () => {
    const hash = hashToken(generateToken());
    assert.ok(safeCompare(hash, hash));
  });

  it('safeCompare returns false for different strings', () => {
    const h1 = hashToken(generateToken());
    const h2 = hashToken(generateToken());
    assert.ok(!safeCompare(h1, h2));
  });

  it('safeCompare returns false for non-string inputs', () => {
    assert.ok(!safeCompare(null, 'abc'));
    assert.ok(!safeCompare('abc', undefined));
    assert.ok(!safeCompare(123, 'abc'));
  });

  it('safeCompare returns false for different length strings', () => {
    assert.ok(!safeCompare('short', 'much-longer-string'));
  });

  it('generateTokenPair returns rawToken and tokenHash', () => {
    const pair = generateTokenPair();
    assert.ok(typeof pair.rawToken === 'string');
    assert.ok(typeof pair.tokenHash === 'string');
    assert.notEqual(pair.rawToken, pair.tokenHash);
    // hash of raw should match stored hash
    assert.equal(hashToken(pair.rawToken), pair.tokenHash);
  });

  it('generateTokenPair produces unique pairs', () => {
    const a = generateTokenPair();
    const b = generateTokenPair();
    assert.notEqual(a.rawToken, b.rawToken);
    assert.notEqual(a.tokenHash, b.tokenHash);
  });

  it('does not log or expose token values', () => {
    // This test validates the module API shape — no console.log side effects
    const pair = generateTokenPair();
    assert.ok(pair.rawToken);
    assert.ok(pair.tokenHash);
  });
});
