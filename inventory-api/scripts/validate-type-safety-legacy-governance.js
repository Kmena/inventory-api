const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.join(__dirname, '..');
const { internalDocsExist, writeSkip } = require('./internal-docs-optional');
const typeSafetyPath = path.join(repositoryRoot, 'docs', 'type-safety-debt-register.json');
const legacyInventoryPath = path.join(repositoryRoot, 'docs', 'legacy-governance-inventory.json');
const runtimeManifestPath = path.join(repositoryRoot, 'internal-docs', 'runtime-contract-manifest.json');
const openApiPath = path.join(repositoryRoot, 'internal-docs', 'openapi', 'runtime-baseline.openapi.json');
const tsconfigPath = path.join(repositoryRoot, 'tsconfig.typecheck.json');
const rootDashboardSourcePath = path.join(repositoryRoot, 'src', 'public', 'root', 'dashboard.js');
const rootCompaniesSourcePath = path.join(repositoryRoot, 'src', 'public', 'root', 'index.js');
const rootClientsSourcePath = path.join(repositoryRoot, 'src', 'public', 'root', 'clients.js');

const EXPECTED_TS_NOCHECK_FILES = [
  'src/repositories/sales-route.repository.js',
  'src/schemas/client.schema.js',
  'src/schemas/warehouse.schema.js',
];

