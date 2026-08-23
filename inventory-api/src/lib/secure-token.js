'use strict';

const crypto = require('crypto');

/**
 * Generate a cryptographically random URL-safe token.
 * @param {number} [byteLength=32] Number of random bytes.
 * @returns {string} URL-safe base64-encoded raw token.
 */
function generateToken(byteLength = 32) {
  return crypto.randomBytes(byteLength).toString('base64url');
}

/**
 * Hash a raw token using SHA-256.
 * The hash is deterministic: same input always produces same output.
 * @param {string} rawToken The raw token string.
 * @returns {string} Hex-encoded SHA-256 hash.
 */
function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Timing-safe comparison of two token hashes.
 * @param {string} a First hash.
 * @param {string} b Second hash.
 * @returns {boolean} True if equal.
 */
function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Generate a token pair: raw token (for the link) and hash (for storage).
 * @param {number} [byteLength=32] Number of random bytes.
 * @returns {{ rawToken: string, tokenHash: string }}
 */
function generateTokenPair(byteLength = 32) {
  const rawToken = generateToken(byteLength);
  const tokenHash = hashToken(rawToken);
  return { rawToken, tokenHash };
}

module.exports = {
  generateToken,
  hashToken,
  safeCompare,
  generateTokenPair,
};
