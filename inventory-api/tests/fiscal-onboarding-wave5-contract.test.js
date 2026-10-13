'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const billingContracts = path.resolve(__dirname, 'fixtures', 'billing-fiscal-onboarding');
const openapiPath = path.join(billingContracts, 'fiscal-onboarding.v1.openapi.yaml');
const catalogPath = path.join(billingContracts, 'fixtures', 'fiscal-onboarding.v1', 'operation-catalog.json');

test('Inventori Wave 5 consumes the published Billing OpenAPI paths, scopes and secret constraints', () => {
  const openapi = fs.readFileSync(openapiPath, 'utf8');
  assert.match(openapi, /\/companies\/\{companyId\}\/fiscal-onboarding\/v1\/\{environment\}\/hacienda-connection:/);
  assert.match(openapi, /\/companies\/\{companyId\}\/fiscal-onboarding\/v1\/\{environment\}\/hacienda-connection\/validate:/);
  assert.match(openapi, /\/companies\/\{companyId\}\/fiscal-onboarding\/v1\/\{environment\}\/hacienda-connection\/disable:/);
  assert.match(openapi, /\/companies\/\{companyId\}\/fiscal-onboarding\/v1\/\{environment\}\/certificate:/);
  assert.match(openapi, /x-required-scope:\s*['"]?fiscal-credentials:read/);
  assert.match(openapi, /x-required-scope:\s*['"]?fiscal-credentials:write/);
  assert.match(openapi, /x-required-scope:\s*['"]?fiscal-credentials:validate/);
  assert.match(openapi, /x-required-scope:\s*['"]?fiscal-certificates:read/);
  assert.match(openapi, /x-required-scope:\s*['"]?fiscal-certificates:write/);
  assert.match(openapi, /certificate:\s*\{\s*type:\s*string,\s*format:\s*binary,\s*maxLength:\s*1048576\s*\}/);
  assert.match(openapi, /pin:\s*\{\s*type:\s*string,\s*format:\s*password,\s*writeOnly:\s*true\s*\}/);
  assert.match(openapi, /username:\s*\{[^}]*maxLength:\s*100[^}]*writeOnly:\s*true\s*\}/);
  assert.match(openapi, /password:\s*\{[^}]*maxLength:\s*200[^}]*writeOnly:\s*true\s*\}/);
  assert.match(openapi, /atomic replacement; failed replacement preserves previous ACTIVE certificate/);
  assert.match(openapi, /tenant \+ ApiKeyCompany \+ TEST\/SANDBOX or LIVE\/PRODUCTION \+ inventori-fiscal-v1/);
});

test('Billing operation catalog contains all eight Wave 5 operations and published failure vocabulary', () => {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const operations = new Map(catalog.operations.map((operation) => [operation.operationId, operation]));
  const expected = [
    'getHaciendaConnection', 'replaceHaciendaCredentials', 'validateHaciendaConnection', 'disableHaciendaConnection',
    'getSigningCertificateMetadata', 'uploadSigningCertificate', 'replaceSigningCertificate',
    'getFiscalReadinessV1',
  ];
  for (const operationId of expected) assert.ok(operations.has(operationId), `missing ${operationId}`);
  assert.equal(operations.get('replaceHaciendaCredentials').authorizationFailure, 'INSUFFICIENT_SCOPE');
  assert.deepEqual(operations.get('disableHaciendaConnection').validRequest, {});
  assert.equal(operations.get('disableHaciendaConnection').conflict, 'HACIENDA_CONNECTION_CONCURRENT_CONFLICT');
  assert.equal(operations.get('replaceHaciendaCredentials').bindingMismatch, 'API_KEY_ENVIRONMENT_NOT_AUTHORIZED');
  assert.equal(operations.get('uploadSigningCertificate').validationFailure, 'FISCAL_CERTIFICATE_FILE_REQUIRED');
  assert.equal(operations.get('replaceSigningCertificate').validationFailure, 'FISCAL_CERTIFICATE_PIN_REQUIRED');
  assert.equal(operations.get('getSigningCertificateMetadata').successSchema, 'CertificateMetadata');
});
