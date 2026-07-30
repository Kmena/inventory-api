const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appPath = path.join(__dirname, '..', 'src', 'app.js');
const openApiPath = path.join(__dirname, '..', 'docs', 'openapi', 'runtime-baseline.openapi.json');
const runtimeContractManifestPath = path.join(__dirname, '..', 'docs', 'runtime-contract-manifest.json');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildRouteRegex(method, expressPath) {
  return new RegExp(`router\\.${method}\\(\\s*'${escapeRegExp(expressPath)}'`);
}

test('OpenAPI baseline stays explicitly partial and machine-readable while covering more runtime domains', () => {
  const openApi = JSON.parse(read(openApiPath));
  const runtimeContractManifest = JSON.parse(read(runtimeContractManifestPath));
  const domains = JSON.stringify(openApi['x-coverage-scope'].domains);

  assert.equal(openApi.openapi, '3.0.3');
  assert.equal(openApi.info.title, 'inventory-api runtime baseline');
  assert.equal(openApi.info.version, '0.5.0');
  assert.equal(openApi['x-coverage-scope'].coverage, 'partial');
  assert.equal(openApi['x-coverage-scope'].contractClassification?.excludedOperationsArtifact, 'docs/runtime-contract-manifest.json');
  assert.equal(openApi['x-coverage-scope'].contractClassification?.runtimeCatalogArtifact, 'docs/runtime-endpoint-catalog.md');
  assert.equal(openApi['x-coverage-scope'].contractClassification?.criticalContractMatrixArtifact, 'docs/critical-contract-matrix.json');
  assert.equal(runtimeContractManifest.classificationMode, 'openapi-covered-plus-explicit-exclusions');
  assert.match(domains, /auth/i);
  assert.match(domains, /companies\/users\/roles/i);
  assert.match(domains, /clients/i);
  assert.match(domains, /agent workspace/i);
  assert.match(domains, /external integrations/i);
  assert.match(domains, /inventory alerts/i);
  assert.match(domains, /products/i);
  assert.match(domains, /orders/i);
  assert.match(domains, /invoices/i);
  assert.match(domains, /warehouses/i);
  assert.match(domains, /regions/i);
  assert.match(domains, /sales-routes/i);
});

test('OpenAPI baseline keeps legacy company dashboard alias and preferred alias', () => {
  const openApi = JSON.parse(read(openApiPath));

  const legacyAlias = openApi.paths['/api/companies/root/dashboard']?.get;
  const preferredAlias = openApi.paths['/api/companies/company/dashboard']?.get;

  assert.ok(legacyAlias);
  assert.ok(preferredAlias);
  assert.match(legacyAlias.summary, /legacy.*compañía|legacy.*compania/i);
  assert.match(legacyAlias.description, /no un dashboard root global/i);
  assert.equal(legacyAlias['x-compatibility']?.status, 'legacy-alias');
  assert.equal(legacyAlias['x-compatibility']?.preferredPath, '/api/companies/company/dashboard');
  assert.match(preferredAlias.summary, /preferido.*compañía|preferido.*compania/i);
});

