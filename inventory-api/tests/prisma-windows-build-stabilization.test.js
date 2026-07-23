const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workflowPath = path.join(__dirname, '..', '.github', 'workflows', 'windows-prisma-build.yml');
const wrapperLibrary = require('../scripts/prisma-generate-safe-lib.js');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('Windows Prisma workflow is dedicated, required and scoped to npm ci plus build with auditable summary and artifact evidence', () => {
  const workflowSource = read(workflowPath);

  assert.match(workflowSource, /^name:\s+windows-prisma-build$/m);
  assert.match(workflowSource, /^\s{2}windows-prisma-build:\s*$/m);
  assert.match(workflowSource, /runs-on:\s+windows-latest/);
  assert.match(workflowSource, /node-version:\s+'20'/);
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
  assert.equal(wrapperLibrary.getWindowsRetryDelayMs(1), 750);
  assert.equal(wrapperLibrary.getWindowsRetryDelayMs(2), 1500);
  assert.equal(wrapperLibrary.getWindowsRetryDelayMs(3), 1500);
});
