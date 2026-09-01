const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.join(__dirname, '..');
const readmePath = path.join(repositoryRoot, 'README.md');
const evidenceDocPath = path.join(repositoryRoot, 'docs', 'p7-risk-closure-evidence.md');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('P7 risk closure evidence document stays linked from README and lists the governed artifacts', () => {
  const readmeSource = read(readmePath);
  const evidenceSource = read(evidenceDocPath);

  assert.match(readmeSource, /docs\/p7-risk-closure-evidence\.md/);
  assert.match(readmeSource, /3 skipped.*P2_CONSTRAINTS_DATABASE_URL.*P2_AUDIT_DATABASE_URL/s);

  assert.match(evidenceSource, /docs\/heavy-endpoints-baseline\.json/);
  assert.match(evidenceSource, /docs\/runtime-contract-manifest\.json/);
  assert.match(evidenceSource, /tests\/runtime-contract-governance\.test\.js/);
  assert.match(evidenceSource, /tests\/client-document-security\.test\.js/);
  assert.match(evidenceSource, /tests\/payment-receipt-security\.test\.js/);
  assert.match(evidenceSource, /P2_CONSTRAINTS_DATABASE_URL/);
  assert.match(evidenceSource, /P2_AUDIT_DATABASE_URL/);
  assert.match(evidenceSource, /npm run test -- --silent/);
});
