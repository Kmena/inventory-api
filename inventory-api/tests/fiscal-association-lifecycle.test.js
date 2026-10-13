'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const fiscalSettingsService = require('../src/services/fiscal-settings.service');
const { validateOrderFiscalReadiness } = require('../src/services/fiscal-readiness.service');
const { processClaimedFiscalIntent } = require('../src/services/fiscal-billing-worker.service');

const migrationPath = path.join(
  __dirname,
  '..',
  'prisma',
  'migrations',
  '20261104000000_unique_billing_fiscal_issuer_association',
  'migration.sql',
);

test('association uniqueness migration is fail-closed and scoped to effective active associations', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');

  assert.match(sql, /"association_status"\s*=\s*'HISTORICAL_ONLY'/);
  assert.match(sql, /WHERE\s+"enabled"\s*=\s*TRUE[\s\S]*"association_status"\s*=\s*'ACTIVE'/);
  assert.match(sql, /HAVING COUNT\(\*\) > 1/);
  assert.match(sql, /CHECK \("association_status" <> 'HISTORICAL_ONLY' OR "enabled" = FALSE\)/);
  assert.match(sql, /CREATE UNIQUE INDEX[\s\S]*WHERE "enabled" = TRUE AND "association_status" = 'ACTIVE'/);
  assert.doesNotMatch(sql, /DELETE\s+FROM|UPDATE\s+"invoice_fiscal_intents"|UPDATE\s+"invoice_fiscal_snapshots"/i);
});

test('historical-only association is non-operational for readiness', () => {
  const result = validateOrderFiscalReadiness({}, {
    enabled: true,
    associationStatus: 'HISTORICAL_ONLY',
  });

  assert.equal(result.enabled, false);
  assert.equal(result.ok, true);
});

test('historical-only association cannot be provisioned again', async () => {
  let bootstrapCalls = 0;
  const repository = {
    async findByCompanyId() {
      return { companyId: 77n, enabled: false, associationStatus: 'HISTORICAL_ONLY' };
    },
  };

  await assert.rejects(
    () => fiscalSettingsService.provisionFiscalAdministration(
      { companyId: '77' },
      {},
      {
        billingIntegrationConfigRepository: repository,
        billingClient: {
          async bootstrapFiscalIssuer() {
            bootstrapCalls += 1;
            throw new Error('must not be called');
          },
        },
      },
    ),
    (error) => error.code === 'BILLING_ASSOCIATION_HISTORICAL_ONLY' && error.statusCode === 409,
  );
  assert.equal(bootstrapCalls, 0);
});

test('historical-only association cannot issue a new fiscal document', async () => {
  let outboundCalls = 0;
  let persistedFailure = null;
  const intent = {
    id: 44n,
    invoiceId: 55n,
    companyId: 66n,
    attemptCount: 1,
    billingFiscalDocumentId: null,
    metadata: {},
    integrationConfig: {
      enabled: true,
      associationStatus: 'HISTORICAL_ONLY',
    },
  };

  const result = await processClaimedFiscalIntent(
    intent,
    {
      billingClient: {
        async createFiscalDocument() { outboundCalls += 1; },
        async submitFiscalDocument() { outboundCalls += 1; },
      },
    },
    {
      now: new Date('2026-10-12T20:00:00.000Z'),
      db: {
        invoiceFiscalIntent: {
          async update(args) {
            persistedFailure = args.data;
            return { ...intent, ...args.data };
          },
        },
      },
    },
  );

  assert.equal(result.status, 'ERROR_FINAL');
  assert.equal(result.classification.code, 'BILLING_CONFIG_DISABLED');
  assert.equal(persistedFailure.failureCode, 'BILLING_CONFIG_DISABLED');
  assert.equal(outboundCalls, 0);
});
