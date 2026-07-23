const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.join(__dirname, '..');
const internalDocsRoot = path.join(repositoryRoot, 'internal-docs');

function internalDocsExist(requiredPaths = []) {
  if (!fs.existsSync(internalDocsRoot)) {
    return false;
  }

  return requiredPaths.every((relativePath) => fs.existsSync(path.join(repositoryRoot, relativePath)));
}

function writeSkip(message) {
  process.stdout.write(`${message}\n`);
}

module.exports = {
  repositoryRoot,
  internalDocsRoot,
  internalDocsExist,
  writeSkip,
};
