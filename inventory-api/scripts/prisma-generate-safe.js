const path = require('node:path');

const {
  classifyPrismaGenerateFailure,
  defaultMaxWindowsRetries,
  executePrismaGenerateWithWindowsStabilization,
  getWindowsRetryDelayMs,
  listWindowsEngineTempFiles,
  removeWindowsEngineTempFiles,
  windowsEngineTempFilePattern,
} = require('./prisma-generate-safe-lib');

const projectRoot = path.join(__dirname, '..');
const prismaClientDirectory = path.join(projectRoot, 'node_modules', '.prisma', 'client');
const prismaCliEntrypoint = require.resolve('prisma/build/index.js', { paths: [projectRoot] });

function main() {
  executePrismaGenerateWithWindowsStabilization({
    platform: process.platform,
    projectRoot,
    prismaCliEntrypoint,
    prismaClientDirectory,
    env: process.env,
  });
}

if (require.main === module) {
  main();
}

module.exports = {
  classifyPrismaGenerateFailure,
  defaultMaxWindowsRetries,
  getWindowsRetryDelayMs,
  listWindowsEngineTempFiles: () => listWindowsEngineTempFiles(prismaClientDirectory),
  removeWindowsEngineTempFiles: () => removeWindowsEngineTempFiles(prismaClientDirectory),
  windowsEngineTempFilePattern,
};
