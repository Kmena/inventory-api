const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.join(__dirname, '..');
const currentStatePath = path.join(repositoryRoot, 'docs', 'current-state.md');
const architecturePath = path.join(repositoryRoot, 'docs', 'architecture.md');
const actionPlanPath = path.join(repositoryRoot, 'docs', 'action-plan.md');
const auditPath = path.join(repositoryRoot, 'docs', 'audit', 'current-code-audit.md');

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('governed baseline docs stay aligned on the post-p34 bounded governance baseline', () => {
  const currentState = readText(currentStatePath);
  const architecture = readText(architecturePath);
  const actionPlan = readText(actionPlanPath);
  const audit = readText(auditPath);

  for (const source of [currentState, architecture, actionPlan, audit]) {
    assert.match(source, /p34-bounded-governance-coverage-expansion/);
  }

  assert.match(currentState, /bounded.*coverage|partial.*coverage/i);
  assert.match(architecture, /partial OpenAPI baseline|bounded governance evidence/i);
  assert.match(actionPlan, /partial OpenAPI\/typecheck coverage posture bounded|bounded governance/i);
  assert.match(audit, /intentionally partial coverage|partial OpenAPI/i);
});

test('governed baseline docs preserve canonical ownership and no-update-flow truth', () => {
  const currentState = readText(currentStatePath);
  const architecture = readText(architecturePath);
  const actionPlan = readText(actionPlanPath);
  const audit = readText(auditPath);

  assert.match(currentState, /canonical runtime-contract governance lives under `docs\/\*\*`/);
  assert.match(architecture, /canonical reviewed artifacts under `docs\/\*\*`/);
  assert.match(audit, /canonical `docs\/\*\*` artifacts|canonical `docs\/\*\*` source of truth|canonical `docs\/\*\*` artifacts used by the new governance tests/i);
  assert.match(architecture, /no runtime company-role update flow currently exists/i);
  assert.match(actionPlan, /no runtime company-role update flow exists yet|once an actual update surface exists/i);
});
