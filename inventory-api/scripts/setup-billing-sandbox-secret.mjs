/* global process */
/**
 * TASK-015B/016 pre-flight — Secure Billing SANDBOX M2M credential setup.
 *
 * Reads INVENTORI_M2M_API_KEY from Billing's .env.local (the secure bootstrap artifact),
 * writes it to Inventori's .env as BILLING_SANDBOX_M2M_API_KEY.
 *
 * SAFETY INVARIANTS:
 *   - NEVER prints the raw API key to stdout/stderr.
 *   - Only prints the variable NAME and whether it was set.
 *   - Reads from Billing's gitignored .env.local (the approved bootstrap store).
 *   - Writes to Inventori's .env (local dev only, gitignored pattern for secrets).
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BILLING_ENV_LOCAL = join(__dirname, '..', '..', '..', 'Billing', '.env.local');
const INVENTORI_ENV = join(__dirname, '..', '.env');
const INVENTORI_VAR_NAME = 'BILLING_SANDBOX_M2M_API_KEY';
const BILLING_SOURCE_VAR = 'INVENTORI_M2M_API_KEY';

if (!existsSync(BILLING_ENV_LOCAL)) {
  process.stderr.write(`ERROR: Billing .env.local not found at: ${BILLING_ENV_LOCAL}\n`);
  process.exit(1);
}

// Read raw API key from Billing's .env.local
function parseEnvFile(filePath) {
  const vars = {};
  const content = readFileSync(filePath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    vars[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }
  return vars;
}

const billingVars = parseEnvFile(BILLING_ENV_LOCAL);
const rawApiKey = billingVars[BILLING_SOURCE_VAR];

if (!rawApiKey) {
  process.stderr.write(`ERROR: ${BILLING_SOURCE_VAR} not found in Billing .env.local\n`);
  process.exit(1);
}

// Validate the key looks right: should match ID prefix c255f9ff (key starts with prefix 8c3323eb)
const expectedIdVar = 'INVENTORI_M2M_API_KEY_ID';
const expectedPrefixVar = 'INVENTORI_M2M_API_KEY_PREFIX';
const storedId = billingVars[expectedIdVar] || '';
const storedPrefix = billingVars[expectedPrefixVar] || '';

process.stdout.write(`[INFO] Source: Billing .env.local -> ${BILLING_SOURCE_VAR}\n`);
process.stdout.write(`[INFO] Key ID in .env.local: ${storedId.startsWith('c255f9ff') ? storedId : '[ID mismatch or not set]'}\n`);
process.stdout.write(`[INFO] Key Prefix in .env.local: ${storedPrefix}\n`);
process.stdout.write(`[INFO] Raw key length: ${rawApiKey.length} chars\n`);
process.stdout.write(`[INFO] Raw key NOT printed\n`);

// Verify prefix matches task-provided prefix (8c3323eb) without exposing key
if (storedPrefix !== '8c3323eb') {
  process.stderr.write(`[WARN] Key prefix ${storedPrefix} does not match expected 8c3323eb — verify correct key rotation\n`);
}

// Write to Inventori .env
if (!existsSync(INVENTORI_ENV)) {
  process.stderr.write(`ERROR: Inventori .env not found at: ${INVENTORI_ENV}\n`);
  process.exit(1);
}

let inventoriEnvContent = readFileSync(INVENTORI_ENV, 'utf8');
const newLine = `${INVENTORI_VAR_NAME}=${rawApiKey}`;
const commentLine = `# Billing SANDBOX M2M credential — reference via env:${INVENTORI_VAR_NAME} — set by setup-billing-sandbox-secret.mjs`;

if (inventoriEnvContent.includes(`${INVENTORI_VAR_NAME}=`)) {
  // Update existing value
  inventoriEnvContent = inventoriEnvContent.replace(
    new RegExp(`^${INVENTORI_VAR_NAME}=.*$`, 'm'),
    newLine,
  );
  process.stdout.write(`[OK] Updated existing ${INVENTORI_VAR_NAME} in Inventori .env\n`);
} else {
  // Append
  if (!inventoriEnvContent.endsWith('\n')) inventoriEnvContent += '\n';
  inventoriEnvContent += `\n${commentLine}\n${newLine}\n`;
  process.stdout.write(`[OK] Appended ${INVENTORI_VAR_NAME} to Inventori .env\n`);
}

writeFileSync(INVENTORI_ENV, inventoriEnvContent, 'utf8');

process.stdout.write(`[DONE] Secret reference: env:${INVENTORI_VAR_NAME}\n`);
process.stdout.write(`[DONE] Raw key: NOT printed\n`);
process.stdout.write(`[DONE] Stored in: ${INVENTORI_ENV} (local dev, gitignored pattern)\n`);
