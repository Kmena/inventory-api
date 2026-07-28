const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const testsRoot = path.join(__dirname, '..', 'tests');
const preferredTestOrder = [
  'tests/logging.test.js',
  'tests/request-context.test.js',
  'tests/audit.test.js',
  'tests/access-policies.test.js',
  'tests/audit-repository.test.js',
  'tests/audit-instrumentation.test.js',
  'tests/health-routes.test.js',
  'tests/p2-hardening-constraints.test.js',
  'tests/client-tenant-scope.test.js',
  'tests/company-authorization-characterization.test.js',
  'tests/administrative-authorization-characterization.test.js',
  'tests/invoice-tenant-scope.test.js',
  'tests/invoice-payment-sync-characterization.test.js',
  'tests/money.test.js',
  'tests/payment-tenant-scope.test.js',
  'tests/payment-lifecycle-schema-characterization.test.js',
  'tests/payment-receipt-security.test.js',
  'tests/agent-workspace-tenant-scope.test.js',
  'tests/geocoding-characterization.test.js',
  'tests/taxpayer-characterization.test.js',
  'tests/public-surface-characterization.test.js',
  'tests/auth-hardening-characterization.test.js',
  'tests/payload-segmentation-characterization.test.js',
  'tests/client-document-security.test.js',
  'tests/pagination.test.js',
  'tests/lifecycle-repository.test.js',
  'tests/lifecycle-delete-authorization.test.js',
  'tests/product-delete-semantics.test.js',
  'tests/lot-datetime-characterization.test.js',
  'tests/inventory-alerts-tenant-scope.test.js',
  'tests/approval-baseline-compatibility.test.js',
  'tests/openapi-contract-consistency.test.js',
  'tests/production-baseline-characterization.test.js',
];
const preferredOrderIndex = new Map(preferredTestOrder.map((filePath, index) => [filePath, index]));

function toPosixPath(value) {
  return value.split(path.sep).join('/');
}

function compareDiscoveredTestFiles(left, right) {
  const leftIndex = preferredOrderIndex.get(left);
  const rightIndex = preferredOrderIndex.get(right);

  if (leftIndex !== undefined && rightIndex !== undefined) {
    return leftIndex - rightIndex;
  }

  if (leftIndex !== undefined) {
    return -1;
  }

  if (rightIndex !== undefined) {
    return 1;
  }

  return left.localeCompare(right);
}

function listTestFiles(directory) {
  const discoveredFiles = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      discoveredFiles.push(...listTestFiles(absolutePath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.test.js')) {
      discoveredFiles.push(absolutePath);
    }
  }

  return discoveredFiles
    .map((filePath) => toPosixPath(path.relative(process.cwd(), filePath)))
    .sort(compareDiscoveredTestFiles);
}

function run() {
  const testFiles = listTestFiles(testsRoot);

  if (testFiles.length === 0) {
    throw new Error('No test files were discovered under tests/.');
  }

  const forwardedArguments = process.argv.slice(2).filter((argument) => argument !== '--silent');
  const child = spawn(process.execPath, ['--test', ...forwardedArguments, ...testFiles], {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV || 'test',
      BROWSER_SESSION_STORE_MODE: process.env.BROWSER_SESSION_STORE_MODE || 'memory',
    },
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 1);
  });
}

run();