const EXPECTED_LEGACY_SURFACES = [
  'public-runtime-static-surface',
  'clients-list-legacy-alias',
  'clients-create-legacy-alias',
  'companies-root-dashboard-legacy-alias',
  'companies-global-list-legacy-shape',
  'companies-global-create-legacy-shape',
  'payments-delete-compatibility-reverse',
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function findTsNoCheckFiles(directory) {
  const matches = [];

  function visit(currentDirectory) {
    for (const entry of fs.readdirSync(currentDirectory, { withFileTypes: true })) {
      const fullPath = path.join(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
        continue;
      }

      if (!entry.name.endsWith('.js')) {
        continue;
      }

      const source = read(fullPath);
      if (source.includes('@ts-nocheck')) {
        matches.push(path.relative(repositoryRoot, fullPath).replace(/\\/g, '/'));
      }
    }
  }

  visit(directory);
  return matches.sort();
}

function assert(condition, message, failures) {
  if (!condition) {
    failures.push(message);
  }
}

function validateTypeSafetyRegister(failures) {
  const artifact = readJson(typeSafetyPath);
  const tsconfig = readJson(tsconfigPath);
  const actualFiles = findTsNoCheckFiles(path.join(repositoryRoot, 'src'));
  const documentedFiles = (artifact.typeSafetyExceptions || []).map((entry) => entry.filePath).sort();

  assert(artifact.version === 1, 'Type-safety register version must be 1.', failures);
  assert(artifact.generatedFor === 'p8-audit-9-5-closure', 'Type-safety register generatedFor must be p8-audit-9-5-closure.', failures);
  assert(JSON.stringify(actualFiles) === JSON.stringify(EXPECTED_TS_NOCHECK_FILES), 'Actual @ts-nocheck files under src/ drifted from the governed set.', failures);
  assert(JSON.stringify(documentedFiles) === JSON.stringify(EXPECTED_TS_NOCHECK_FILES), 'Documented @ts-nocheck files must match the governed set.', failures);
  assert(artifact.summary?.residualTsNoCheckCount === EXPECTED_TS_NOCHECK_FILES.length, 'Type-safety register residual count must match the governed set.', failures);

  const tsconfigExclude = tsconfig.exclude || [];
  assert(tsconfigExclude.includes('src/repositories/sales-route.repository.js'), 'Typecheck gate must still exclude sales-route.repository.js while it stays governed.', failures);
  assert(tsconfigExclude.includes('src/schemas/**'), 'Typecheck gate must still exclude src/schemas/** while residual schema exceptions stay governed.', failures);

  for (const filePath of EXPECTED_TS_NOCHECK_FILES) {
    const source = read(path.join(repositoryRoot, filePath));
    assert(source.startsWith('// @ts-nocheck') || source.startsWith('﻿// @ts-nocheck'), `${filePath} must keep the documented @ts-nocheck header.`, failures);
  }

  for (const entry of artifact.typeSafetyExceptions || []) {
    assert(['high', 'medium', 'low'].includes(entry.riskClass), `${entry.filePath}: riskClass must be high|medium|low.`, failures);
    assert(['keep-governed', 'reduce-now'].includes(entry.currentWaveDecision), `${entry.filePath}: currentWaveDecision must be keep-governed|reduce-now.`, failures);
    assert(['escalate-to-later-wave', 'later-wave-reduction-candidate', 'governed-residual'].includes(entry.approvedTreatment), `${entry.filePath}: approvedTreatment is invalid.`, failures);
    assert(Array.isArray(entry.governedBy) && entry.governedBy.length >= 1, `${entry.filePath}: governedBy must contain validation evidence.`, failures);
  }
}

function validateLegacyInventory(failures) {
  const artifact = readJson(legacyInventoryPath);
  const openApi = readJson(openApiPath);
  const runtimeManifest = readJson(runtimeManifestPath);
  const rootDashboardSource = read(rootDashboardSourcePath);
  const rootCompaniesSource = read(rootCompaniesSourcePath);
  const rootClientsSource = read(rootClientsSourcePath);
  const documentedSurfaceIds = (artifact.legacySurfaces || []).map((entry) => entry.surfaceId).sort();

  assert(artifact.version === 1, 'Legacy inventory version must be 1.', failures);
  assert(artifact.generatedFor === 'p8-audit-9-5-closure', 'Legacy inventory generatedFor must be p8-audit-9-5-closure.', failures);
  assert(JSON.stringify(documentedSurfaceIds) === JSON.stringify([...EXPECTED_LEGACY_SURFACES].sort()), 'Legacy inventory surface set drifted from the governed set.', failures);
  assert(artifact.summary?.totalSurfaces === EXPECTED_LEGACY_SURFACES.length, 'Legacy inventory total surface count must match the governed set.', failures);

  const manifestStaticSurface = (runtimeManifest.nonRouteRuntimeSurfaces || []).find((entry) => entry.surface === 'express.static(src/public)');
  assert(Boolean(manifestStaticSurface), 'Runtime manifest must keep express.static(src/public) as a governed non-route surface.', failures);

  const manifestLegacyClients = (runtimeManifest.excludedOperations || []).find((entry) => entry.method === 'GET' && entry.mountPath === '/api/clients');
  assert(Boolean(manifestLegacyClients), 'Runtime manifest must keep GET /api/clients as an intentional legacy exclusion.', failures);
  assert(manifestLegacyClients?.preferredOpenApiPath === '/api/clients/company', 'Legacy GET /api/clients exclusion must keep preferredOpenApiPath /api/clients/company.', failures);

  assert(openApi.paths['/api/companies/root/dashboard']?.get?.['x-compatibility']?.status === 'legacy-alias', 'OpenAPI must keep GET /api/companies/root/dashboard as legacy-alias.', failures);
  assert(openApi.paths['/api/companies']?.get?.['x-compatibility']?.status === 'legacy-global-shape', 'OpenAPI must keep GET /api/companies as legacy-global-shape.', failures);
  assert(openApi.paths['/api/companies']?.post?.['x-compatibility']?.status === 'legacy-global-shape', 'OpenAPI must keep POST /api/companies as legacy-global-shape.', failures);
  assert(openApi.paths['/api/clients']?.post?.['x-compatibility']?.status === 'legacy-alias', 'OpenAPI must keep POST /api/clients as legacy-alias.', failures);
  assert(openApi.paths['/api/payments/{id}']?.delete?.['x-compatibility']?.status === 'compatibility-delete-reverse', 'OpenAPI must keep DELETE /api/payments/{id} as compatibility-delete-reverse.', failures);

  assert(rootDashboardSource.includes('/api/companies/company/dashboard'), 'Embedded root dashboard runtime must keep the preferred company dashboard path.', failures);
  assert(!rootDashboardSource.includes('/api/companies/root/dashboard'), 'Embedded root dashboard runtime must not regress to the legacy dashboard alias.', failures);
  assert(rootCompaniesSource.includes('/api/companies/root/companies'), 'Embedded root companies runtime must keep the preferred root companies path.', failures);
  assert(!rootCompaniesSource.includes("fetch('/api/companies'"), 'Embedded root companies runtime must not consume the global legacy GET /api/companies path.', failures);
  assert(rootClientsSource.includes('/api/clients/company'), 'Embedded root clients runtime must keep the preferred company clients path.', failures);
  assert(!rootClientsSource.includes("fetch('/api/clients'"), 'Embedded root clients runtime must not consume the legacy GET /api/clients path.', failures);

  for (const entry of artifact.legacySurfaces || []) {
    assert(['preserve', 'govern', 'candidate-for-retirement-later'].includes(entry.governanceClass), `${entry.surfaceId}: invalid governanceClass.`, failures);
    assert(Array.isArray(entry.governedBy) && entry.governedBy.length >= 1, `${entry.surfaceId}: governedBy must contain validation evidence.`, failures);
  }
}

function main() {
  if (!internalDocsExist([
    'internal-docs/runtime-contract-manifest.json',
    'internal-docs/openapi/runtime-baseline.openapi.json',
  ]) || !fs.existsSync(typeSafetyPath) || !fs.existsSync(legacyInventoryPath)) {
    writeSkip('Type-safety and legacy governance validation skipped: governed artifacts are not fully present.');
    return;
  }

  const failures = [];

  validateTypeSafetyRegister(failures);
  validateLegacyInventory(failures);

  if (failures.length > 0) {
    throw new Error(`Type-safety and legacy governance validation failed:\n- ${failures.join('\n- ')}`);
  }

  process.stdout.write('Type-safety and legacy governance validation passed.\n');
}

if (require.main === module) {
  main();
}

module.exports = {
  main,
};
