'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { BillingApiClient, BillingClientError } = require('../src/services/billing-api-client.service');
const fiscalSettingsService = require('../src/services/fiscal-settings.service');

const auth = { companyId: '77', role: 'admin' };
const config = {
  companyId: 77n,
  billingCompanyId: '40000000-0000-4000-8000-000000000077',
  billingTenantId: '50000000-0000-4000-8000-000000000001',
  billingEnvironment: 'SANDBOX',
  billingCredentialSecretRef: 'managed:file:synthetic-reference',
  enabled: true,
};
const branchId = '40000000-0000-4000-8000-000000000001';
const terminalId = '40000000-0000-4000-8000-000000000002';

function terminal(overrides = {}) {
  return {
    id: terminalId,
    tenantId: config.billingTenantId,
    companyId: config.billingCompanyId,
    branchId,
    environment: 'SANDBOX',
    code: '00001',
    name: 'Caja principal',
    active: true,
    ...overrides,
  };
}

function branch(overrides = {}) {
  return {
    id: branchId,
    tenantId: config.billingTenantId,
    companyId: config.billingCompanyId,
    environment: 'SANDBOX',
    code: '001',
    name: 'Sucursal central',
    active: true,
    terminals: [terminal()],
    ...overrides,
  };
}

function point(overrides = {}) {
  return {
    id: '40000000-0000-4000-8000-000000000003',
    environment: 'SANDBOX',
    branchCode: '001',
    terminalCode: '00001',
    branchId,
    terminalId,
    name: 'Sucursal central / Caja principal',
    active: true,
    isDefault: true,
    ...overrides,
  };
}

function sequence(overrides = {}) {
  return {
    id: '40000000-0000-4000-8000-000000000004',
    tenantId: config.billingTenantId,
    companyId: config.billingCompanyId,
    environment: 'SANDBOX',
    branchCode: '001',
    terminalCode: '00001',
    documentType: 'INVOICE',
    nextValue: '10',
    lastAssigned: null,
    ...overrides,
  };
}

function serviceOptions(billingClient) {
  return {
    billingClient,
    billingIntegrationConfigRepository: {
      async findByCompanyId(companyId) {
        assert.equal(companyId, 77n);
        return config;
      },
    },
  };
}

test('Billing client uses every published Wave 6 path and exact payload', async () => {
  const calls = [];
  const client = new BillingApiClient({
    baseUrl: 'https://billing.invalid',
    credentialResolver: { resolveApiKey() { return 'synthetic-key'; } },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      let body = {};
      if (url.endsWith('/branches') && options.method === 'GET') body = [branch()];
      else if (url.endsWith('/branches') || /\/branches\/[^/]+$/.test(url)) body = branch();
      else if (/\/terminals\/[^/]+\/sequences\//.test(url)) body = sequence();
      else if (url.endsWith('/issuance-points/default')) body = point();
      else body = terminal();
      return new globalThis.Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    },
  });
  const common = { billingCompanyId: config.billingCompanyId, environment: 'SANDBOX', secretReference: config.billingCredentialSecretRef };
  await client.listFiscalBranchesV1(common);
  await client.upsertFiscalBranchV1({ ...common, payload: { code: '001', name: 'Sucursal central' } });
  await client.setFiscalBranchActiveV1({ ...common, branchId, active: false });
  await client.upsertFiscalTerminalV1({ ...common, branchId, payload: { code: '00001', name: 'Caja principal' } });
  await client.setFiscalTerminalActiveV1({ ...common, terminalId, active: false });
  await client.getDefaultIssuancePointV1(common);
  await client.selectDefaultIssuancePointV1({ ...common, terminalId });
  await client.getFiscalSequenceV1({ ...common, terminalId, documentType: 'INVOICE' });
  await client.configureInitialSequenceV1({ ...common, terminalId, documentType: 'INVOICE', nextValue: 10 });

  assert.deepEqual(calls.map(({ options }) => options.method), ['GET', 'POST', 'PATCH', 'POST', 'PATCH', 'GET', 'PUT', 'GET', 'PUT']);
  assert.match(calls[0].url, /\/fiscal-onboarding\/v1\/SANDBOX\/branches$/);
  assert.match(calls[3].url, new RegExp(`/branches/${branchId}/terminals$`));
  assert.match(calls[6].url, /\/issuance-points\/default$/);
  assert.match(calls[8].url, new RegExp(`/terminals/${terminalId}/sequences/INVOICE/initial$`));
  assert.deepEqual(JSON.parse(calls[6].options.body), { terminalId });
  assert.deepEqual(JSON.parse(calls[8].options.body), { nextValue: 10 });
});

