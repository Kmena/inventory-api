const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dependencyHygieneValidator = require('../scripts/validate-dependency-hygiene');

const baselineDocPath = path.join(__dirname, '..', 'docs', 'audit', 'dependency-hygiene-baseline.md');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('dependency hygiene validator no longer approves any bcrypt-chain residual packages', () => {
  assert.deepEqual(Object.keys(dependencyHygieneValidator.approvedResidualVulnerabilities), []);
});

test('dependency hygiene baseline doc records the bcrypt closeout with a zero-vulnerability audit result', () => {
  const source = read(baselineDocPath);

  assert.match(source, /npm audit --json/i);
  assert.match(source, /0 vulnerable packages/i);
  assert.match(source, /closeout/i);
  assert.match(source, /bcrypt@6\.0\.0/i);
  assert.match(source, /node-gyp-build@4\.8\.4/i);
  assert.match(source, /Removed from the resolved auth install chain/i);
  assert.match(source, /@mapbox\/node-pre-gyp/i);
  assert.match(source, /tar/i);
});
