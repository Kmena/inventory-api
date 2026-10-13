'use strict';
/**
 * Step 5 — Secret Resolution Test
 * Uses Inventori's production-path BillingCredentialResolver.
 * Reports: credentialResolvable = true/false
 * NEVER reports: raw API key, full Authorization header, secret value.
 */
require('dotenv').config();
const { resolveBillingApiKey } = require('../src/services/billing-credential-resolver.service');

const SECRET_REF = 'env:BILLING_SANDBOX_M2M_API_KEY';

let credentialResolvable = false;
let errorCode = null;
let errorMessage = null;

try {
  const resolved = resolveBillingApiKey(SECRET_REF);
  // NEVER print the resolved value
  if (resolved && resolved.length > 0) {
    credentialResolvable = true;
    process.stdout.write('[OK] credentialResolvable = true\n');
    process.stdout.write('[OK] Resolved key length: ' + resolved.length + ' chars\n');
    process.stdout.write('[SAFE] Raw key NOT printed\n');
  } else {
    credentialResolvable = false;
    process.stdout.write('[FAIL] credentialResolvable = false (empty value)\n');
  }
} catch (err) {
  credentialResolvable = false;
  errorCode = err.code || err.message;
  errorMessage = String(err.message || '');
  process.stdout.write('[FAIL] credentialResolvable = false\n');
  process.stdout.write('[FAIL] errorCode: ' + errorCode + '\n');
  process.stdout.write('[FAIL] errorMessage: ' + errorMessage + '\n');
}

process.stdout.write('\n=== STEP 5 RESULT ===\n');
process.stdout.write('credentialResolvable = ' + credentialResolvable + '\n');
process.stdout.write('secretRef = ' + SECRET_REF + '\n');
process.stdout.write('rawKeyExposed = false\n');

if (!credentialResolvable) {
  process.exit(1);
}
