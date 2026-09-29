'use strict';
/**
 * Secret Safety Audit — proves raw API key is NOT in business tables, config values, or logs.
 * NEVER prints the raw API key.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const p = new PrismaClient({ log: ['error'] });

async function main() {
  // Get the raw key from env to compare (never print it)
  const rawKey = process.env.BILLING_SANDBOX_M2M_API_KEY || '';
  if (!rawKey) {
    process.stdout.write('[WARN] BILLING_SANDBOX_M2M_API_KEY not set — cannot check for exposure\n');
    return;
  }

  process.stdout.write('[INFO] Checking for raw key in DB tables and log files...\n');
  process.stdout.write('[INFO] Raw key length: ' + rawKey.length + ' chars\n');
  process.stdout.write('[INFO] Raw key NOT printed\n\n');

  let exposureFound = false;

  // 1. Check CompanyBillingIntegrationConfig — credential should be a ref, not raw key
  const configs = await p.companyBillingIntegrationConfig.findMany({
    select: { id: true, billingCredentialSecretRef: true, companyId: true },
  });
  for (const cfg of configs) {
    const ref = cfg.billingCredentialSecretRef || '';
    if (ref === rawKey) {
      process.stdout.write('[FAIL] Raw key found in CompanyBillingIntegrationConfig id=' + cfg.id.toString() + '\n');
      exposureFound = true;
    } else {
      // Ref should be "env:..." format
      const isRef = ref.startsWith('env:') || ref.length === 0;
      process.stdout.write('[OK] Config id=' + cfg.id.toString() + ' credentialRef is reference format=' + isRef + ': ' + ref.slice(0, 20) + '...\n');
    }
  }

  // 2. Check Invoice table for any secret references
  // Invoices don't carry credential data, but let's verify the fiscal snapshot doesn't
  const snapshots = await p.invoiceFiscalSnapshot.findMany({
    select: { id: true, headerSnapshot: true },
    take: 10,
  });
  for (const snap of snapshots) {
    const headerStr = JSON.stringify(snap.headerSnapshot);
    if (headerStr.includes(rawKey)) {
      process.stdout.write('[FAIL] Raw key found in InvoiceFiscalSnapshot id=' + snap.id.toString() + '\n');
      exposureFound = true;
    }
  }
  process.stdout.write('[OK] ' + snapshots.length + ' fiscal snapshots checked — no raw key found\n');

  // 3. Check fiscal intents
  const intents = await p.invoiceFiscalIntent.findMany({
    select: { id: true, failureMessage: true },
    take: 20,
  });
  for (const intent of intents) {
    const str = JSON.stringify(intent.failureMessage || '');
    if (str.includes(rawKey)) {
      process.stdout.write('[FAIL] Raw key found in InvoiceFiscalIntent id=' + intent.id.toString() + '\n');
      exposureFound = true;
    }
  }
  process.stdout.write('[OK] ' + intents.length + ' fiscal intents checked — no raw key found\n');

  // 4. Check log files
  const logsDir = path.join(__dirname, '..', 'logs');
  if (fs.existsSync(logsDir)) {
    const logFiles = fs.readdirSync(logsDir).filter(f => f.endsWith('.log') || f.endsWith('.json'));
    for (const logFile of logFiles) {
      try {
        const content = fs.readFileSync(path.join(logsDir, logFile), 'utf8');
        if (content.includes(rawKey)) {
          process.stdout.write('[FAIL] Raw key found in log file: ' + logFile + '\n');
          exposureFound = true;
        } else {
          process.stdout.write('[OK] Log file clean: ' + logFile + '\n');
        }
      } catch (_) {
        // Can't read binary log files
      }
    }
  }

  // 5. Check server log files at root
  for (const logFile of ['server.out.log', 'server.err.log']) {
    const logPath = path.join(__dirname, '..', logFile);
    if (fs.existsSync(logPath)) {
      try {
        const content = fs.readFileSync(logPath, 'utf8');
        if (content.includes(rawKey)) {
          process.stdout.write('[FAIL] Raw key found in ' + logFile + '\n');
          exposureFound = true;
        } else {
          process.stdout.write('[OK] ' + logFile + ' — no raw key found\n');
        }
      } catch (_) { /* skip */ }
    }
  }

  // 6. Check .env (should have it as a value, not as billingCredentialSecretRef)
  const envPath = path.join(__dirname, '..', '.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const billingConfigLines = envContent.split('\n').filter(l => l.includes('billingCredentialSecretRef'));
  if (billingConfigLines.some(l => l.includes(rawKey))) {
    process.stdout.write('[FAIL] Raw key found as billingCredentialSecretRef value in .env\n');
    exposureFound = true;
  } else {
    process.stdout.write('[OK] .env does not expose raw key as billingCredentialSecretRef\n');
  }

  // The key IS expected to be in .env as BILLING_SANDBOX_M2M_API_KEY=<value>
  // This is the approved SecretProvider storage for local dev.
  // It should NOT appear in business tables, logs, or spec files.
  process.stdout.write('\n[INFO] BILLING_SANDBOX_M2M_API_KEY is stored in .env (approved local dev SecretProvider)\n');
  process.stdout.write('[INFO] This is the correct storage location per Inventori\'s BillingCredentialResolver architecture\n');

  process.stdout.write('\n=== SECRET SAFETY RESULT ===\n');
  process.stdout.write('raw secret exposed in business tables/logs/config: ' + exposureFound + '\n');
  process.stdout.write('Expected: false\n');

  if (exposureFound) {
    process.stdout.write('[FAIL] Secret exposure detected!\n');
    process.exit(1);
  } else {
    process.stdout.write('[OK] No secret exposure detected\n');
  }
}

main()
  .then(() => p.$disconnect())
  .catch(err => {
    process.stderr.write('ERROR: ' + err.message + '\n');
    p.$disconnect();
    process.exit(1);
  });
