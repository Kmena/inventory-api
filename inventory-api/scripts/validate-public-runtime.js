const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const publicRoot = path.join(__dirname, '..', 'src', 'public');
const legacyRuntimeRoot = path.join(__dirname, '..', 'legacy-public-runtime');

const expectedHtmlFiles = ['index.html', 'migration.html', 'no-access.html'];
const expectedJavaScriptFiles = [
  'login.js',
  'migration.js',
  'no-access.js',
  'shared/auth.js',
  'shared/session.js',
];

function toPosixPath(value) {
  return value.split(path.sep).join('/');
}

function readSource(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function listFilesWithExtension(directory, extension) {
  const collectedFiles = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collectedFiles.push(...listFilesWithExtension(absolutePath, extension));
      continue;
    }

    if (entry.isFile() && absolutePath.endsWith(extension)) {
      collectedFiles.push(absolutePath);
    }
  }

  return collectedFiles.sort();
}

function listJavaScriptFiles(directory) {
  return listFilesWithExtension(directory, '.js');
}

function listHtmlFiles(directory) {
  return listFilesWithExtension(directory, '.html');
}

function collectLocalAssetReferences(htmlSource) {
  const assetReferences = [];
  const assetRegex = /<(script|link)\b[^>]+(?:src|href)="([^"]+)"/g;

  for (const match of htmlSource.matchAll(assetRegex)) {
    const assetPath = match[2];
    if (!assetPath || assetPath.startsWith('http://') || assetPath.startsWith('https://')) {
      continue;
    }

    if (!assetPath.startsWith('/')) {
      continue;
    }

    assetReferences.push(assetPath);
  }

  return assetReferences;
}

function validateJavaScriptSyntax(filePath) {
  new vm.Script(readSource(filePath), { filename: filePath });
}

function validateHtmlAssets(filePath) {
  const source = readSource(filePath);
  const assetReferences = collectLocalAssetReferences(source);

  for (const assetPath of assetReferences) {
    const absoluteAssetPath = path.join(publicRoot, assetPath.slice(1));
    if (!fs.existsSync(absoluteAssetPath)) {
      throw new Error(`Asset reference not found for ${toPosixPath(path.relative(publicRoot, filePath))}: ${assetPath}`);
    }
  }
}

