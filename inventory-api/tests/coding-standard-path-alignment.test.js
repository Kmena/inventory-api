const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { repositoryRoot } = require('./internal-docs-optional');

const canonicalPath = path.join(repositoryRoot, 'docs', 'coding_standard.md');
const compatibilityPath = path.join(repositoryRoot, 'docs', 'coding-standards.md');
const allowedCompatibilityReferenceFiles = new Set([
  compatibilityPath,
  path.join(repositoryRoot, 'tests', 'coding-standard-path-alignment.test.js'),
]);
const scannedRoots = [
  path.join(repositoryRoot, 'docs'),
  path.join(repositoryRoot, 'tests'),
  path.join(repositoryRoot, 'scripts'),
];
const scannedExtensions = new Set(['.md', '.js', '.json', '.yaml', '.yml']);

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function listScannedFiles(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listScannedFiles(absolutePath));
      continue;
    }

    if (scannedExtensions.has(path.extname(entry.name))) {
      files.push(absolutePath);
    }
  }

  return files;
}

test('canonical coding standards path exists and keeps the full standards body', () => {
  assert.equal(fs.existsSync(canonicalPath), true, 'Expected docs/coding_standard.md to exist.');

  const canonicalSource = readText(canonicalPath);
  assert.match(canonicalSource, /^# Coding Standards/m);
  assert.match(canonicalSource, /docs\/coding_standard\.md/);
  assert.match(canonicalSource, /# 25\. Reglas para agentes de IA/);
});

test('hyphenated coding standards path remains a compatibility bridge only', () => {
  assert.equal(fs.existsSync(compatibilityPath), true, 'Expected docs/coding-standards.md to exist as a compatibility bridge.');

  const compatibilitySource = readText(compatibilityPath);
  assert.match(compatibilitySource, /^# Compatibility Notice: Coding Standards Path/m);
  assert.match(compatibilitySource, /docs\/coding_standard\.md/);
  assert.doesNotMatch(compatibilitySource, /^# Coding Standards/m);
  assert.doesNotMatch(compatibilitySource, /# 25\. Reglas para agentes de IA/);
});

test('repo-owned docs, tests and scripts use the canonical path policy without stale hyphenated references', () => {
  const staleReferences = [];

  for (const root of scannedRoots) {
    for (const filePath of listScannedFiles(root)) {
      const source = readText(filePath);
      if (!source.includes('coding-standards.md')) {
        continue;
      }

      if (allowedCompatibilityReferenceFiles.has(filePath)) {
        continue;
      }

      staleReferences.push(path.relative(repositoryRoot, filePath));
    }
  }

  assert.deepEqual(
    staleReferences,
    [],
    `Found stale hyphenated coding standards references outside the compatibility bridge: ${staleReferences.join(', ')}`,
  );
});
