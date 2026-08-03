const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const windowsEngineTempFilePattern = /^query_engine-windows\.dll\.node\.tmp\d+$/;
const windowsRetryDelayByAttempt = [750, 1500];
const defaultMaxWindowsRetries = 2;
const defaultDiagnosticsOutputRelativePath = path.join('logs', 'prisma-generate-last-run.json');

function listWindowsEngineTempFiles(prismaClientDirectory) {
  if (!fs.existsSync(prismaClientDirectory)) {
    return [];
  }

  return fs.readdirSync(prismaClientDirectory)
    .filter((entry) => windowsEngineTempFilePattern.test(entry))
    .map((entry) => path.join(prismaClientDirectory, entry));
}

function removeWindowsEngineTempFiles(prismaClientDirectory, options = {}) {
  const tempFiles = listWindowsEngineTempFiles(prismaClientDirectory);
  const onCleanupError = typeof options.onCleanupError === 'function'
    ? options.onCleanupError
    : null;
  let removedCount = 0;

  for (const tempFile of tempFiles) {
    try {
      fs.rmSync(tempFile, { force: true });
      removedCount += 1;
    } catch (error) {
      if (onCleanupError) {
        onCleanupError({ tempFile, error });
      }
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

function buildPrismaGenerateDiagnostics({
  platform,
  projectRoot,
  attemptNumber,
  maxWindowsRetries,
  removedBeforeGenerate,
  retryDelayMs,
  failure,
  result,
  status,
}) {
  return {
    generatedAt: new Date().toISOString(),
    status,
    platform,
    nodeVersion: process.version,
    projectRoot,
    attemptNumber,
    maxWindowsRetries,
    removedBeforeGenerate,
    retryDelayMs,
    classification: failure?.kind || 'success',
    retryable: Boolean(failure?.retryable),
    tempFilesAfterFailure: failure?.tempFilesAfterFailure || [],
    exitCode: result?.status ?? 0,
    signal: result?.signal || null,
  };
}

function writePrismaGenerateDiagnostics(diagnosticsOutputPath, diagnostics) {
  if (!diagnosticsOutputPath) {
    return null;
  }

  fs.mkdirSync(path.dirname(diagnosticsOutputPath), { recursive: true });
  fs.writeFileSync(diagnosticsOutputPath, JSON.stringify(diagnostics, null, 2));
  return diagnosticsOutputPath;
}

function formatFailureContext({ platform, attemptNumber, failure }) {
  return [
    `platform=${platform}`,
    `attempt=${attemptNumber}`,
    `classification=${failure.kind}`,
    `tempFiles=${failure.tempFilesAfterFailure.length}`,
  ].join(', ');
}

function failWithActionableGuidance({ result, platform, attemptNumber, failure, diagnosticsOutputPath }) {
  console.error('\nPrisma generate did not complete successfully.');
  console.error(`Failure context: ${formatFailureContext({ platform, attemptNumber, failure })}`);
  if (diagnosticsOutputPath) {
    console.error(`Local diagnostics report: ${diagnosticsOutputPath}`);
  }

  if (platform === 'win32') {
    console.error('Windows mitigation guidance:');
    console.error('- close local Node processes that may be holding Prisma engine files;');
    console.error('- prefer Node.js 24 LTS for this repository baseline;');
    console.error('- inspect the local diagnostics report before retrying when available;');
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
  maxWindowsRetries = defaultMaxWindowsRetries,
  diagnosticsOutputPath = path.join(projectRoot, defaultDiagnosticsOutputRelativePath),
  hooks = {},
}) {
  const cleanupTempFiles = hooks.cleanupTempFiles || ((stageLabel) => removeWindowsEngineTempFiles(prismaClientDirectory, {
    onCleanupError: ({ tempFile, error }) => {
      console.warn(`Could not remove stale Prisma Windows engine temp file during ${stageLabel}: ${tempFile} (${error.message})`);
    },
  }));
  const warn = hooks.warn || ((message) => console.warn(message));
  const sleepFn = hooks.sleep || sleep;
  const runGenerate = hooks.runPrismaGenerate || (() => runPrismaGenerate({ projectRoot, prismaCliEntrypoint, env }));
  const classifyFailure = hooks.classifyPrismaGenerateFailure
    || ((result) => classifyPrismaGenerateFailure({ platform, result, prismaClientDirectory }));
  const fail = hooks.failWithActionableGuidance
    || ((result, attemptNumber, failure, reportPath) => failWithActionableGuidance({ result, platform, attemptNumber, failure, diagnosticsOutputPath: reportPath }));
  const writeDiagnostics = hooks.writePrismaGenerateDiagnostics || writePrismaGenerateDiagnostics;

  const removedBeforeGenerate = cleanupTempFiles('pre-generate cleanup');
  if (removedBeforeGenerate > 0) {
    warn(`Removed ${removedBeforeGenerate} stale Prisma Windows engine temp file(s) before generate.`);
  }

  const retryDelayMs = [];
  let attemptNumber = 1;
  let result = runGenerate();
  if (result.status === 0) {
    cleanupTempFiles('post-success cleanup');
    writeDiagnostics(diagnosticsOutputPath, buildPrismaGenerateDiagnostics({
      platform,
      projectRoot,
      attemptNumber,
      maxWindowsRetries,
      removedBeforeGenerate,
      retryDelayMs,
      failure: null,
      result,
      status: 'success',
    }));
    return;
  }

  let failure = classifyFailure(result);
  while (platform === 'win32' && failure.retryable && attemptNumber <= maxWindowsRetries) {
    const delayMs = getWindowsRetryDelayMs(attemptNumber);
    retryDelayMs.push(delayMs);
    warn(`Detected Windows Prisma engine rename lock or stale temp files. Cleaning and retrying (attempt ${attemptNumber} of ${maxWindowsRetries}) after ${delayMs}ms...`);
    const removedBeforeRetry = cleanupTempFiles(`retry cleanup before attempt ${attemptNumber + 1}`);
    if (removedBeforeRetry > 0) {
      warn(`Removed ${removedBeforeRetry} stale Prisma Windows engine temp file(s) before retry.`);
    }

    sleepFn(delayMs);
    attemptNumber += 1;
    result = runGenerate();
    if (result.status === 0) {
      cleanupTempFiles('post-success cleanup');
      writeDiagnostics(diagnosticsOutputPath, buildPrismaGenerateDiagnostics({
        platform,
        projectRoot,
        attemptNumber,
        maxWindowsRetries,
        removedBeforeGenerate,
        retryDelayMs,
        failure: null,
        result,
        status: 'success',
      }));
      return;
    }

    failure = classifyFailure(result);
  }

  const reportPath = writeDiagnostics(diagnosticsOutputPath, buildPrismaGenerateDiagnostics({
    platform,
    projectRoot,
    attemptNumber,
    maxWindowsRetries,
    removedBeforeGenerate,
    retryDelayMs,
    failure,
    result,
    status: 'failure',
  }));

  fail(result, attemptNumber, failure, reportPath);
}

module.exports = {
  buildPrismaGenerateDiagnostics,
  classifyPrismaGenerateFailure,
  defaultDiagnosticsOutputRelativePath,
  defaultMaxWindowsRetries,
  executePrismaGenerateWithWindowsStabilization,
  getWindowsRetryDelayMs,
  listWindowsEngineTempFiles,
  removeWindowsEngineTempFiles,
  windowsEngineTempFilePattern,
  writePrismaGenerateDiagnostics,
};
