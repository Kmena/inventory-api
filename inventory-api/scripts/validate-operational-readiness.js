const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.join(__dirname, '..');
const { internalDocsExist, writeSkip } = require('./internal-docs-optional');
const runbookPath = path.join(repositoryRoot, 'internal-docs', 'production-operations-runbook.md');
const productionBaselinePath = path.join(repositoryRoot, 'internal-docs', 'production-baseline.md');
const workflowPath = path.join(repositoryRoot, '.github', 'workflows', 'operational-smoke.yml');
const loggingPath = path.join(repositoryRoot, 'src', 'lib', 'logging.js');
const requestContextPath = path.join(repositoryRoot, 'src', 'lib', 'request-context.js');

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
  ])) {
    writeSkip('Operational readiness validation skipped: internal-docs artifacts are not present.');
    return;
  }

  const failures = [];

  for (const requiredPath of [runbookPath, productionBaselinePath, workflowPath, loggingPath, requestContextPath]) {
    if (!fs.existsSync(requiredPath)) {
      failures.push(`Missing required operational readiness file: ${path.relative(repositoryRoot, requiredPath)}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Operational readiness validation failed:\n- ${failures.join('\n- ')}`);
  }

  const runbookSource = read(runbookPath);
  const productionBaselineSource = read(productionBaselinePath);
  const workflowSource = read(workflowPath);
  const loggingSource = read(loggingPath);
  const requestContextSource = read(requestContextPath);

  assertPattern(runbookSource, /## Procedimiento de backup lógico/, 'Runbook must document logical backup procedure.', failures);
  assertPattern(runbookSource, /pg_dump/, 'Runbook must include pg_dump backup command.', failures);
  assertPattern(runbookSource, /## Procedimiento de restore validation/, 'Runbook must document restore validation.', failures);
  assertPattern(runbookSource, /psql/, 'Runbook must include psql restore command.', failures);
  assertPattern(runbookSource, /## Señales operativas mínimas versionadas/, 'Runbook must document versioned operational signals.', failures);
  assertPattern(runbookSource, /requestId/, 'Runbook must reference requestId traceability.', failures);
  assertPattern(runbookSource, /\/health\/ready/, 'Runbook must reference readiness verification.', failures);
  assertPattern(runbookSource, /## Medidas extra de hardening operativo cerradas en esta ola/, 'Runbook must document extra operational hardening measures.', failures);
  assertPattern(runbookSource, /sha256sum/, 'Runbook must preserve backup integrity hardening.', failures);
  assertPattern(runbookSource, /_prisma_migrations/, 'Runbook must preserve restore traceability hardening.', failures);
  assertPattern(runbookSource, /no hay backups automáticos programados/i, 'Runbook must preserve explicit operational limits.', failures);

  assertPattern(productionBaselineSource, /production-operations-runbook\.md/, 'Production baseline must reference the operations runbook.', failures);
  assertPattern(productionBaselineSource, /validate:operational-readiness/, 'Production baseline must include operational readiness validation command.', failures);
  assertPattern(productionBaselineSource, /(## Medidas extra de hardening operativo versionadas|observabilidad mínima|señales mínimas versionadas)/i, 'Production baseline must document operational hardening or observability limits.', failures);

  assertPattern(workflowSource, /npm run validate:operational-readiness/, 'Operational smoke workflow must validate operational readiness.', failures);
  assertPattern(workflowSource, /rm -f \.env\.production/, 'Operational smoke workflow must clean up temporary production env materialization.', failures);
  assertPattern(loggingSource, /requestId/, 'Structured logging baseline must preserve requestId fields.', failures);
  assertPattern(requestContextSource, /requestId/, 'Request context middleware must preserve requestId generation.', failures);

  if (failures.length > 0) {
    throw new Error(`Operational readiness validation failed:\n- ${failures.join('\n- ')}`);
  }

  process.stdout.write('Operational readiness validation passed.\n');
}

if (require.main === module) {
  main();
}

module.exports = {
  main,
};
