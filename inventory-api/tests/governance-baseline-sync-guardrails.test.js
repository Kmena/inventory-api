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

function readOptionalText(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return readText(filePath);
}

function assertAuditReflectsBoundedGovernance(audit) {
  assert.match(
    audit,
    /intentionally partial coverage|partial OpenAPI|bounded runtime governance|focused post-implementation baseline audit|focused regression tests/i,
  );
}

function assertAuditReflectsCanonicalDocsOwnership(audit) {
  assert.match(
    audit,
    /canonical `docs\/\*\*` artifacts|canonical `docs\/\*\*` source of truth|canonical `docs\/\*\*` artifacts used by the new governance tests|documentation ownership map with clear canonical\/auxiliary\/historical separation|canonical docs under `docs\/\*\*`|`docs\/current-state\.md` describes implemented|`docs\/architecture\.md` describes active runtime architecture|bounded OpenAPI\/runtime artifacts under `docs\/\*\*`/i,
  );
}

test('governed baseline docs stay aligned on the post-p34 bounded governance baseline', () => {
  const currentState = readText(currentStatePath);
  const architecture = readText(architecturePath);
  const actionPlan = readText(actionPlanPath);
  const audit = readOptionalText(auditPath);

  for (const source of [currentState, architecture, actionPlan]) {
    assert.match(source, /p34-bounded-governance-coverage-expansion/);
  }

  if (audit) {
    assertAuditReflectsBoundedGovernance(audit);
  }

  assert.match(currentState, /bounded.*coverage|partial.*coverage/i);
  assert.match(architecture, /partial OpenAPI baseline|bounded governance evidence/i);
  assert.match(actionPlan, /partial OpenAPI\/typecheck coverage posture bounded|bounded governance/i);

  if (audit) {
    assertAuditReflectsBoundedGovernance(audit);
  }
});

test('governed baseline docs preserve canonical ownership and current company-role-update truth', () => {
  const currentState = readText(currentStatePath);
  const architecture = readText(architecturePath);
  const actionPlan = readText(actionPlanPath);
  const audit = readOptionalText(auditPath);

  assert.match(currentState, /canonical runtime-contract governance lives under `docs\/\*\*`/);
  assert.match(architecture, /canonical reviewed artifacts under `docs\/\*\*`/);
  assert.match(currentState, /authoritative hosted workflow location for local validators\/tests: `\.\.\/\.github\/workflows\//);
  assert.match(architecture, /The workflow-baseline validators and characterization tests intentionally read hosted workflow truth from that parent-root workflow tree\./);
  assert.match(actionPlan, /reads hosted workflow truth from `\.\.\/\.github\/workflows\//);

  if (audit) {
    assertAuditReflectsCanonicalDocsOwnership(audit);
  }

  assert.match(currentState, /runtime company-role update flow now exists|PUT \/api\/roles\/company\/:roleId/i);
  assert.match(architecture, /supported runtime company-role update flow now exists|runtime company-role update flow now exists/i);
  assert.match(actionPlan, /runtime company-role update flow now exists|company-role list\/create\/update flows/i);
});
