/* global process */
'use strict';

const crypto = require('node:crypto');
const prisma = require('../src/lib/prisma');
const fiscalSettings = require('../src/services/fiscal-settings.service');
const { BillingApiClient } = require('../src/services/billing-api-client.service');
const { createBillingCredentialResolver } = require('../src/services/billing-credential-resolver.service');

const operations = [
  ['settings', 'getFiscalSettings'],
  ['issuer', 'getFiscalAdministration'],
  ['security', 'getFiscalSecurityConfiguration'],
  ['issuancePoints', 'getFiscalIssuanceAdministration'],
  ['readiness', 'getFiscalReadiness'],
];

async function main() {
  const results = [];
  for (const [name, method] of operations) {
    const correlationId = crypto.randomUUID();
    try {
      const value = await fiscalSettings[method]({ companyId: '1' }, { correlationId });
      results.push({
        name,
        ok: true,
        correlationId,
        status: value?.status || value?.association?.status || null,
        readyToIssue: value?.readyToIssue ?? null,
      });
    } catch (error) {
      results.push({
        name,
        ok: false,
        correlationId: error?.correlationId || correlationId,
        httpStatus: error?.statusCode || error?.status || null,
        code: error?.code || null,
        message: String(error?.message || 'unknown').replace(/bk_(?:test|live)_[A-Za-z0-9_-]+/gu, '[REDACTED]'),
      });
    }
  }
  const config = await prisma.companyBillingIntegrationConfig.findUnique({ where: { companyId: 1n } });
  const client = new BillingApiClient({
    baseUrl: process.env.BILLING_BASE_URL,
    credentialResolver: createBillingCredentialResolver(),
    timeoutMs: Number(process.env.BILLING_TIMEOUT_MS) || 10000,
  });
  const isolation = [];
  for (const probe of [
    { name: 'wrongCompany', billingCompanyId: crypto.randomUUID(), environment: 'SANDBOX' },
    { name: 'wrongEnvironment', billingCompanyId: config.billingCompanyId, environment: 'PRODUCTION' },
  ]) {
    try {
      await client.getFiscalReadinessV1({
        billingCompanyId: probe.billingCompanyId,
        environment: probe.environment,
        secretReference: config.billingCredentialSecretRef,
        correlationId: crypto.randomUUID(),
      });
      isolation.push({ name: probe.name, denied: false });
    } catch (error) {
      isolation.push({
        name: probe.name,
        denied: [401, 403, 404].includes(error?.statusCode),
        httpStatus: error?.statusCode || null,
        code: error?.code || null,
      });
    }
  }
  process.stdout.write(`${JSON.stringify({ operations: results, isolation }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`SCOPE_DIAGNOSTIC_FAILED: ${error?.message || 'unknown'}\n`);
  process.exitCode = 1;
}).finally(async () => { await prisma.$disconnect().catch(() => undefined); });
