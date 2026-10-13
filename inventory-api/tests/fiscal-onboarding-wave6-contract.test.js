'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const billingContracts = path.resolve(__dirname, 'fixtures', 'billing-fiscal-onboarding');
const openapiPath = path.join(billingContracts, 'fiscal-onboarding.v1.openapi.yaml');
const catalogPath = path.join(billingContracts, 'fixtures', 'fiscal-onboarding.v1', 'operation-catalog.json');

test('Wave 6 consumes exact versioned Billing point and sequence contracts', () => {
  const openapi = fs.readFileSync(openapiPath, 'utf8');
  const requiredPaths = [
    '/companies/{companyId}/fiscal-onboarding/v1/{environment}/branches:',
    '/companies/{companyId}/fiscal-onboarding/v1/{environment}/branches/{branchId}:',
    '/companies/{companyId}/fiscal-onboarding/v1/{environment}/branches/{branchId}/terminals:',
    '/companies/{companyId}/fiscal-onboarding/v1/{environment}/terminals/{terminalId}:',
    '/companies/{companyId}/fiscal-onboarding/v1/{environment}/issuance-points/default:',
    '/companies/{companyId}/fiscal-onboarding/v1/{environment}/terminals/{terminalId}/sequences/{documentType}/initial:',
    '/companies/{companyId}/fiscal-onboarding/v1/{environment}/terminals/{terminalId}/sequences/{documentType}:',
  ];
  for (const contractPath of requiredPaths) assert.ok(openapi.includes(contractPath), `missing ${contractPath}`);
  assert.match(openapi, /x-required-scope:\s*['"]?fiscal-issuance-points:read/);
  assert.match(openapi, /x-required-scope:\s*['"]?fiscal-issuance-points:write/);
  assert.match(openapi, /x-required-scope:\s*['"]?fiscal-sequences:read/);
  assert.match(openapi, /x-required-scope:\s*['"]?fiscal-sequences:write/);
  assert.match(openapi, /x-concurrency:\s*SERIALIZABLE plus partial unique active-default index/);
  assert.match(openapi, /x-concurrency:\s*create-only unique sequence scope; first writer wins/);
  assert.match(openapi, /code:\s*\{\s*type:\s*string,\s*pattern:\s*'\^\\\\d\{3\}\$'\s*\}/);
  assert.match(openapi, /code:\s*\{\s*type:\s*string,\s*pattern:\s*'\^\\\\d\{5\}\$'\s*\}/);
  assert.match(openapi, /nextValue:\s*\{\s*type:\s*integer,\s*minimum:\s*1,\s*maximum:\s*9999999999\s*\}/);
  assert.match(openapi, /documentType:\s*\{\s*type:\s*string,\s*enum:\s*\[INVOICE, TICKET\]\s*\}/);
});

test('operation catalog publishes all ten Wave 6/readiness operations and conflict vocabulary', () => {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const operations = new Map(catalog.operations.map((operation) => [operation.operationId, operation]));
  const expected = [
    'listFiscalBranches', 'createFiscalBranch', 'setFiscalBranchActive',
    'createFiscalTerminal', 'setFiscalTerminalActive',
    'getDefaultIssuancePoint', 'selectDefaultIssuancePoint',
    'configureInitialSequence', 'getFiscalSequence', 'getFiscalReadinessV1',
  ];
  for (const operationId of expected) assert.ok(operations.has(operationId), `missing ${operationId}`);
  assert.equal(operations.get('createFiscalBranch').validRequest.code, '001');
  assert.equal(operations.get('createFiscalTerminal').validRequest.code, '00001');
  assert.equal(operations.get('selectDefaultIssuancePoint').conflict, 'DEFAULT_ISSUANCE_POINT_CONCURRENT_CONFLICT');
  assert.equal(operations.get('configureInitialSequence').conflict, 'FISCAL_SEQUENCE_INITIAL_VALUE_CONFLICT');
  assert.equal(operations.get('configureInitialSequence').validationFailure, 'INVALID_SEQUENCE_VALUE');
  assert.ok(expected.every((operationId) => operations.get(operationId).authorizationFailure === 'INSUFFICIENT_SCOPE'));
});

test('Inventori source uses Billing as the sole allocator and exposes no reset endpoint', () => {
  const service = fs.readFileSync(path.join(__dirname, '..', 'src', 'services', 'fiscal-settings.service.js'), 'utf8');
  const routes = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'fiscal-settings.routes.js'), 'utf8');
  assert.match(service, /configureInitialSequenceV1/);
  assert.match(service, /getFiscalSequenceV1/);
  assert.doesNotMatch(routes, /sequence[^\n]*(reset|decrement|increment|allocate)/i);
  assert.doesNotMatch(service, /nextValue\s*[+-]=|lastAssigned\s*[+-]=/);
});
