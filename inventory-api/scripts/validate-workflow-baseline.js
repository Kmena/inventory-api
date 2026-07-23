const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.join(__dirname, '..');
const workflowsDirectory = path.join(repositoryRoot, '.github', 'workflows');

const workflowRules = [
  {
    relativePath: 'static-checks.yml',
    checks: [
      { description: 'defines a static-checks job', pattern: /^\s{2}static-checks:\s*$/m },
      { description: 'installs dependencies with npm ci', pattern: /run:\s+npm ci/ },
      { description: 'generates Prisma client before checks', pattern: /run:\s+npm run build/ },
      { description: 'runs ESLint', pattern: /run:\s+npm run lint/ },
      { description: 'runs TypeScript typecheck', pattern: /run:\s+npm run typecheck/ },
      { description: 'lints embedded public runtime', pattern: /run:\s+npm run lint:public-runtime/ },
    ],
  },
  {
    relativePath: 'contract-validations.yml',
    checks: [
      { description: 'defines a contract-validations job', pattern: /^\s{2}contract-validations:\s*$/m },
      { description: 'validates embedded public runtime', pattern: /run:\s+npm run validate:public-runtime/ },
      { description: 'validates workflow baseline', pattern: /run:\s+npm run validate:workflow-baseline/ },
      { description: 'validates operational readiness', pattern: /run:\s+npm run validate:operational-readiness/ },
    ],
  },
  {
    relativePath: 'repository-tests.yml',
    checks: [
      { description: 'defines a repository-tests job', pattern: /^\s{2}repository-tests:\s*$/m },
      { description: 'runs repository test suite', pattern: /run:\s+npm run test/ },
    ],
  },
  {
    relativePath: 'browser-e2e.yml',
    checks: [
      { description: 'defines a browser-e2e job', pattern: /^\s{2}browser-e2e:\s*$/m },
      { description: 'installs Chromium for browser E2E', pattern: /playwright install --with-deps chromium/ },
      { description: 'runs browser E2E critical flows', pattern: /run:\s+npm run test:e2e:browser/ },
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
      { description: 'validates restore readiness evidence', pattern: /npm run validate:restore-readiness/ },
      { description: 'validates operational readiness evidence', pattern: /npm run validate:operational-readiness/ },
      { description: 'materializes a temporary production env file for compose smoke', pattern: /cat > \.env\.production <<EOF/ },
      { description: 'cleans temporary production env materialization', pattern: /rm -f \.env\.production/ },
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