test('OpenAPI baseline covers expanded auth, client, agent, integration and phase-4 operational surfaces', () => {
  const openApi = JSON.parse(read(openApiPath));

  const requiredOperations = [
    ['/api/auth/login', 'post'],
    ['/api/auth/me', 'get'],
    ['/api/companies', 'get'],
    ['/api/companies', 'post'],
    ['/api/companies/root/companies', 'get'],
    ['/api/companies/root/companies', 'post'],
    ['/api/roles/permissions', 'get'],
    ['/api/roles/company', 'get'],
    ['/api/roles/company', 'post'],
    ['/api/users/company', 'post'],
    ['/api/clients/company', 'get'],
    ['/api/clients/classifications/company', 'get'],
    ['/api/clients/document-types', 'get'],
    ['/api/clients/company/{clientId}/stores', 'post'],
    ['/api/clients/{clientId}/references', 'post'],
    ['/api/clients', 'post'],
    ['/api/clients/{clientId}/documents/{documentId}/download', 'get'],
    ['/api/agent/dashboard', 'get'],
    ['/api/agent/stores/{storeId}/orders', 'post'],
    ['/api/geocoding/search', 'get'],
    ['/api/taxpayers/lookup', 'get'],
    ['/api/products', 'get'],
    ['/api/products/import', 'post'],
    ['/api/orders', 'post'],
    ['/api/invoices', 'get'],
    ['/api/invoices/inconsistencies', 'get'],
    ['/api/payments/{id}/receipts/{receiptId}/download', 'get'],
    ['/api/inventory/stocks', 'get'],
    ['/api/inventory/movements', 'get'],
    ['/api/inventory/entries', 'post'],
    ['/api/inventory/lots/{id}/qa', 'patch'],
    ['/api/inventory/adjustments', 'post'],
    ['/api/warehouses/company', 'get'],
    ['/api/regions/company/{regionId}/subregions', 'post'],
    ['/api/sales-routes/company/{routeId}', 'put'],
    ['/api/sales-routes/company/agents/{userId}/goals', 'put'],
  ];

  for (const [apiPath, method] of requiredOperations) {
    assert.ok(openApi.paths[apiPath]?.[method], `Missing ${method.toUpperCase()} ${apiPath} in runtime baseline OpenAPI`);
  }
  assert.equal(openApi.paths['/api/auth/login'].post.security, undefined);
  assert.equal(openApi.paths['/api/clients'].post['x-compatibility']?.status, 'legacy-alias');
  assert.equal(openApi.paths['/api/companies'].get['x-governance']?.actorScope, 'global-root');
  assert.equal(openApi.paths['/api/companies'].post['x-governance']?.routePolicy, 'company.create-global');
  assert.equal(openApi.paths['/api/companies/root/companies'].post['x-governance']?.serviceRevalidation, 'company.service.js global-root governance check');
  assert.equal(openApi.paths['/api/roles/permissions'].get['x-governance']?.routePolicy, 'role.permissions.list');
  assert.equal(openApi.paths['/api/roles/company'].get['x-governance']?.actorScope, 'company-admin');
  assert.equal(openApi.paths['/api/roles/company'].post['x-governance']?.serviceRevalidation, 'role.service.js company-role governance evaluation');
  assert.equal(openApi.paths['/api/payments/{id}'].delete['x-compatibility']?.status, 'compatibility-delete-reverse');
  assert.match(openApi.paths['/api/geocoding/search'].get.summary, /throttle/i);
  assert.match(openApi.paths['/api/taxpayers/lookup'].get.summary, /throttle/i);
});

test('every covered OpenAPI operation matches a mounted runtime route', () => {
  const openApi = JSON.parse(read(openApiPath));
  const appSource = read(appPath);

  for (const [apiPath, operations] of Object.entries(openApi.paths)) {
    for (const [method, operation] of Object.entries(operations)) {
      const runtimeSource = operation['x-runtime-source'];
      assert.ok(runtimeSource, `${method.toUpperCase()} ${apiPath} must declare x-runtime-source`);
      assert.ok(runtimeSource.mountPath, `${method.toUpperCase()} ${apiPath} must declare mountPath`);
      assert.ok(runtimeSource.routeFile, `${method.toUpperCase()} ${apiPath} must declare routeFile`);
      assert.ok(runtimeSource.expressPath, `${method.toUpperCase()} ${apiPath} must declare expressPath`);

      assert.match(
        appSource,
        new RegExp(`app\\.use\\('${escapeRegExp(runtimeSource.mountPath)}',`),
        `${method.toUpperCase()} ${apiPath} mount path drifted in src/app.js`,
      );

      const routeFilePath = path.join(__dirname, '..', runtimeSource.routeFile);
      const routeSource = read(routeFilePath);
      assert.match(
        routeSource,
        buildRouteRegex(method, runtimeSource.expressPath),
        `${method.toUpperCase()} ${apiPath} drifted in ${runtimeSource.routeFile}`,
      );
    }
  }
});
