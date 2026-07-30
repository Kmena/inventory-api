const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const validatorPath = path.join(__dirname, '..', 'scripts', 'validate-type-safety-legacy-governance.js');

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('p36 validator ownership stays aligned to canonical docs artifacts', () => {
  const validatorSource = readText(validatorPath);

  assert.match(validatorSource, /path\.join\(repositoryRoot, 'docs', 'runtime-contract-manifest\.json'\)/);
  assert.match(validatorSource, /path\.join\(repositoryRoot, 'docs', 'openapi', 'runtime-baseline\.openapi\.json'\)/);
  assert.doesNotMatch(validatorSource, /internal-docs', 'runtime-contract-manifest\.json'/);
  assert.doesNotMatch(validatorSource, /internal-docs', 'openapi', 'runtime-baseline\.openapi\.json'/);
});
