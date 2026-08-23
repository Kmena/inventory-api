const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appPath = path.join(__dirname, '..', 'src', 'app.js');
const openApiPath = path.join(__dirname, '..', 'docs', 'openapi', 'runtime-baseline.openapi.json');
const runtimeCatalogPath = path.join(__dirname, '..', 'docs', 'runtime-endpoint-catalog.md');
const rootRuntimeContractPath = path.join(__dirname, '..', 'src', 'public', 'root', 'runtime-contract.js');
const rootRegistryPath = path.join(__dirname, '..', 'src', 'public', 'root', 'registry.js');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('RFQ runtime governance artifacts cover approved API routes and root runtime surfaces', () => {
  const appSource = read(appPath);
  const openApi = JSON.parse(read(openApiPath));
  const runtimeCatalog = read(runtimeCatalogPath);

  const requiredOperations = [
    ['/api/procurement/requests/{id}/rfq-invitations', 'get', '/api/procurement', 'src/routes/procurement-rfq.routes.js', '/requests/:id/rfq-invitations'],
    ['/api/procurement/requests/{id}/rfq-invitations', 'post', '/api/procurement', 'src/routes/procurement-rfq.routes.js', '/requests/:id/rfq-invitations'],
    ['/api/procurement/rfq-invitations/{id}/refresh-template', 'post', '/api/procurement', 'src/routes/procurement-rfq.routes.js', '/rfq-invitations/:id/refresh-template'],
    ['/api/procurement/rfq-invitations/{id}/cancel', 'post', '/api/procurement', 'src/routes/procurement-rfq.routes.js', '/rfq-invitations/:id/cancel'],
    ['/api/procurement/rfq-invitations/{id}/manual-response', 'post', '/api/procurement', 'src/routes/procurement-rfq.routes.js', '/rfq-invitations/:id/manual-response'],
    ['/api/procurement/rfq-tracking', 'get', '/api/procurement', 'src/routes/procurement-rfq.routes.js', '/rfq-tracking'],
    ['/api/public/supplier-quotations/{token}', 'get', '/api/public/supplier-quotations', 'src/routes/public-supplier-quotation.routes.js', '/:token'],
    ['/api/public/supplier-quotations/{token}/response', 'post', '/api/public/supplier-quotations', 'src/routes/public-supplier-quotation.routes.js', '/:token/response'],
  ];

  assert.match(appSource, /procurementRfqRouter/);
  assert.match(appSource, /publicSupplierQuotationRouter/);

  for (const [apiPath, method, mountPath, routeFile, expressPath] of requiredOperations) {
    const operation = openApi.paths[apiPath]?.[method];
    assert.ok(operation, `Missing ${method.toUpperCase()} ${apiPath} in RFQ OpenAPI baseline`);
    assert.equal(operation['x-runtime-source']?.mountPath, mountPath);
    assert.equal(operation['x-runtime-source']?.routeFile, routeFile);
    assert.equal(operation['x-runtime-source']?.expressPath, expressPath);
  }

  assert.match(openApi.paths['/api/public/supplier-quotations/{token}'].get.summary, /throttle/i);
  assert.match(openApi.paths['/api/public/supplier-quotations/{token}/response'].post.summary, /throttle/i);
  assert.match(runtimeCatalog, /\/api\/procurement\/rfq-tracking/);
  assert.match(runtimeCatalog, /\/api\/public\/supplier-quotations\/:token/);
  assert.match(runtimeCatalog, /#seguimiento_cotizaciones/);
});

test('root runtime contract declares RFQ tracking browser modules', () => {
  const browserWindow = {};
  const context = vm.createContext({ window: browserWindow, Map });
  browserWindow.window = browserWindow;

  vm.runInContext(read(rootRegistryPath), context, { filename: 'registry.js' });
  vm.runInContext(read(rootRuntimeContractPath), context, { filename: 'runtime-contract.js' });

  const runtimeContract = browserWindow.RootShell.require('runtimeContract');
  const loaderPaths = runtimeContract.getLoaderScriptPaths().join('\n');

  assert.match(loaderPaths, /\/root\/rfq-tracking-api\.js/);
  assert.match(loaderPaths, /\/root\/views\/rfq-tracking-admin\.renderers\.js/);
  assert.match(loaderPaths, /\/root\/views\/rfq-tracking-admin\.js/);
  assert.equal(runtimeContract.getScriptContract('/root/rfq-tracking-api.js')?.registers.includes('rfqTrackingApi'), true);
  assert.equal(runtimeContract.getScriptContract('/root/views/rfq-tracking-admin.js')?.registers.includes('views.rfqTrackingAdmin'), true);
});
