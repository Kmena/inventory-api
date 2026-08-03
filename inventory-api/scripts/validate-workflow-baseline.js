const fs = require('node:fs');
const path = require('node:path');

const applicationRoot = path.join(__dirname, '..');
const hostedRepositoryRoot = path.resolve(applicationRoot, '..');
const workflowsDirectory = path.join(hostedRepositoryRoot, '.github', 'workflows');
const localWorkflowDirectory = path.join(applicationRoot, '.github', 'workflows');

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
    relativePath: 'db-constraints-tests.yml',
    checks: [
      { description: 'defines a dedicated db-constraints-tests job', pattern: /^\s{2}db-constraints-tests:\s*$/m },
      { description: 'provisions the P2 constraints database url', pattern: /P2_CONSTRAINTS_DATABASE_URL:\s+postgresql:\/\/postgres:postgres@127\.0\.0\.1:5432\/inventory_api_constraints\?schema=public/ },
      { description: 'runs a postgres service for focused constraints evidence', pattern: /^\s{6}postgres:\s*$/m },
      { description: 'installs dependencies with npm ci', pattern: /run:\s+npm ci/ },
      { description: 'generates Prisma client before DB setup', pattern: /run:\s+npm run build/ },
      { description: 'applies committed migrations', pattern: /run:\s+npm run prisma:apply-committed-migrations/ },
      { description: 'seeds the constraints database with CI-only credentials', pattern: /run:\s+npm run prisma:seed/ },
      { description: 'runs the focused p2 constraints test suite', pattern: /run:\s+node --test tests\/p2-hardening-constraints\.test\.js/ },
    ],
  },
  {
    relativePath: 'windows-prisma-build.yml',
    checks: [
      { description: 'defines a dedicated Windows Prisma build job', pattern: /^\s{2}windows-prisma-build:\s*$/m },
      { description: 'runs on windows-latest', pattern: /runs-on:\s+windows-latest/ },
      { description: 'pins Node.js 24', pattern: /node-version:\s+'24'/ },
      { description: 'installs dependencies with npm ci', pattern: /run:\s+npm ci/ },
      { description: 'runs the guarded Prisma build on Windows', pattern: /npm run build/ },
      { description: 'captures the guarded build step with explicit id', pattern: /id:\s+prisma_build/ },
      { description: 'publishes a workflow summary for audit evidence', pattern: /GITHUB_STEP_SUMMARY/ },
      { description: 'uploads the Prisma Windows build log artifact', pattern: /uses:\s+actions\/upload-artifact@v4/ },
      { description: 'preserves the real build exit code through explicit failure gate', pattern: /Fail workflow when guarded Prisma build fails/ },
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
    relativePath: 'redis-browser-session-tests.yml',
    checks: [
      { description: 'defines a dedicated redis-browser-session-tests job', pattern: /^\s{2}redis-browser-session-tests:\s*$/m },
      { description: 'installs dependencies with npm ci', pattern: /run:\s+npm ci/ },
      { description: 'generates Prisma client before Redis-path validation', pattern: /run:\s+npm run build/ },
      { description: 'runs the dedicated Redis-path browser-session validation command', pattern: /run:\s+npm run test:redis-path/ },
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
      { description: 'provisions Redis URL for the production browser-session store baseline', pattern: /REDIS_URL:\s+redis:\/\/redis:6379\/0/ },
      { description: 'cleans temporary production env materialization', pattern: /rm -f \.env\.production/ },
      { description: 'validates compose syntax', pattern: /docker compose -f docker-compose\.prod\.yml config/ },
      { description: 'builds the production image without deploy', pattern: /docker build -t inventory-api:operational-smoke \./ },
    ],
  },
  {
    relativePath: 'p0-quality-gates.yml',
    checks: [
      { description: 'defines a quality-gates job', pattern: /^\s{2}quality-gates:\s*$/m },
      { description: 'pins Node.js 24 for the legacy P0 gate', pattern: /node-version:\s+24/ },
      { description: 'executes from inventory-api as the working directory', pattern: /working-directory:\s+inventory-api/ },
      { description: 'runs lint in the legacy P0 gate', pattern: /run:\s+npm run lint/ },
      { description: 'runs typecheck in the legacy P0 gate', pattern: /run:\s+npm run typecheck/ },
      { description: 'runs build in the legacy P0 gate', pattern: /run:\s+npm run build/ },
      { description: 'runs repository tests in the legacy P0 gate', pattern: /run:\s+npm run test/ },
    ],
  },
];

function read(relativePath) {
  return fs.readFileSync(path.join(workflowsDirectory, relativePath), 'utf8');
}

function formatWorkflowOwnershipGuidance() {
  return [
    `Authoritative hosted workflows are expected in: ${path.relative(applicationRoot, workflowsDirectory)}`,
    `Application-local workflow directory is not authoritative today: ${path.relative(applicationRoot, localWorkflowDirectory)}`,
    'If parent-root workflow files are missing, run this validator from the hosted repository checkout that contains ../.github/workflows/ or restore the approved parent-root workflow baseline before treating the result as repository drift.',
  ].join('\n');
}

function describeMissingWorkflow(relativePath) {
  return `${relativePath}: workflow file is missing\n${formatWorkflowOwnershipGuidance()}`;
}

function main() {
  const failures = [];

  for (const rule of workflowRules) {
    const absolutePath = path.join(workflowsDirectory, rule.relativePath);
    if (!fs.existsSync(absolutePath)) {
      failures.push(describeMissingWorkflow(rule.relativePath));
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
  workflowsDirectory,
  localWorkflowDirectory,
  formatWorkflowOwnershipGuidance,
  describeMissingWorkflow,
};
