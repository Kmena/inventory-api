const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { repositoryRoot, skipIfMissing } = require('./internal-docs-optional');
const workflowsRoot = path.join(repositoryRoot, '.github', 'workflows');
const productionDocPath = path.join(repositoryRoot, 'internal-docs', 'production-baseline.md');

function readWorkflow(name) {
  return fs.readFileSync(path.join(workflowsRoot, name), 'utf8');
}

test('operational smoke workflow validates production baseline inputs, compose syntax and Docker build', () => {
  const workflowSource = readWorkflow('operational-smoke.yml');

  assert.match(workflowSource, /^\s{2}operational-smoke:\s*$/m);
  assert.match(workflowSource, /npm run validate:production-baseline/);
  assert.match(workflowSource, /npm run validate:restore-readiness/);
  assert.match(workflowSource, /npm run validate:operational-readiness/);
  assert.match(workflowSource, /cat > \.env\.production <<EOF/);
  assert.match(workflowSource, /rm -f \.env\.production/);
  assert.match(workflowSource, /docker compose -f docker-compose\.prod\.yml config/);
  assert.match(workflowSource, /docker build -t inventory-api:operational-smoke \./);
  assert.doesNotMatch(workflowSource, /deploy/i);
});

test('production baseline documentation includes the operational smoke workflow and local smoke checklist', (t) => {
  if (skipIfMissing(t, ['internal-docs/production-baseline.md'], 'internal-docs production baseline is optional in public repo mode')) {
    return;
  }

  const docSource = fs.readFileSync(productionDocPath, 'utf8');

  assert.match(docSource, /operational-smoke\.yml/);
  assert.match(docSource, /(limpieza explícita posterior del `\.env\.production` temporal|materialización temporal de `\.env\.production`)/i);
  assert.match(docSource, /docker compose -f docker-compose\.prod\.yml config/);
  assert.match(docSource, /docker build -t inventory-api:operational-smoke \./);
});

test('windows Prisma workflow stays dedicated to npm ci plus build on windows-latest while publishing auditable evidence', () => {
  const workflowSource = readWorkflow('windows-prisma-build.yml');

  assert.match(workflowSource, /^\s{2}windows-prisma-build:\s*$/m);
  assert.match(workflowSource, /runs-on:\s+windows-latest/);
  assert.match(workflowSource, /node-version:\s+'20'/);
  assert.match(workflowSource, /run:\s+npm ci/);
  assert.match(workflowSource, /npm run build/);
  assert.match(workflowSource, /id:\s+prisma_build/);
  assert.match(workflowSource, /continue-on-error:\s+true/);
  assert.match(workflowSource, /GITHUB_STEP_SUMMARY/);
  assert.match(workflowSource, /actions\/upload-artifact@v4/);
  assert.match(workflowSource, /Fail workflow when guarded Prisma build fails/);
  assert.doesNotMatch(workflowSource, /npm run verify/);
});

test('validate-workflow-baseline passes when the versioned workflows preserve their contracts', () => {
  const result = spawnSync('node', ['scripts/validate-workflow-baseline.js'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Validated 7 workflow baseline files/);
});
