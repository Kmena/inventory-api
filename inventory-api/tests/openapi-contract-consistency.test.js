const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appPath = path.join(__dirname, '..', 'src', 'app.js');
const openApiPath = path.join(__dirname, '..', 'docs', 'openapi', 'runtime-baseline.openapi.json');

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
  const domains = JSON.stringify(openApi['x-coverage-scope'].domains);

  assert.equal(openApi.openapi, '3.0.3');
  assert.equal(openApi.info.title, 'inventory-api runtime baseline');
  assert.equal(openApi['x-coverage-scope'].coverage, 'partial');
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
  assert.match(preferredAlias.summary, /preferido.*compañía|preferido.*compania/i);
});

test('OpenAPI baseline covers expanded auth, client, agent, integration and phase-2 operational surfaces', () => {
  const openApi = JSON.parse(read(openApiPath));

  assert.ok(openApi.paths['/api/auth/login']?.post);
  assert.ok(openApi.paths['/api/auth/me']?.get);
  assert.ok(openApi.paths['/api/roles/company']?.get);
  assert.ok(openApi.paths['/api/users/company']?.post);
  assert.ok(openApi.paths['/api/clients/company']?.get);
  assert.ok(openApi.paths['/api/clients/{clientId}/documents/{documentId}/download']?.get);
  assert.ok(openApi.paths['/api/agent/dashboard']?.get);
  assert.ok(openApi.paths['/api/agent/stores/{storeId}/orders']?.post);
  assert.ok(openApi.paths['/api/geocoding/search']?.get);
  assert.ok(openApi.paths['/api/taxpayers/lookup']?.get);
  assert.ok(openApi.paths['/api/products']?.get);
  assert.ok(openApi.paths['/api/products/import']?.post);
  assert.ok(openApi.paths['/api/orders']?.post);
  assert.ok(openApi.paths['/api/invoices']?.get);
  assert.ok(openApi.paths['/api/invoices/inconsistencies']?.get);
  assert.ok(openApi.paths['/api/warehouses/company']?.get);
  assert.ok(openApi.paths['/api/regions/company/{regionId}/subregions']?.post);
  assert.ok(openApi.paths['/api/sales-routes/company/{routeId}']?.put);
  assert.ok(openApi.paths['/api/sales-routes/company/agents/{userId}/goals']?.put);
  assert.equal(openApi.paths['/api/auth/login'].post.security, undefined);
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
