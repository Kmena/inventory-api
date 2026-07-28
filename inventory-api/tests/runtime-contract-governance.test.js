const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { repositoryRoot } = require('./internal-docs-optional');
const appPath = path.join(repositoryRoot, 'src', 'app.js');
const openApiPath = path.join(repositoryRoot, 'docs', 'openapi', 'runtime-baseline.openapi.json');
const manifestPath = path.join(repositoryRoot, 'docs', 'runtime-contract-manifest.json');
const runtimeCatalogPath = path.join(repositoryRoot, 'docs', 'runtime-endpoint-catalog.md');

const ROUTER_FILE_BY_VARIABLE = Object.freeze({
  healthRouter: 'src/routes/health.routes.js',
  authRouter: 'src/routes/auth.routes.js',
  companyRouter: 'src/routes/company.routes.js',
  roleRouter: 'src/routes/role.routes.js',
  userRouter: 'src/routes/user.routes.js',
  clientRouter: 'src/routes/client.routes.js',
  productRouter: 'src/routes/product.routes.js',
  orderRouter: 'src/routes/order.routes.js',
  invoiceRouter: 'src/routes/invoice.routes.js',
  paymentRouter: 'src/routes/payment.routes.js',
  inventoryRouter: 'src/routes/inventory.routes.js',
  warehouseRouter: 'src/routes/warehouse.routes.js',
  regionRouter: 'src/routes/region.routes.js',
  salesRouteRouter: 'src/routes/sales-route.routes.js',
  agentRouter: 'src/routes/agent.routes.js',
  taxpayerRouter: 'src/routes/taxpayer.routes.js',
  geocodingRouter: 'src/routes/geocoding.routes.js',
  economicActivityRouter: 'src/routes/economic-activity.routes.js',
});

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function toRouteKey({ method, mountPath, expressPath, routeFile }) {
  return `${method.toUpperCase()} ${mountPath} ${expressPath} ${routeFile}`;
}

function discoverMountedRouterOperations() {
  const appSource = read(appPath);
  const mountRegex = /app\.use\('([^']+)',[^\n]*?(\w+Router)\);/g;
  const routeRegex = /router\.(get|post|put|patch|delete)\(\s*'([^']+)'/g;
  const operations = [];

  for (const mountMatch of appSource.matchAll(mountRegex)) {
    const mountPath = mountMatch[1];
    const routerVariable = mountMatch[2];
    const routeFile = ROUTER_FILE_BY_VARIABLE[routerVariable];
    assert.ok(routeFile, `Missing route file mapping for ${routerVariable}`);

    const routeSource = read(path.join(repositoryRoot, routeFile));
    for (const routeMatch of routeSource.matchAll(routeRegex)) {
      operations.push({
        method: routeMatch[1].toUpperCase(),
        mountPath,
        expressPath: routeMatch[2],
        routeFile,
      });
    }
  }

  return operations;
}

function readCoveredOpenApiOperations() {
  const openApi = JSON.parse(read(openApiPath));
  const operations = [];

  for (const pathItem of Object.values(openApi.paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      const runtimeSource = operation['x-runtime-source'];
      operations.push({
        method: method.toUpperCase(),
        mountPath: runtimeSource.mountPath,
        expressPath: runtimeSource.expressPath,
        routeFile: runtimeSource.routeFile,
      });
    }
  }

  return operations;
}

test('runtime contract manifest exhaustively classifies mounted router operations', () => {
  const runtimeOperations = discoverMountedRouterOperations();
  const coveredOperations = readCoveredOpenApiOperations();
  const manifest = JSON.parse(read(manifestPath));
  const excludedOperations = manifest.excludedOperations || [];

  const runtimeKeys = new Set(runtimeOperations.map(toRouteKey));
  const coveredKeys = new Set(coveredOperations.map(toRouteKey));
  const excludedKeys = new Set(excludedOperations.map(toRouteKey));

  assert.equal(manifest.version, 1);
  assert.equal(manifest.classificationMode, 'openapi-covered-plus-explicit-exclusions');
  assert.equal(manifest.openApiArtifact, 'docs/openapi/runtime-baseline.openapi.json');
  assert.equal(manifest.criticalContractMatrixArtifact, 'docs/critical-contract-matrix.json');
  assert.ok(manifest.classificationRule);
  assert.ok(manifest.criticalityRule);

  for (const operation of excludedOperations) {
    assert.equal(operation.contractStatus, 'intentionally-excluded');
    assert.ok(operation.reasonCode, `${toRouteKey(operation)} must declare a reasonCode`);
    assert.ok(operation.reason, `${toRouteKey(operation)} must declare a reason`);
    assert.ok(runtimeKeys.has(toRouteKey(operation)), `${toRouteKey(operation)} must still exist in mounted runtime`);
  }

  for (const key of coveredKeys) {
    assert.ok(!excludedKeys.has(key), `${key} cannot be both covered by OpenAPI and explicitly excluded`);
  }

  const classifiedKeys = new Set([...coveredKeys, ...excludedKeys]);
  const unclassified = runtimeOperations.filter((operation) => !classifiedKeys.has(toRouteKey(operation)));
  assert.deepEqual(unclassified, []);

  assert.equal(runtimeOperations.length, classifiedKeys.size);
  assert.ok(manifest.nonRouteRuntimeSurfaces?.some((surface) => (
    surface.surface === 'express.static(src/public)'
    && surface.contractStatus === 'intentionally-excluded'
  )));
});

test('runtime contract companion artifacts stay cross-linked and human-readable', () => {
  const openApi = JSON.parse(read(openApiPath));
  const manifest = JSON.parse(read(manifestPath));
  const runtimeCatalog = read(runtimeCatalogPath);

  assert.equal(openApi.info.version, '0.5.0');
  assert.equal(openApi['x-coverage-scope']?.contractClassification?.excludedOperationsArtifact, 'docs/runtime-contract-manifest.json');
  assert.equal(openApi['x-coverage-scope']?.contractClassification?.runtimeCatalogArtifact, 'docs/runtime-endpoint-catalog.md');
  assert.equal(openApi['x-coverage-scope']?.contractClassification?.criticalContractMatrixArtifact, 'docs/critical-contract-matrix.json');
  assert.match(runtimeCatalog, /No se aceptan rutas montadas sin clasificar/i);
  assert.match(runtimeCatalog, /runtime-contract-manifest\.json/);
  assert.match(runtimeCatalog, /critical-contract-matrix\.json/);
  assert.match(runtimeCatalog, /express\.static\(src\/public\)/);
  assert.ok((manifest.excludedOperations || []).length > 0);
});
