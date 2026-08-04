const { execSync } = require('node:child_process');

const approvedResidualVulnerabilities = {};

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
