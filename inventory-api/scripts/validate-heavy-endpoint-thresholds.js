const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.join(__dirname, '..');
const { internalDocsExist, writeSkip } = require('./internal-docs-optional');
const baselinePath = path.join(repositoryRoot, 'internal-docs', 'heavy-endpoints-baseline.json');
const thresholdsPath = path.join(repositoryRoot, 'docs', 'heavy-endpoint-thresholds.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function main() {
  if (!internalDocsExist(['internal-docs/heavy-endpoints-baseline.json']) || !fs.existsSync(thresholdsPath)) {
    writeSkip('Heavy endpoint thresholds validation skipped: governed artifacts are not fully present.');
    return;
  }

  const baseline = readJson(baselinePath);
  const thresholds = readJson(thresholdsPath);
  const failures = [];

  if (thresholds.version !== 1) {
    failures.push('Thresholds document version must be 1.');
  }

  if (thresholds.mode !== 'representative-fixture-soft-budgets') {
    failures.push('Threshold mode must be representative-fixture-soft-budgets.');
  }

  const budgetByKey = new Map((thresholds.budgets || []).map((budget) => [budget.key, budget]));

  for (const endpoint of baseline.endpoints || []) {
    const budget = budgetByKey.get(endpoint.key);
    if (!budget) {
      failures.push(`Missing threshold budget for endpoint key: ${endpoint.key}`);
      continue;
    }

    if (budget.method !== endpoint.method) {
      failures.push(`${endpoint.key}: method drift between baseline and thresholds.`);
    }

    if (budget.routePattern !== endpoint.routePattern) {
      failures.push(`${endpoint.key}: routePattern drift between baseline and thresholds.`);
    }

    if (budget.payloadClass !== endpoint.payloadClass) {
      failures.push(`${endpoint.key}: payloadClass drift between baseline and thresholds.`);
    }

    if (budget.expectedRepresentativeResultCount !== endpoint.baselineMetrics.resultCount) {
      failures.push(`${endpoint.key}: representative resultCount no longer matches the declared expectation.`);
    }

    if (endpoint.baselineMetrics.responseBytes > budget.maxRepresentativeResponseBytes) {
      failures.push(
        `${endpoint.key}: representative responseBytes ${endpoint.baselineMetrics.responseBytes} exceed budget ${budget.maxRepresentativeResponseBytes}.`,
      );
    }

    if (!String(budget.budgetRationale || '').trim()) {
      failures.push(`${endpoint.key}: budgetRationale must be explicit.`);
    }
  }

  if ((thresholds.budgets || []).length !== (baseline.endpoints || []).length) {
    failures.push('Threshold budget count must match baseline endpoint count.');
  }

  if (failures.length > 0) {
    throw new Error(`Heavy endpoint threshold validation failed:\n- ${failures.join('\n- ')}`);
  }

  process.stdout.write('Heavy endpoint thresholds validation passed.\n');
}

if (require.main === module) {
  main();
}

module.exports = {
  main,
};
