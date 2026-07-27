const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const windowsEngineTempFilePattern = /^query_engine-windows\.dll\.node\.tmp\d+$/;
const windowsRetryDelayByAttempt = [750, 1500];

function listWindowsEngineTempFiles(prismaClientDirectory) {
  if (!fs.existsSync(prismaClientDirectory)) {
    return [];
  }

  return fs.readdirSync(prismaClientDirectory)
    .filter((entry) => windowsEngineTempFilePattern.test(entry))
    .map((entry) => path.join(prismaClientDirectory, entry));
}

function removeWindowsEngineTempFiles(prismaClientDirectory) {
  const tempFiles = listWindowsEngineTempFiles(prismaClientDirectory);
  let removedCount = 0;

  for (const tempFile of tempFiles) {
    try {
      fs.rmSync(tempFile, { force: true });
      removedCount += 1;
    } catch (_error) {
      // keep cleanup best-effort; real build status still comes from prisma generate.
    }
  }

  return removedCount;
}

function printResultOutput(result) {
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }

  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
}

function runPrismaGenerate({ projectRoot, prismaCliEntrypoint, env }) {
  const result = spawnSync(process.execPath, [prismaCliEntrypoint, 'generate'], {
    cwd: projectRoot,
    env,
    encoding: 'utf8',
    stdio: 'pipe',
  });

  printResultOutput(result);
  return result;
}

function buildCombinedOutput(result) {
  return [result.stdout, result.stderr, result.error?.message]
    .filter(Boolean)
    .join('\n');
}

function classifyPrismaGenerateFailure({ platform, result, prismaClientDirectory }) {
  const combinedOutput = buildCombinedOutput(result);
  const tempFilesAfterFailure = listWindowsEngineTempFiles(prismaClientDirectory);
  const isWindowsRenameLock = platform === 'win32'
    && combinedOutput.includes('EPERM')
    && combinedOutput.includes('query_engine-windows.dll.node.tmp');
  const hasWindowsTempFiles = platform === 'win32' && tempFilesAfterFailure.length > 0;

  if (isWindowsRenameLock || hasWindowsTempFiles) {
    return {
      kind: 'windows_rename_lock',
      retryable: true,
      tempFilesAfterFailure,
      combinedOutput,
    };
  }

  return {
    kind: 'non_retryable_failure',
    retryable: false,
    tempFilesAfterFailure,
    combinedOutput,
  };
}

function sleep(ms) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return;
  }

  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function getWindowsRetryDelayMs(retryIndex) {
  return windowsRetryDelayByAttempt[retryIndex - 1] || windowsRetryDelayByAttempt[windowsRetryDelayByAttempt.length - 1] || 0;
}

function formatFailureContext({ platform, attemptNumber, failure }) {
  return [
    `platform=${platform}`,
    `attempt=${attemptNumber}`,
    `classification=${failure.kind}`,
    `tempFiles=${failure.tempFilesAfterFailure.length}`,
  ].join(', ');
}

function failWithActionableGuidance({ result, platform, attemptNumber, failure }) {
  console.error('\nPrisma generate did not complete successfully.');
  console.error(`Failure context: ${formatFailureContext({ platform, attemptNumber, failure })}`);

  if (platform === 'win32') {
    console.error('Windows mitigation guidance:');
    console.error('- close local Node processes that may be holding Prisma engine files;');
    console.error('- prefer Node.js 24 LTS for this repository baseline;');
    console.error('- re-run `npm run build`;');
    console.error('- if the issue persists, remove stale files under `node_modules/.prisma/client/query_engine-windows.dll.node.tmp*` and retry.');
  }

  if (result.error) {
    throw result.error;
  }

  process.exit(result.status || 1);
}

function executePrismaGenerateWithWindowsStabilization({
  platform,
  projectRoot,
  prismaCliEntrypoint,
  prismaClientDirectory,
  env,
  maxWindowsRetries = 2,
}) {
  const removedBeforeGenerate = removeWindowsEngineTempFiles(prismaClientDirectory);
  if (removedBeforeGenerate > 0) {
    console.warn(`Removed ${removedBeforeGenerate} stale Prisma Windows engine temp file(s) before generate.`);
  }

  let attemptNumber = 1;
  let result = runPrismaGenerate({ projectRoot, prismaCliEntrypoint, env });
  if (result.status === 0) {
    removeWindowsEngineTempFiles(prismaClientDirectory);
    return;
  }

  let failure = classifyPrismaGenerateFailure({ platform, result, prismaClientDirectory });
  while (platform === 'win32' && failure.retryable && attemptNumber <= maxWindowsRetries) {
    const delayMs = getWindowsRetryDelayMs(attemptNumber);
    console.warn(`Detected Windows Prisma engine rename lock or stale temp files. Cleaning and retrying (attempt ${attemptNumber} of ${maxWindowsRetries}) after ${delayMs}ms...`);
    const removedBeforeRetry = removeWindowsEngineTempFiles(prismaClientDirectory);
    if (removedBeforeRetry > 0) {
      console.warn(`Removed ${removedBeforeRetry} stale Prisma Windows engine temp file(s) before retry.`);
    }

    sleep(delayMs);
    attemptNumber += 1;
    result = runPrismaGenerate({ projectRoot, prismaCliEntrypoint, env });
    if (result.status === 0) {
      removeWindowsEngineTempFiles(prismaClientDirectory);
      return;
    }

    failure = classifyPrismaGenerateFailure({ platform, result, prismaClientDirectory });
  }

  failWithActionableGuidance({ result, platform, attemptNumber, failure });
}

module.exports = {
  classifyPrismaGenerateFailure,
  executePrismaGenerateWithWindowsStabilization,
  getWindowsRetryDelayMs,
  listWindowsEngineTempFiles,
  removeWindowsEngineTempFiles,
  windowsEngineTempFilePattern,
};
