const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { repositoryRoot } = require('./internal-docs-optional');
const matrixPath = path.join(repositoryRoot, 'docs', 'critical-contract-matrix.json');
const openApiPath = path.join(repositoryRoot, 'docs', 'openapi', 'runtime-baseline.openapi.json');
const manifestPath = path.join(repositoryRoot, 'docs', 'runtime-contract-manifest.json');
const catalogPath = path.join(repositoryRoot, 'docs', 'runtime-endpoint-catalog.md');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function toOpenApiKey(method, apiPath) {
  return `${method.toUpperCase()} ${apiPath}`;
}

function toManifestKey(operation) {
  return `${operation.method.toUpperCase()} ${operation.mountPath}`;
}

function buildCoveredOpenApiKeySet(openApi) {
  const covered = new Set();

  for (const [apiPath, pathItem] of Object.entries(openApi.paths)) {
    for (const method of Object.keys(pathItem)) {
      covered.add(toOpenApiKey(method, apiPath));
    }
  }

  return covered;
}

test('critical contract matrix resolves the minimum critical surface with approved Option B', () => {
  const matrix = readJson(matrixPath);
  const openApi = readJson(openApiPath);
  const manifest = readJson(manifestPath);
  const catalog = readText(catalogPath);

  assert.equal(matrix.version, 1);
  assert.equal(matrix.task, 'P8 TASK-002');
  assert.equal(matrix.policy.approvedOption, 'B');
  assert.equal(matrix.summary.optionSatisfied, 'B');
  assert.equal(matrix.summary.totalRoutes, matrix.routes.length);

  const criticalRoutes = matrix.routes.filter((route) => route.criticality === 'critical');
  const supportingRoutes = matrix.routes.filter((route) => route.criticality !== 'critical');
  const criticalCovered = criticalRoutes.filter((route) => route.contractStatus === 'covered-by-openapi');
  const criticalExcluded = criticalRoutes.filter((route) => route.contractStatus === 'explicitly-excluded-with-justification');
  const supportingExcluded = supportingRoutes.filter((route) => route.contractStatus === 'explicitly-excluded-with-justification');

  assert.equal(matrix.summary.criticalRoutes, criticalRoutes.length);
  assert.equal(matrix.summary.criticalCoveredByOpenApi, criticalCovered.length);
  assert.equal(matrix.summary.criticalExplicitlyExcluded, criticalExcluded.length);
  assert.equal(matrix.summary.supportingRoutes, supportingRoutes.length);
  assert.equal(matrix.summary.supportingExplicitlyExcluded, supportingExcluded.length);
  assert.equal(matrix.summary.criticalResolvedPercentage, 100);

  const surfaces = new Set(criticalRoutes.map((route) => route.surface));
  for (const requiredSurface of matrix.requiredCriticalSurfaces) {
    assert.ok(surfaces.has(requiredSurface), `Missing critical surface ${requiredSurface}`);
  }

  assert.equal(openApi['x-coverage-scope']?.contractClassification?.criticalContractMatrixArtifact, 'docs/critical-contract-matrix.json');
  assert.equal(manifest.criticalContractMatrixArtifact, 'docs/critical-contract-matrix.json');
  assert.match(catalog, /Option B satisfied/i);

  const coveredOpenApiKeys = buildCoveredOpenApiKeySet(openApi);
  const manifestKeys = new Set((manifest.excludedOperations || []).map(toManifestKey));

  for (const route of matrix.routes) {
    assert.ok(route.surface, `${route.method} ${route.path} must declare a surface`);
    assert.ok(route.justification, `${route.method} ${route.path} must declare a justification`);
    assert.ok(route.evidence, `${route.method} ${route.path} must declare evidence`);

    if (route.contractStatus === 'covered-by-openapi') {
      assert.ok(
        coveredOpenApiKeys.has(toOpenApiKey(route.method, route.path)),
        `${route.method} ${route.path} must be covered by factual OpenAPI`,
      );
      assert.equal(route.evidence.openApiPath, route.path);
    } else {
      assert.equal(route.contractStatus, 'explicitly-excluded-with-justification');
      assert.ok(route.preferredPath, `${route.method} ${route.path} excluded routes must declare preferredPath`);
      assert.ok(route.evidence.manifestOperation, `${route.method} ${route.path} excluded routes must declare manifestOperation evidence`);
      assert.ok(
        manifestKeys.has(toManifestKey(route.evidence.manifestOperation)),
        `${route.method} ${route.path} must match an explicit manifest exclusion`,
      );
    }
  }

  assert.deepEqual(
    supportingExcluded.map((route) => `${route.method} ${route.path}`),
    ['GET /api/clients'],
  );
  assert.deepEqual(matrix.requiredCriticalSurfaces, ['auth', 'governance-admin']);
  assert.equal(criticalRoutes.filter((route) => route.surface === 'governance-admin').length, 7);
});
