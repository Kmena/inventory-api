const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repositoryRoot = path.join(__dirname, '..');
const workflowsRoot = path.join(repositoryRoot, '.github', 'workflows');
const productionDocPath = path.join(repositoryRoot, 'docs', 'production-baseline.md');

function readWorkflow(name) {
  return fs.readFileSync(path.join(workflowsRoot, name), 'utf8');
}

test('operational smoke workflow validates production baseline inputs, compose syntax and Docker build', () => {
  const workflowSource = readWorkflow('operational-smoke.yml');

  assert.match(workflowSource, /^\s{2}operational-smoke:\s*$/m);
  assert.match(workflowSource, /npm run validate:production-baseline/);
  assert.match(workflowSource, /npm run validate:operational-readiness/);
  assert.match(workflowSource, /cat > \.env\.production <<EOF/);
  assert.match(workflowSource, /docker compose -f docker-compose\.prod\.yml config/);
  assert.match(workflowSource, /docker build -t inventory-api:operational-smoke \./);
  assert.doesNotMatch(workflowSource, /deploy/i);
});

test('production baseline documentation includes the operational smoke workflow and local smoke checklist', () => {
  const docSource = fs.readFileSync(productionDocPath, 'utf8');

  assert.match(docSource, /operational-smoke\.yml/);
  assert.match(docSource, /docker compose -f docker-compose\.prod\.yml config/);
  assert.match(docSource, /docker build -t inventory-api:operational-smoke \./);
});

test('validate-workflow-baseline passes when the versioned workflows preserve their contracts', () => {
  const result = spawnSync('node', ['scripts/validate-workflow-baseline.js'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Validated 3 workflow baseline files/);
});
