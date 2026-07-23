const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { repositoryRoot, skipIfMissing } = require('./internal-docs-optional');
const restoreBaselinePath = path.join(repositoryRoot, 'internal-docs', 'restore-readiness-baseline.md');
const productionBaselinePath = path.join(repositoryRoot, 'internal-docs', 'production-baseline.md');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('restore readiness baseline documents the versioned contract and explicit limits', (t) => {
  if (skipIfMissing(t, ['internal-docs/restore-readiness-baseline.md'], 'internal-docs restore readiness baseline is optional in public repo mode')) {
    return;
  }

  const restoreBaselineSource = read(restoreBaselinePath);

  assert.match(restoreBaselineSource, /RR-001/);
  assert.match(restoreBaselineSource, /RR-004/);
  assert.match(restoreBaselineSource, /RR-005/);
  assert.match(restoreBaselineSource, /backup\.sql\.sha256/);
  assert.match(restoreBaselineSource, /_prisma_migrations/);
  assert.match(restoreBaselineSource, /No ejecuta automáticamente un restore real/);
  assert.match(restoreBaselineSource, /(readiness|Smoke workflow|\.env\.production)/i);
});

test('production baseline references the restore readiness validation command and companion document', (t) => {
  if (skipIfMissing(t, ['internal-docs/production-baseline.md'], 'internal-docs production baseline is optional in public repo mode')) {
    return;
  }

  const baselineSource = read(productionBaselinePath);

  assert.match(baselineSource, /npm run validate:restore-readiness/);
  assert.match(baselineSource, /restore-readiness-baseline\.md/);
  assert.match(baselineSource, /(backup\.sql\.sha256|restore-readiness-baseline\.md)/);
});

test('validate-restore-readiness passes when restore evidence remains versioned and aligned', (t) => {
  if (skipIfMissing(t, ['internal-docs/production-baseline.md', 'internal-docs/restore-readiness-baseline.md', 'internal-docs/production-operations-runbook.md'], 'internal-docs restore readiness artifacts are optional in public repo mode')) {
    return;
  }

  const result = spawnSync('node', ['scripts/validate-restore-readiness.js'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Restore readiness validation passed/);
});
