const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.join(__dirname, '..');
const workflowsDirectory = path.join(repositoryRoot, '.github', 'workflows');

const workflowRules = [
  {
    relativePath: 'quality-gates.yml',
    checks: [
      { description: 'defines a verify job', pattern: /^\s{2}verify:\s*$/m },
      { description: 'installs dependencies with npm ci', pattern: /run:\s+npm ci/ },
      { description: 'generates Prisma client before verification', pattern: /run:\s+npm run build/ },
      { description: 'runs repository quality gates', pattern: /run:\s+npm run verify/ },
    ],
  },
  {
    relativePath: 'build-and-publish.yml',
    checks: [
      { description: 'builds Docker image', pattern: /docker build \\/ },
      { description: 'packages release artifacts', pattern: /docker save/ },
      { description: 'uploads artifacts to GitHub Actions', pattern: /uses:\s+actions\/upload-artifact@v4/ },
      { description: 'does not deploy automatically', pattern: /"deployIncluded": false/ },
    ],
  },
  {
    relativePath: 'operational-smoke.yml',
    checks: [
      { description: 'defines an operational smoke job', pattern: /^\s{2}operational-smoke:\s*$/m },
      { description: 'validates production baseline variables', pattern: /npm run validate:production-baseline/ },
      { description: 'validates compose syntax', pattern: /docker compose -f docker-compose\.prod\.yml config/ },
      { description: 'builds the production image without deploy', pattern: /docker build -t inventory-api:operational-smoke \./ },
    ],
  },
];

function read(relativePath) {
  return fs.readFileSync(path.join(workflowsDirectory, relativePath), 'utf8');
}

function main() {
  const failures = [];

  for (const rule of workflowRules) {
    const absolutePath = path.join(workflowsDirectory, rule.relativePath);
    if (!fs.existsSync(absolutePath)) {
      failures.push(`${rule.relativePath}: workflow file is missing`);
      continue;
    }

    const source = read(rule.relativePath);
    for (const check of rule.checks) {
      if (!check.pattern.test(source)) {
        failures.push(`${rule.relativePath}: missing contract -> ${check.description}`);
      }
    }
  }

  if (failures.length > 0) {
    throw new Error(`Workflow baseline drift detected:\n- ${failures.join('\n- ')}`);
  }

  console.log(`Validated ${workflowRules.length} workflow baseline files.`);
}

if (require.main === module) {
  main();
}

module.exports = {
  workflowRules,
};
