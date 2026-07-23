const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.join(__dirname, '..');

function hasAllFiles(relativePaths) {
  return relativePaths.every((relativePath) => fs.existsSync(path.join(repositoryRoot, relativePath)));
}

function skipIfMissing(t, relativePaths, reason) {
  if (!hasAllFiles(relativePaths)) {
    t.skip(reason);
    return true;
  }

  return false;
}

module.exports = {
  repositoryRoot,
  hasAllFiles,
  skipIfMissing,
};