function assertExactSupportedFileSet(relativePaths, expectedRelativePaths, label) {
  const actual = [...relativePaths].sort();
  const expected = [...expectedRelativePaths].sort();

  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} drift detected. Expected ${expected.join(', ')} but found ${actual.join(', ')}`);
  }
}

function validatePublicRuntimeInventory() {
  const htmlFiles = listHtmlFiles(publicRoot).map((filePath) => toPosixPath(path.relative(publicRoot, filePath)));
  const javascriptFiles = listJavaScriptFiles(publicRoot).map((filePath) => toPosixPath(path.relative(publicRoot, filePath)));

  assertExactSupportedFileSet(htmlFiles, expectedHtmlFiles, 'Public HTML inventory');
  assertExactSupportedFileSet(javascriptFiles, expectedJavaScriptFiles, 'Public JavaScript inventory');

  for (const retiredDirectory of ['root', 'warehouse', 'agent']) {
    if (fs.existsSync(path.join(publicRoot, retiredDirectory))) {
      throw new Error(`Retired public runtime directory is still exposed from src/public: ${retiredDirectory}`);
    }
  }

  for (const relocatedDirectory of ['root', 'warehouse', 'agent']) {
    if (!fs.existsSync(path.join(legacyRuntimeRoot, relocatedDirectory))) {
      throw new Error(`Expected relocated legacy runtime directory not found: ${relocatedDirectory}`);
    }
  }

  if (!fs.existsSync(path.join(legacyRuntimeRoot, 'shared', 'lot-dates.js'))) {
    throw new Error('Expected relocated legacy shared helper not found: shared/lot-dates.js');
  }
}

function validateLoginRuntimeContracts() {
  const failures = [];
  const loginSource = readSource(path.join(publicRoot, 'login.js'));
  const loginHtmlSource = readSource(path.join(publicRoot, 'index.html'));
  const sessionHelperSource = readSource(path.join(publicRoot, 'shared', 'session.js'));
  const authHelperSource = readSource(path.join(publicRoot, 'shared', 'auth.js'));

  const loginSourceContracts = [
    { description: 'uses the shared browser session helper', snippets: ['const inventorySession = window.InventorySession;', 'const inventorySession = /** @type {any} */ (window).InventorySession;'] },
    { description: 'uses the shared browser auth helper', snippets: ['const inventoryAuth = window.InventoryAuth;', 'const inventoryAuth = /** @type {any} */ (window).InventoryAuth;'] },
    { description: 'declares the supported login endpoint', snippets: ['/api/auth/login'] },
    { description: 'persists authenticated session through the shared session helper', snippets: ['inventorySession.write(session);'] },
    { description: 'restores existing sessions through the shared session helper', snippets: ['inventorySession.read();'] },
    { description: 'routes retired-runtime roles to the supported post-login transition landing', snippets: ["'/migration.html?mode=post-login-transition'", "const POST_LOGIN_TRANSITION_PATH = '/migration.html?mode=post-login-transition';"] },
  ];

  for (const contract of loginSourceContracts) {
    if (!contract.snippets.some((snippet) => loginSource.includes(snippet))) {
      failures.push(`login.js: missing contract -> ${contract.description}`);
    }
  }

  if (!sessionHelperSource.includes('clearAndRedirectToLogin')) {
    failures.push('shared/session.js: missing contract -> clearAndRedirectToLogin');
  }

  if (!authHelperSource.includes('async function fetchJson(session, url, options = {})')) {
    failures.push('shared/auth.js: missing contract -> fetchJson');
  }

  if (!loginHtmlSource.includes('/shared/session.js') || !loginHtmlSource.includes('/shared/auth.js') || !loginHtmlSource.includes('/login.js')) {
    failures.push('index.html: missing contract -> same-origin helper/script wiring');
  }

  if (failures.length > 0) {
    throw new Error(`Critical login runtime contract drift detected:\n- ${failures.join('\n- ')}`);
  }
}

function validateMigrationRuntimeContracts() {
  const migrationHtmlSource = readSource(path.join(publicRoot, 'migration.html'));
  const migrationSource = readSource(path.join(publicRoot, 'migration.js'));

  if (!migrationHtmlSource.includes('Esta ruta ya no se encuentra disponible')) {
    throw new Error('migration.html: missing contract -> deprecated-route title baseline');
  }

  if (!migrationHtmlSource.includes('Codigo de estado: 410')) {
    throw new Error('migration.html: missing contract -> explicit 410 note baseline');
  }

  if (!migrationHtmlSource.includes('id="migration-primary-message"') || !migrationHtmlSource.includes('id="migration-secondary-message"') || !migrationHtmlSource.includes('id="migration-status-note"')) {
    throw new Error('migration.html: missing contract -> multi-context content targets');
  }

  if (!migrationHtmlSource.includes('href="/"')) {
    throw new Error('migration.html: missing contract -> return to login CTA');
  }

  if (!migrationHtmlSource.includes('/shared/session.js') || !migrationHtmlSource.includes('/migration.js')) {
    throw new Error('migration.html: missing contract -> same-origin helper/script wiring');
  }

  if (!migrationSource.includes("const POST_LOGIN_TRANSITION_MODE = 'post-login-transition';")) {
    throw new Error('migration.js: missing contract -> post-login transition mode constant');
  }

  if (!migrationSource.includes('new URLSearchParams(window.location.search)')) {
    throw new Error('migration.js: missing contract -> query-param mode detection');
  }

  if (!migrationSource.includes('Tu acceso fue actualizado')) {
    throw new Error('migration.js: missing contract -> generic post-login transition title');
  }

  if (!migrationSource.includes('migrationStatusNote.hidden = true;')) {
    throw new Error('migration.js: missing contract -> hides 410 note in post-login mode');
  }

  if (!migrationSource.includes('inventorySession.clearAndRedirectToLogin()')) {
    throw new Error('migration.js: missing contract -> logout redirect helper');
  }
}

function main() {
  const javascriptFiles = listJavaScriptFiles(publicRoot);
  const htmlFiles = listHtmlFiles(publicRoot);

  if (javascriptFiles.length === 0) {
    throw new Error('No se encontraron archivos JavaScript en src/public');
  }

  if (htmlFiles.length === 0) {
    throw new Error('No se encontraron archivos HTML en src/public');
  }

  validatePublicRuntimeInventory();

  for (const filePath of javascriptFiles) {
    validateJavaScriptSyntax(filePath);
  }

  for (const filePath of htmlFiles) {
    validateHtmlAssets(filePath);
  }

  validateLoginRuntimeContracts();
  validateMigrationRuntimeContracts();

  console.log(`Validated reduced public runtime syntax and contracts for ${javascriptFiles.length} JS files and ${htmlFiles.length} HTML files.`);
}

if (require.main === module) {
  main();
}

module.exports = {
  collectLocalAssetReferences,
  listHtmlFiles,
  listJavaScriptFiles,
  validateLoginRuntimeContracts,
  validateMigrationRuntimeContracts,
  validatePublicRuntimeInventory,
};