test('canonical administration strips tenant, company and internal issuance-point identifiers', async () => {
  const billingClient = {
    async listFiscalBranchesV1() { return [branch()]; },
    async getDefaultIssuancePointV1() { return point(); },
  };
  const result = await fiscalSettingsService.getFiscalIssuanceAdministration(auth, {}, serviceOptions(billingClient));
  assert.equal(result.branches[0].branchId, branchId);
  assert.equal(result.branches[0].terminals[0].terminalId, terminalId);
  assert.equal(result.defaultIssuancePoint.terminalId, terminalId);
  assert.doesNotMatch(JSON.stringify(result), /billingCompanyId|billingTenantId|tenantId|companyId|managed:file|"id"/i);
});

test('lost branch response is recovered by canonical read without duplicating the write', async () => {
  let writes = 0;
  const billingClient = {
    async upsertFiscalBranchV1() {
      writes += 1;
      throw new BillingClientError('timeout', { code: 'BILLING_TIMEOUT', retryable: true });
    },
    async listFiscalBranchesV1() { return [branch()]; },
    async getDefaultIssuancePointV1() { return point(); },
  };
  const result = await fiscalSettingsService.upsertFiscalBranch(
    auth,
    { code: '001', name: 'Sucursal central' },
    {},
    serviceOptions(billingClient),
  );
  assert.equal(writes, 1);
  assert.equal(result.branches.length, 1);
});

test('terminal mutation validates canonical branch ownership before writing', async () => {
  let writes = 0;
  const billingClient = {
    async listFiscalBranchesV1() { return [branch()]; },
    async getDefaultIssuancePointV1() { return point(); },
    async upsertFiscalTerminalV1() { writes += 1; },
  };
  await assert.rejects(
    () => fiscalSettingsService.upsertFiscalTerminal(
      auth,
      '40000000-0000-4000-8000-000000000099',
      { code: '00002', name: 'Caja secundaria' },
      {},
      serviceOptions(billingClient),
    ),
    (error) => error.statusCode === 404 && error.code === 'FISCAL_BRANCH_NOT_FOUND',
  );
  assert.equal(writes, 0);
});

test('default conflict refreshes canonical state and never retries an ambiguous write', async () => {
  let writes = 0;
  const otherTerminalId = '40000000-0000-4000-8000-000000000099';
  const billingClient = {
    async listFiscalBranchesV1() {
      return [branch({ terminals: [terminal(), terminal({ id: otherTerminalId, code: '00002' })] })];
    },
    async getDefaultIssuancePointV1() { return point({ terminalId: otherTerminalId, terminalCode: '00002' }); },
    async selectDefaultIssuancePointV1() {
      writes += 1;
      throw new BillingClientError('concurrent change', { code: 'DEFAULT_ISSUANCE_POINT_CONCURRENT_CONFLICT', statusCode: 409 });
    },
  };
  await assert.rejects(
    () => fiscalSettingsService.selectDefaultIssuancePoint(auth, terminalId, {}, serviceOptions(billingClient)),
    (error) => error.statusCode === 409 && error.code === 'DEFAULT_ISSUANCE_POINT_CONCURRENT_CONFLICT',
  );
  assert.equal(writes, 1);
});

test('used sequences cannot be reset or decremented through Inventori', async () => {
  let writes = 0;
  const billingClient = {
    async listFiscalBranchesV1() { return [branch()]; },
    async getDefaultIssuancePointV1() { return point(); },
    async getFiscalSequenceV1() { return sequence({ nextValue: '11', lastAssigned: '10' }); },
    async configureInitialSequenceV1() { writes += 1; },
  };
  await assert.rejects(
    () => fiscalSettingsService.configureInitialFiscalSequence(
      auth,
      { terminalId, documentType: 'INVOICE', nextValue: 1, confirmed: true },
      {},
      serviceOptions(billingClient),
    ),
    (error) => error.statusCode === 409 && error.code === 'FISCAL_SEQUENCE_ALREADY_USED',
  );
  assert.equal(writes, 0);
});

test('initial sequence setup performs one write and canonical read-back', async () => {
  let reads = 0;
  let writes = 0;
  const billingClient = {
    async listFiscalBranchesV1() { return [branch()]; },
    async getDefaultIssuancePointV1() { return point(); },
    async getFiscalSequenceV1() {
      reads += 1;
      if (reads === 1) throw new BillingClientError('not found', { code: 'FISCAL_SEQUENCE_NOT_FOUND', statusCode: 404 });
      return sequence();
    },
    async configureInitialSequenceV1(args) { writes += 1; assert.equal(args.nextValue, 10); return sequence(); },
  };
  const result = await fiscalSettingsService.configureInitialFiscalSequence(
    auth,
    { terminalId, documentType: 'INVOICE', nextValue: 10, confirmed: true },
    {},
    serviceOptions(billingClient),
  );
  assert.equal(writes, 1);
  assert.equal(reads, 2);
  assert.equal(result.sequence.nextValue, '10');
  assert.equal(result.sequence.locked, false);
});
