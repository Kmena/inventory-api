const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.join(__dirname, '..');
const typecheckConfigPath = path.join(repositoryRoot, 'tsconfig.typecheck.json');
const controlsDocPath = path.join(repositoryRoot, 'docs', 'ci-critical-controls.md');
const architectureDocPath = path.join(repositoryRoot, 'docs', 'architecture.md');
const currentStateDocPath = path.join(repositoryRoot, 'docs', 'current-state.md');
const actionPlanDocPath = path.join(repositoryRoot, 'docs', 'action-plan.md');
const inventoryServicePath = path.join(repositoryRoot, 'src', 'services', 'inventory.service.js');
const inventoryTransactionSupportServicePath = path.join(repositoryRoot, 'src', 'services', 'inventory-transaction-support.service.js');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('typecheck scope includes the approved schema, repository surfaces, and first approved public-runtime slice', () => {
  const config = readJson(typecheckConfigPath);

  assert.equal(config.include.includes('src/schemas/**/*.js'), true);
  assert.equal(config.include.includes('src/repositories/sales-route.repository.js'), true);
  assert.equal(config.include.includes('src/repositories/order.repository.js'), true);
  assert.equal(config.include.includes('src/repositories/payment.repository.js'), true);
  assert.equal(config.include.includes('src/repositories/company.repository.js'), true);
  assert.equal(config.include.includes('src/repositories/invoice.repository.js'), true);
  assert.equal(config.include.includes('src/repositories/inventory.repository.js'), true);
  assert.equal(config.include.includes('src/security/access-policies.js'), true);
  assert.equal(config.include.includes('scripts/validate-workflow-baseline.js'), true);
  assert.equal(config.include.includes('scripts/validate-operational-readiness.js'), true);
  assert.equal(config.include.includes('scripts/validate-production-baseline.js'), true);
  assert.equal(config.include.includes('src/public/shared/session.js'), true);
  assert.equal(config.include.includes('src/public/shared/auth.js'), true);
  assert.equal(config.include.includes('src/public/login.js'), true);
  for (const rootShellFile of [
    'src/public/root/app.js',
    'src/public/root/router.js',
    'src/public/root/manifest.js',
    'src/public/root/guards.js',
    'src/public/root/registry.js',
    'src/public/root/session-adapter.js',
    'src/public/root/ui.js',
    'src/public/root/companies-api.js',
    'src/public/root/roles-api.js',
    'src/public/root/zones-api.js',
    'src/public/root/agents-api.js',
    'src/public/root/clients-api.js',
    'src/public/root/routes-api.js',
    'src/public/root/views/home.js',
    'src/public/root/views/in-process.js',
    'src/public/root/views/companies-admin.js',
    'src/public/root/views/roles-admin.js',
    'src/public/root/views/zones-admin.helpers.js',
    'src/public/root/views/zones-admin.js',
    'src/public/root/views/agents-admin.helpers.js',
    'src/public/root/views/agents-admin.renderers.js',
    'src/public/root/views/agents-admin.js',
    'src/public/root/views/clients-admin.helpers.js',
    'src/public/root/views/clients-admin.renderers.js',
    'src/public/root/views/clients-admin.state.js',
    'src/public/root/views/clients-admin.js',
    'src/public/root/views/routes-admin.helpers.js',
    'src/public/root/views/routes-admin.renderers.js',
    'src/public/root/views/routes-admin.state.js',
    'src/public/root/views/routes-admin.js',
  ]) {
    assert.equal(config.include.includes(rootShellFile), true, `${rootShellFile} should be part of the approved root-shell typecheck allowlist`);
  }
  assert.equal(config.include.includes('src/public/root/index.js'), false);
  assert.equal(config.include.includes('src/public/warehouse/products.js'), false);
  assert.equal(config.include.includes('src/public/agent/workspace.js'), false);
  assert.equal(config.exclude.includes('src/schemas/**'), false);
  assert.equal(config.exclude.includes('src/repositories/sales-route.repository.js'), false);
  assert.equal(config.exclude.includes('src/repositories/inventory.repository.js'), false);
  assert.equal(config.exclude.includes('src/public/**'), false);
});

test('critical controls documentation keeps the evidence categories, public-runtime first slice, and mandatory workflow mapping explicit', () => {
  const source = readText(controlsDocPath);

  assert.match(source, /Strong evidence/i);
  assert.match(source, /Partial characterization/i);
  assert.match(source, /Optional or skipped evidence/i);
  assert.match(source, /`static-checks`/);
  assert.match(source, /`repository-tests`/);
  assert.match(source, /`db-constraints-tests`/);
  assert.match(source, /`tests\/p2-hardening-constraints\.test\.js`/);
  assert.match(source, /src\/public\/shared\/session\.js/);
  assert.match(source, /src\/public\/shared\/auth\.js/);
  assert.match(source, /src\/public\/login\.js/);
  assert.match(source, /cannot be the sole closure signal|cannot be the only closure evidence/i);
});

test('inventory persistence hardening keeps direct Prisma transaction model calls out of the targeted services', () => {
  const serviceSource = readText(inventoryServicePath);
  const supportSource = readText(inventoryTransactionSupportServicePath);
  const forbiddenPatterns = [
    /tx\.(inventory|warehouse|product|lot|warehouseStock|warehouseLotStock|stockMovement|inventoryAlert|lotStatusHistory|order)\./,
    /\$executeRaw/,
  ];

  for (const pattern of forbiddenPatterns) {
    assert.equal(pattern.test(serviceSource), false, `inventory.service.js still matches ${pattern}`);
    assert.equal(pattern.test(supportSource), false, `inventory-transaction-support.service.js still matches ${pattern}`);
  }
});

test('browser session residual-risk docs stay explicitly linked to the HTTPS follow-up migration without presenting it as an in-slice blocker', () => {
  const architectureSource = readText(architectureDocPath);
  const currentStateSource = readText(currentStateDocPath);
  const actionPlanSource = readText(actionPlanDocPath);

  for (const source of [architectureSource, currentStateSource, actionPlanSource]) {
    assert.match(source, /specs\/p11-https-browser-session-migration\//);
    assert.match(source, /residual risk|follow-up dependency/i);
  }

  assert.match(architectureSource, /not an in-slice blocker/i);
  assert.match(currentStateSource, /not an in-slice blocker/i);
});
