const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function readText(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

test('documentation ownership map preserves canonical, auxiliary, historical, and auto-validated classifications', () => {
  const ownershipMap = readText('docs/documentation-ownership-map.md');

  assert.match(ownershipMap, /Canonical/);
  assert.match(ownershipMap, /Auxiliary/);
  assert.match(ownershipMap, /Historical \/ compatibility/);
  assert.match(ownershipMap, /Auto-validated/);
  assert.match(ownershipMap, /internal-docs\/\*\*/);
  assert.match(ownershipMap, /\.\.\/\.github\/workflows\/\*\*/);
  assert.match(ownershipMap, /src\/security\/access-policy-registry\.js/);
  assert.match(ownershipMap, /src\/services\/inventory-alerts\.service\.js/);
});

test('architecture-facing docs reference the documentation ownership map and canonical workflow authority', () => {
  const architecture = readText('docs/architecture.md');
  const currentState = readText('docs/current-state.md');

  assert.match(architecture, /docs\/documentation-ownership-map\.md/);
  assert.match(currentState, /docs\/documentation-ownership-map\.md/);
  assert.match(architecture, /\.\.\/\.github\/workflows\/\*\*/);
  assert.match(currentState, /\.\.\/\.github\/workflows\/\*\*/);
});
