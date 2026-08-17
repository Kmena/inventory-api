const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const envExamplePath = path.join(__dirname, '..', '.env.example');
const seedPath = path.join(__dirname, '..', 'prisma', 'seed.js');
const prismaGenerateSafePath = path.join(__dirname, '..', 'scripts', 'prisma-generate-safe.js');
const prismaGenerateSafeLibraryPath = path.join(__dirname, '..', 'scripts', 'prisma-generate-safe-lib.js');
const publicValidatorPath = path.join(__dirname, '..', 'scripts', 'validate-public-runtime.js');

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('build and prisma:generate use the guarded Prisma generate wrapper', () => {
  const packageJson = JSON.parse(readFile(packageJsonPath));
  const wrapperSource = readFile(prismaGenerateSafePath);
  const wrapperLibrarySource = readFile(prismaGenerateSafeLibraryPath);

  assert.equal(packageJson.scripts.build, 'node scripts/prisma-generate-safe.js');
  assert.equal(packageJson.scripts['prisma:generate'], 'node scripts/prisma-generate-safe.js');
  assert.match(wrapperSource, /executePrismaGenerateWithWindowsStabilization/);
  assert.match(wrapperSource, /getWindowsRetryDelayMs/);
  assert.match(wrapperLibrarySource, /query_engine-windows\.dll\.node\.tmp/);
  assert.match(wrapperLibrarySource, /windowsRetryDelayByAttempt/);
});

test('tracked seed source no longer contains explicit bootstrap passwords and requires private environment variables', () => {
  const seedSource = readFile(seedPath);
  const envExample = readFile(envExamplePath);

  assert.doesNotMatch(seedSource, /(?:admin|ventas|agente|supervisor|bodega)\d{3}/);
  assert.doesNotMatch(seedSource, /root\d{4}/);
  assert.match(seedSource, /SEED_ROOT_PASSWORD/);
  assert.match(seedSource, /SEED_ADMIN_PASSWORD/);
  assert.match(seedSource, /SEED_SALES_PASSWORD/);
  assert.match(seedSource, /SEED_SALES_AGENT_PASSWORD/);
  assert.match(seedSource, /SEED_SALES_SUPERVISOR_PASSWORD/);
  assert.match(seedSource, /SEED_WAREHOUSE_PASSWORD/);
  assert.match(envExample, /SEED_ROOT_PASSWORD=replace_me_private_seed_password/);
  assert.match(envExample, /SEED_WAREHOUSE_PASSWORD=replace_me_private_seed_password/);
});

test('public runtime validator phase 3 enforces the reduced supported public inventory and migration contracts', () => {
  const validatorSource = readFile(publicValidatorPath);

  assert.match(validatorSource, /validatePublicRuntimeInventory/);
  assert.match(validatorSource, /validateLoginRuntimeContracts/);
  assert.match(validatorSource, /validateMigrationRuntimeContracts/);
  assert.match(validatorSource, /legacy-public-runtime/);
  assert.match(validatorSource, /warehouse\/index\.html/);
  assert.match(validatorSource, /warehouse\/views\/receipts\.js/);
  assert.doesNotMatch(validatorSource, /relativePath: 'root\/dashboard\.js'/);
  assert.doesNotMatch(validatorSource, /relativePath: 'warehouse\/products\.js'/);
  assert.doesNotMatch(validatorSource, /relativePath: 'agent\/workspace\.js'/);
  assert.doesNotMatch(validatorSource, /Retired public runtime directory is still exposed from src\/public: warehouse/);
});
