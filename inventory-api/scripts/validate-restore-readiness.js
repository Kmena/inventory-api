const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.join(__dirname, '..');
const { internalDocsExist, writeSkip } = require('./internal-docs-optional');
const runbookPath = path.join(repositoryRoot, 'internal-docs', 'production-operations-runbook.md');
const baselineDocPath = path.join(repositoryRoot, 'internal-docs', 'production-baseline.md');
const restoreBaselinePath = path.join(repositoryRoot, 'internal-docs', 'restore-readiness-baseline.md');
const composePath = path.join(repositoryRoot, 'docker-compose.prod.yml');
const workflowPath = path.join(repositoryRoot, '.github', 'workflows', 'operational-smoke.yml');
const healthRoutePath = path.join(repositoryRoot, 'src', 'routes', 'health.routes.js');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function assertPattern(source, pattern, message, failures) {
  if (!pattern.test(source)) {
    failures.push(message);
  }
}

function main() {
  if (!internalDocsExist([
    'internal-docs/production-operations-runbook.md',
    'internal-docs/production-baseline.md',
    'internal-docs/restore-readiness-baseline.md',
  ])) {
    writeSkip('Restore readiness validation skipped: internal-docs artifacts are not present.');
    return;
  }

  const failures = [];

  for (const requiredPath of [runbookPath, baselineDocPath, restoreBaselinePath, composePath, workflowPath, healthRoutePath]) {
    if (!fs.existsSync(requiredPath)) {
      failures.push(`Missing required restore-readiness file: ${path.relative(repositoryRoot, requiredPath)}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Restore readiness validation failed:\n- ${failures.join('\n- ')}`);
  }

  const runbookSource = read(runbookPath);
  const baselineSource = read(baselineDocPath);
  const restoreBaselineSource = read(restoreBaselinePath);
  const composeSource = read(composePath);
  const workflowSource = read(workflowPath);
  const healthRouteSource = read(healthRoutePath);

  assertPattern(runbookSource, /## Procedimiento de backup lógico/, 'Runbook must preserve logical backup procedure.', failures);
  assertPattern(runbookSource, /pg_dump/, 'Runbook must preserve pg_dump backup command.', failures);
  assertPattern(runbookSource, /## Procedimiento de restore validation/, 'Runbook must preserve restore validation procedure.', failures);
  assertPattern(runbookSource, /psql/, 'Runbook must preserve psql restore command.', failures);
  assertPattern(runbookSource, /sha256sum/, 'Runbook must preserve backup checksum verification.', failures);
  assertPattern(runbookSource, /backup\.sql\.sha256/, 'Runbook must preserve backup checksum artifact naming.', failures);
  assertPattern(runbookSource, /_prisma_migrations/, 'Runbook must preserve post-restore migration traceability check.', failures);
  assertPattern(runbookSource, /## Checklist posterior al restore/, 'Runbook must preserve post-restore checklist.', failures);

  assertPattern(baselineSource, /npm run validate:restore-readiness/, 'Production baseline must document validate:restore-readiness.', failures);
  assertPattern(baselineSource, /restore-readiness-baseline\.md/, 'Production baseline must reference restore-readiness-baseline.md.', failures);
  assertPattern(restoreBaselineSource, /RR-001/, 'Restore readiness baseline must declare RR-001.', failures);
  assertPattern(restoreBaselineSource, /RR-004/, 'Restore readiness baseline must declare RR-004.', failures);
  assertPattern(restoreBaselineSource, /RR-005/, 'Restore readiness baseline must declare RR-005.', failures);
  assertPattern(restoreBaselineSource, /backup\.sql\.sha256/, 'Restore readiness baseline must preserve backup integrity evidence.', failures);
  assertPattern(restoreBaselineSource, /_prisma_migrations/, 'Restore readiness baseline must preserve restore traceability evidence.', failures);
  assertPattern(restoreBaselineSource, /No ejecuta automáticamente un restore real/, 'Restore readiness baseline must preserve explicit limits.', failures);

  assertPattern(composeSource, /^\s{2}db:/m, 'Production compose must preserve db service.', failures);
  assertPattern(composeSource, /^\s{2}migrate:/m, 'Production compose must preserve migrate service.', failures);
  assertPattern(composeSource, /^\s{2}app:/m, 'Production compose must preserve app service.', failures);
  assertPattern(composeSource, /command: \["npm", "run", "prisma:deploy"\]/, 'Production compose must preserve prisma deploy migration step.', failures);
  assertPattern(composeSource, /postgres_data:/, 'Production compose must preserve postgres_data volume.', failures);
  assertPattern(composeSource, /app_storage:/, 'Production compose must preserve app_storage volume.', failures);
  assertPattern(composeSource, /condition: service_healthy/, 'Production compose must preserve service_healthy dependency.', failures);

  assertPattern(workflowSource, /npm run validate:restore-readiness/, 'Operational smoke workflow must validate restore readiness.', failures);
  assertPattern(workflowSource, /rm -f \.env\.production/, 'Operational smoke workflow must clean up the temporary production env file.', failures);
  assertPattern(healthRouteSource, /router\.get\('\/ready'/, 'Health routes must preserve /health/ready endpoint.', failures);
  assertPattern(healthRouteSource, /checkDatabaseReadiness/, 'Readiness route must preserve database readiness check.', failures);

  if (failures.length > 0) {
    throw new Error(`Restore readiness validation failed:\n- ${failures.join('\n- ')}`);
  }

  process.stdout.write('Restore readiness validation passed.\n');
}

if (require.main === module) {
  main();
}

module.exports = {
  main,
};
