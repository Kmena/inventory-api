const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { repositoryRoot, skipIfMissing } = require('./internal-docs-optional');
const hostedRepositoryRoot = path.resolve(repositoryRoot, '..');
const workflowsRoot = fs.existsSync(path.join(hostedRepositoryRoot, '.github', 'workflows'))
  && fs.existsSync(path.join(hostedRepositoryRoot, 'inventory-api', 'package.json'))
  ? path.join(hostedRepositoryRoot, '.github', 'workflows')
  : path.join(repositoryRoot, '.github', 'workflows');
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
  assert.match(workflowSource, /node-version:\s+'24'/);
  assert.match(workflowSource, /run:\s+npm ci/);
  assert.match(workflowSource, /npm run build/);
  assert.match(workflowSource, /id:\s+prisma_build/);
  assert.match(workflowSource, /continue-on-error:\s+true/);
  assert.match(workflowSource, /GITHUB_STEP_SUMMARY/);
  assert.match(workflowSource, /actions\/upload-artifact@v4/);
  assert.match(workflowSource, /Fail workflow when guarded Prisma build fails/);
  assert.doesNotMatch(workflowSource, /npm run verify/);
});

test('db constraints workflow provisions a dedicated mandatory database-backed gate for the focused P2 evidence', () => {
  const workflowSource = readWorkflow('db-constraints-tests.yml');

  assert.match(workflowSource, /^\s{2}db-constraints-tests:\s*$/m);
  assert.match(workflowSource, /^\s{6}postgres:\s*$/m);
  assert.match(workflowSource, /P2_CONSTRAINTS_DATABASE_URL:\s+postgresql:\/\/postgres:postgres@127\.0\.0\.1:5432\/inventory_api_constraints\?schema=public/);
  assert.match(workflowSource, /npm run prisma:apply-committed-migrations/);
  assert.match(workflowSource, /npm run prisma:seed/);
  assert.match(workflowSource, /node --test tests\/p2-hardening-constraints\.test\.js/);
  assert.doesNotMatch(workflowSource, /npm run test\b/);
});

test('legacy P0 quality-gates workflow stays aligned to Node 24 while executing from inventory-api', () => {
  const workflowSource = readWorkflow('p0-quality-gates.yml');

  assert.match(workflowSource, /^\s{2}quality-gates:\s*$/m);
  assert.match(workflowSource, /node-version:\s+24/);
  assert.match(workflowSource, /working-directory:\s+inventory-api/);
  assert.match(workflowSource, /run:\s+npm run lint/);
  assert.match(workflowSource, /run:\s+npm run typecheck/);
  assert.match(workflowSource, /run:\s+npm run build/);
  assert.match(workflowSource, /run:\s+npm run test/);
});

test('validate-workflow-baseline passes when the versioned workflows preserve their contracts', () => {
  const result = spawnSync('node', ['scripts/validate-workflow-baseline.js'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Validated 9 workflow baseline files/);
});
