const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(appRoot, '..');
const rawUnsafeInventoryPath = path.join(repoRoot, 'specs', 'p7-9-5-risk-closure', 'rawunsafe-inventory.md');
const governedDirectories = [
  'src',
  'scripts',
  'tests',
  'prisma',
];
const expectedRawUnsafeFiles = [
  'prisma/migration-instructions.md',
  'scripts/apply-committed-migrations.js',
  'scripts/diagnose-hardening-constraints.js',
  'tests/p2-hardening-constraints.test.js',
];

function collectFiles(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(absolutePath));
      continue;
    }

    files.push(absolutePath);
  }

  return files;
}

function findRawUnsafeFiles() {
  const discoveredFiles = [];

  for (const relativeDirectory of governedDirectories) {
    const absoluteDirectory = path.join(appRoot, relativeDirectory);
    for (const absoluteFilePath of collectFiles(absoluteDirectory)) {
      const relativeFilePath = path.relative(appRoot, absoluteFilePath).split(path.sep).join('/');
      if (relativeFilePath === 'tests/rawunsafe-inventory-governance.test.js') {
        continue;
      }

      const fileContents = fs.readFileSync(absoluteFilePath, 'utf8');
      if (fileContents.includes('RawUnsafe')) {
        discoveredFiles.push(relativeFilePath);
      }
    }
  }

  return discoveredFiles.sort();
}

test('RawUnsafe inventory stays aligned with governed repository surfaces', () => {
  const discoveredFiles = findRawUnsafeFiles();
  assert.deepEqual(discoveredFiles, expectedRawUnsafeFiles);
});

test('RawUnsafe inventory document lists every governed occurrence', () => {
  const inventoryContents = fs.readFileSync(rawUnsafeInventoryPath, 'utf8');

  for (const relativeFilePath of expectedRawUnsafeFiles) {
    assert.match(inventoryContents, new RegExp(relativeFilePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
