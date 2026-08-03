const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const applicationRoot = path.join(__dirname, '..');
const hostedRepositoryRoot = path.resolve(applicationRoot, '..');
const workflowPath = path.join(hostedRepositoryRoot, '.github', 'workflows', 'windows-prisma-build.yml');
const buildEvidencePath = path.join(applicationRoot, 'docs', 'prisma-windows-stability-evidence.md');
const readmePath = path.join(applicationRoot, 'README.md');
const wrapperLibrary = require('../scripts/prisma-generate-safe-lib.js');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('Windows Prisma workflow is dedicated, required and scoped to npm ci plus build with auditable summary and artifact evidence', () => {
  const workflowSource = read(workflowPath);

  assert.match(workflowSource, /^name:\s+windows-prisma-build$/m);
  assert.match(workflowSource, /^\s{2}windows-prisma-build:\s*$/m);
  assert.match(workflowSource, /runs-on:\s+windows-latest/);
  assert.match(workflowSource, /node-version:\s+'24'/);
  assert.match(workflowSource, /run:\s+npm ci/);
  assert.match(workflowSource, /npm run build/);
  assert.match(workflowSource, /id:\s+prisma_build/);
  assert.match(workflowSource, /continue-on-error:\s+true/);
  assert.match(workflowSource, /GITHUB_STEP_SUMMARY/);
  assert.match(workflowSource, /actions\/upload-artifact@v4/);
  assert.match(workflowSource, /Fail workflow when guarded Prisma build fails/);
  assert.doesNotMatch(workflowSource, /npm run verify/);
});

test('wrapper classifies Windows rename lock as retryable and generic Prisma failures as non-retryable', (t) => {
  const tempRoot = t.testDir ?? fs.mkdtempSync(path.join(__dirname, 'tmp-prisma-lock-'));

  const retryableDirectory = path.join(tempRoot, 'retryable');
  fs.mkdirSync(retryableDirectory, { recursive: true });
  fs.writeFileSync(path.join(retryableDirectory, 'query_engine-windows.dll.node.tmp1234'), 'locked');

  const retryableFailure = wrapperLibrary.classifyPrismaGenerateFailure({
    platform: 'win32',
    prismaClientDirectory: retryableDirectory,
    result: {
      stdout: '',
      stderr: "EPERM: operation not permitted, rename 'query_engine-windows.dll.node.tmp1234' -> 'query_engine-windows.dll.node'",
    },
  });

  assert.equal(retryableFailure.kind, 'windows_rename_lock');
  assert.equal(retryableFailure.retryable, true);
  assert.equal(retryableFailure.tempFilesAfterFailure.length, 1);

  const nonRetryableDirectory = path.join(tempRoot, 'non-retryable');
  fs.mkdirSync(nonRetryableDirectory, { recursive: true });

  const nonRetryableFailure = wrapperLibrary.classifyPrismaGenerateFailure({
    platform: 'win32',
    prismaClientDirectory: nonRetryableDirectory,
    result: {
      stdout: '',
      stderr: 'Error: Prisma schema validation failed',
    },
  });

  assert.equal(nonRetryableFailure.kind, 'non_retryable_failure');
  assert.equal(nonRetryableFailure.retryable, false);
  assert.equal(nonRetryableFailure.tempFilesAfterFailure.length, 0);
});

test('wrapper uses bounded retry delays for Windows lock stabilization', () => {
  assert.equal(wrapperLibrary.defaultMaxWindowsRetries, 2);
  assert.equal(wrapperLibrary.getWindowsRetryDelayMs(1), 750);
  assert.equal(wrapperLibrary.getWindowsRetryDelayMs(2), 1500);
  assert.equal(wrapperLibrary.getWindowsRetryDelayMs(3), 1500);
});

test('wrapper performs bounded cleanup and retry before succeeding on a retryable Windows failure', () => {
  const warnings = [];
  const sleepCalls = [];
  const cleanupStages = [];
  const runResults = [
    { status: 1, stdout: '', stderr: 'EPERM rename query_engine-windows.dll.node.tmp1234' },
    { status: 0, stdout: '', stderr: '' },
  ];
  let runCallCount = 0;

  wrapperLibrary.executePrismaGenerateWithWindowsStabilization({
    platform: 'win32',
    projectRoot: applicationRoot,
    prismaCliEntrypoint: 'prisma/build/index.js',
    prismaClientDirectory: path.join(applicationRoot, 'node_modules', '.prisma', 'client'),
    env: {},
    hooks: {
      cleanupTempFiles: (stageLabel) => {
        cleanupStages.push(stageLabel);
        return stageLabel === 'pre-generate cleanup' ? 1 : 0;
      },
      warn: (message) => warnings.push(message),
      sleep: (delayMs) => sleepCalls.push(delayMs),
      runPrismaGenerate: () => {
        const nextResult = runResults[runCallCount];
        runCallCount += 1;
        return nextResult;
      },
      classifyPrismaGenerateFailure: () => ({
        kind: 'windows_rename_lock',
        retryable: true,
        tempFilesAfterFailure: ['query_engine-windows.dll.node.tmp1234'],
        combinedOutput: 'EPERM',
      }),
      failWithActionableGuidance: () => {
        throw new Error('failWithActionableGuidance should not be reached in retry success path');
      },
    },
  });

  assert.equal(runCallCount, 2);
  assert.deepEqual(sleepCalls, [750]);
  assert.deepEqual(cleanupStages, [
    'pre-generate cleanup',
    'retry cleanup before attempt 2',
    'post-success cleanup',
  ]);
  assert.match(warnings[0], /Removed 1 stale Prisma Windows engine temp file\(s\) before generate/);
  assert.match(warnings[1], /Cleaning and retrying \(attempt 1 of 2\) after 750ms/);
});

test('Prisma Windows stability evidence distinguishes primary CI closure evidence from complementary local diagnostics', () => {
  const evidenceSource = read(buildEvidencePath);
  const readmeSource = read(readmePath);

  assert.match(evidenceSource, /## 2\. Closeout criterion/);
  assert.match(evidenceSource, /CI Windows/);
  assert.match(evidenceSource, /## 3\. Evidence hierarchy/);
  assert.match(evidenceSource, /Primary evidence/);
  assert.match(evidenceSource, /Complementary evidence/);
  assert.match(evidenceSource, /local developer runs/);
  assert.match(evidenceSource, /do not on their own overturn a CI-based closeout verdict/);
  assert.match(evidenceSource, /up to 2 bounded retries/i);
  assert.match(readmeSource, /wrapper soportado elimina archivos temporales stale/i);
  assert.match(readmeSource, /hasta 2 reintentos acotados/i);
  assert.match(readmeSource, /evidencia CI de Windows sigue siendo la evidencia primaria/i);
});
