const { execSync } = require('node:child_process');

// Vulnerabilities approved as residual pending a safe upgrade path.
// Each entry must include a classification and rationale.
// Review docs/audit/dependency-hygiene-baseline.md for full context.
const approvedResidualVulnerabilities = {
  qs: {
    classification: 'moderate',
    rationale:
      'CVE GHSA-x5fp-wj9c-mxmx / GHSA-4mjr-xmp4-gh2g. ' +
      'Fix requires express@5.2.1 (semver-major). ' +
      'Upgrade deferred: Express 4→5 is a breaking change requiring full regression. ' +
      'qs is only used for internal URL parsing in Express middleware, not for user-supplied untrusted data in direct callers.',
  },
  'body-parser': {
    classification: 'moderate',
    rationale:
      'Transitive dependency via qs. Same root cause and upgrade path as qs entry above.',
  },
  express: {
    classification: 'moderate',
    rationale:
      'Transitive dependency via body-parser and qs. Same root cause and upgrade path as qs entry above.',
  },
};

function readAuditReport() {
  try {
    return execSync('npm audit --json', {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const stdout = error.stdout?.toString?.() || '';
    if (!stdout) {
      throw error;
    }
    return stdout;
  }
}

function parseAuditReport() {
  const source = readAuditReport();
  return JSON.parse(source);
}

function summarize(vulnerabilities) {
  return Object.entries(vulnerabilities)
    .map(([name, details]) => `${name} (${details.severity})`)
    .sort();
}

function main() {
  const auditReport = parseAuditReport();
  const vulnerabilities = auditReport.vulnerabilities || {};
  const vulnerabilityNames = Object.keys(vulnerabilities);
  const unexpected = vulnerabilityNames.filter((name) => !approvedResidualVulnerabilities[name]);

  if (unexpected.length > 0) {
    const summary = summarize(vulnerabilities).join(', ');
    throw new Error(
      [
        'Dependency hygiene baseline drift detected.',
        `Unexpected vulnerabilities still present: ${unexpected.join(', ')}`,
        `Observed audit summary: ${summary || 'none'}`,
        'Review docs/audit/dependency-hygiene-baseline.md before changing the approved residual posture.',
      ].join('\n'),
    );
  }

  const metadata = auditReport.metadata?.vulnerabilities || {};
  const residualSummary = vulnerabilityNames
    .map((name) => `${name}: ${approvedResidualVulnerabilities[name].classification}`)
    .sort()
    .join(', ');

  console.log('Dependency hygiene baseline validated.');
  console.log(
    `Residual vulnerabilities: ${metadata.total ?? 0} total (${metadata.low ?? 0} low, ${metadata.moderate ?? 0} moderate, ${metadata.high ?? 0} high, ${metadata.critical ?? 0} critical).`,
  );
  console.log(`Approved residual set: ${residualSummary || 'none'}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  approvedResidualVulnerabilities,
  parseAuditReport,
};
