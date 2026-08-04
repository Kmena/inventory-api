const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { repositoryRoot } = require('./internal-docs-optional');
const hostedRepositoryRoot = path.resolve(repositoryRoot, '..');
const workflowsRoot = path.join(hostedRepositoryRoot, '.github', 'workflows');
const productionDocPath = path.join(repositoryRoot, 'docs', 'production-baseline.md');
const criticalControlsDocPath = path.join(repositoryRoot, 'docs', 'ci-critical-controls.md');
const workflowValidator = require('../scripts/validate-workflow-baseline.js');
const operationalReadinessValidator = require('../scripts/validate-operational-readiness.js');

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
  assert.match(workflowSource, /REDIS_URL:\s+redis:\/\/redis:6379\/0/);
  assert.match(workflowSource, /rm -f \.env\.production/);
  assert.match(workflowSource, /docker compose -f docker-compose\.prod\.yml config/);
  assert.match(workflowSource, /docker build -t inventory-api:operational-smoke \./);
  assert.doesNotMatch(workflowSource, /deploy/i);
});

test('production baseline documentation includes the operational smoke workflow and local smoke checklist', () => {
  const docSource = fs.readFileSync(productionDocPath, 'utf8');

  assert.match(docSource, /\.\.\/\.github\/workflows\/operational-smoke\.yml/);
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
  assert.doesNotMatch(workflowSource, /run:\s+npm run test\s*$/m);
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

test('dedicated Redis browser-session workflow keeps the mandatory non-default session path explicit', () => {
  const workflowSource = readWorkflow('redis-browser-session-tests.yml');

  assert.match(workflowSource, /^\s{2}redis-browser-session-tests:\s*$/m);
  assert.match(workflowSource, /node-version:\s+'24'/);
  assert.match(workflowSource, /run:\s+npm ci/);
  assert.match(workflowSource, /npm run build/);
  assert.match(workflowSource, /run:\s+npm run test:redis-path/);
  assert.doesNotMatch(workflowSource, /run:\s+npm run test\s*$/m);
});

test('dependency hygiene workflow preserves the audited npm audit evidence lane', () => {
  const workflowSource = readWorkflow('dependency-hygiene.yml');

  assert.match(workflowSource, /^\s{2}dependency-hygiene:\s*$/m);
  assert.match(workflowSource, /node-version:\s+'24'/);
  assert.match(workflowSource, /run:\s+npm ci/);
  assert.match(workflowSource, /npm audit --json > dependency-audit\.json \|\| true/);
  assert.match(workflowSource, /run:\s+npm run validate:dependency-hygiene/);
  assert.match(workflowSource, /GITHUB_STEP_SUMMARY/);
  assert.match(workflowSource, /actions\/upload-artifact@v4/);
});

test('critical controls documentation keeps the repo-verifiable required-job baseline and manual hosted verification boundary explicit', () => {
  const source = fs.readFileSync(criticalControlsDocPath, 'utf8');

  assert.match(source, /Repo-verifiable required-job baseline/i);
  assert.match(source, /`static-checks`/);
  assert.match(source, /`contract-validations`/);
  assert.match(source, /`repository-tests`/);
  assert.match(source, /`dependency-hygiene`/);
  assert.match(source, /`db-constraints-tests`/);
  assert.match(source, /`windows-prisma-build`/);
  assert.match(source, /`browser-e2e`/);
  assert.match(source, /`redis-browser-session-tests`/);
  assert.match(source, /`operational-smoke`/);
  assert.match(source, /successful branches and pull requests already rely on passing/i);
  assert.match(source, /Manual hosted verification checklist/i);
  assert.match(source, /branch protection/i);
  assert.match(source, /required status checks/i);
});

test('workflow validators expose actionable parent-root ownership guidance when workflow files are absent', () => {
  const workflowGuidance = workflowValidator.formatWorkflowOwnershipGuidance();
  const missingWorkflowMessage = workflowValidator.describeMissingWorkflow('static-checks.yml');
  const operationalGuidance = operationalReadinessValidator.formatWorkflowOwnershipGuidance();

  assert.match(workflowGuidance, /Authoritative hosted workflows are expected in:/);
  assert.match(workflowGuidance, /\.\.\\?\/\.github\\?\/workflows|\.\.\/\.github\/workflows/);
  assert.match(workflowGuidance, /Application-local workflow directory is not authoritative today/);
  assert.match(missingWorkflowMessage, /static-checks\.yml: workflow file is missing/);
  assert.match(missingWorkflowMessage, /run this validator from the hosted repository checkout/i);
  assert.match(operationalGuidance, /Authoritative operational workflow is expected at:/);
  assert.match(operationalGuidance, /Application-local workflow directory is not authoritative today/);
  assert.match(operationalGuidance, /restore the approved parent-root workflow baseline/i);
});

test('validate-workflow-baseline passes when the versioned workflows preserve their contracts', () => {
  const result = spawnSync('node', ['scripts/validate-workflow-baseline.js'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Validated 11 workflow baseline files/);
});
