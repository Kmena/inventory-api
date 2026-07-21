const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const publicRoot = path.join(__dirname, '..', 'src', 'public');

const HTML_WITHOUT_LOCAL_SCRIPT_ALLOWED = new Set(['no-access.html']);

const CRITICAL_JAVASCRIPT_RULES = [
  {
    relativePath: 'login.js',
    checks: [
      { description: 'submits credentials to the login API', pattern: /fetch\('\/api\/auth\/login', \{/ },
      { description: 'stores authenticated session in localStorage', pattern: /localStorage\.setItem\(STORAGE_KEY, JSON\.stringify\(data\)\);/ },
      { description: 'redirects authenticated users to a role home', pattern: /window\.location\.href = getHomeForSession\(/ },
    ],
  },
  {
    relativePath: 'root/index.js',
    checks: [
      { description: 'guards the root-only administrative screen', pattern: /if \(!session\?\.token \|\| session\?\.user\?\.role\?\.code !== 'root'\)/ },
      { description: 'sends authenticated administrative requests', pattern: /Authorization: `Bearer \$\{session\.token\}`/ },
      { description: 'clears local session on logout', pattern: /localStorage\.removeItem\(STORAGE_KEY\);/ },
      { description: 'returns to the public login on logout', pattern: /window\.location\.href = '\/'/ },
    ],
  },
  {
    relativePath: 'root/dashboard.js',
    checks: [
      { description: 'guards the company-admin dashboard screen', pattern: /if \(!session\?\.token \|\| session\?\.user\?\.role\?\.code !== 'admin'\)/ },
      { description: 'uses the preferred company dashboard API', pattern: /fetch\('\/api\/companies\/company\/dashboard', \{/ },
      { description: 'sends authenticated dashboard requests', pattern: /Authorization: `Bearer \$\{session\.token\}`/ },
      { description: 'clears local session on logout', pattern: /localStorage\.removeItem\(STORAGE_KEY\);/ },
    ],
  },
  {
    relativePath: 'root/clients.js',
    checks: [
      { description: 'reuses the shared root clients runtime helper', pattern: /const clientsShared = window\.RootClientsShared;/ },
      { description: 'builds authenticated headers through the shared helper', pattern: /const authHeaders = \(\) => clientsShared\.authHeaders\(session\);/ },
      { description: 'keeps protected document downloads behind the shared helper', pattern: /clientsShared\.downloadProtectedFile\(/ },
      { description: 'clears local session on logout', pattern: /localStorage\.removeItem\(STORAGE_KEY\);/ },
    ],
  },
  {
    relativePath: 'warehouse/products.js',
    checks: [
      { description: 'guards the warehouse screen behind an authenticated warehouse-capable session', pattern: /if \(!session\?\.token \|\| !canAccessWarehouse\)/ },
      { description: 'centralizes authenticated API access', pattern: /async function apiFetch\(url, options = \{\}\) \{/ },
      { description: 'sends bearer authorization in warehouse API requests', pattern: /Authorization: `Bearer \$\{session\.token\}`/ },
      { description: 'returns to login on unauthorized warehouse API responses', pattern: /if \(response\.status === 401\) \{[\s\S]*localStorage\.removeItem\(STORAGE_KEY\);[\s\S]*window\.location\.href = '\/'/ },
    ],
  },
  {
    relativePath: 'agent/workspace.js',
    checks: [
      { description: 'guards the agent workspace behind an authenticated company session', pattern: /if \(!session\?\.token \|\| !session\?\.user\?\.companyId\)/ },
      { description: 'builds authenticated headers for agent requests', pattern: /function authHeaders\(\) \{/ },
      { description: 'loads the agent dashboard through authenticated fetch', pattern: /fetch\('\/api\/agent\/dashboard', \{ headers: authHeaders\(\) \}\)/ },
      { description: 'clears local session on logout', pattern: /localStorage\.removeItem\(STORAGE_KEY\);/ },
    ],
  },
  {
    relativePath: 'agent/visit.js',
    checks: [
      { description: 'requires both authenticated session and store context', pattern: /if \(!session\?\.token \|\| !session\?\.user\?\.companyId \|\| !storeId\)/ },
      { description: 'loads store detail through authenticated fetch', pattern: /fetch\(`\/api\/agent\/stores\/\$\{storeId\}`/, },
      { description: 'posts visit updates through authenticated headers', pattern: /headers: authHeaders\(\),/ },
      { description: 'keeps workspace back navigation', pattern: /window\.location\.href = `\/agent\/workspace\.html\?storeId=\$\{storeId\}`/ },
    ],
  },
  {
    relativePath: 'agent/order-entry.js',
    checks: [
      { description: 'requires both authenticated session and store context', pattern: /if \(!session\?\.token \|\| !session\?\.user\?\.companyId \|\| !storeId\)/ },
      { description: 'loads order context through authenticated fetch', pattern: /fetch\(`\/api\/agent\/stores\/\$\{storeId\}\/order-context`/, },
      { description: 'posts draft orders through authenticated headers', pattern: /headers: authHeaders\(\),/ },
      { description: 'keeps workspace back navigation', pattern: /window\.location\.href = `\/agent\/workspace\.html\?storeId=\$\{storeId\}`/ },
    ],
  },
];

function toPosixPath(value) {
  return value.split(path.sep).join('/');
}

function readSource(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function listJavaScriptFiles(directory) {
  const collectedFiles = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collectedFiles.push(...listJavaScriptFiles(absolutePath));
      continue;
    }

    if (entry.isFile() && absolutePath.endsWith('.js')) {
      collectedFiles.push(absolutePath);
    }
  }

  return collectedFiles.sort();
}

function listHtmlFiles(directory) {
  const collectedFiles = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collectedFiles.push(...listHtmlFiles(absolutePath));
      continue;
    }

    if (entry.isFile() && absolutePath.endsWith('.html')) {
      collectedFiles.push(absolutePath);
    }
  }

  return collectedFiles.sort();
}

function validateJavaScriptSyntax(filePath) {
  new vm.Script(readSource(filePath), { filename: filePath });
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

function validateHtmlAssets(filePath) {
  const source = readSource(filePath);
  const assetReferences = collectLocalAssetReferences(source);
  const localScriptReferences = assetReferences.filter((assetPath) => assetPath.endsWith('.js'));

  for (const assetPath of assetReferences) {
    const absoluteAssetPath = path.join(publicRoot, assetPath.slice(1));
    if (!fs.existsSync(absoluteAssetPath)) {
      throw new Error(`Asset reference not found for ${toPosixPath(path.relative(publicRoot, filePath))}: ${assetPath}`);
    }
  }

  const relativePath = toPosixPath(path.relative(publicRoot, filePath));
  if (localScriptReferences.length === 0 && !HTML_WITHOUT_LOCAL_SCRIPT_ALLOWED.has(relativePath)) {
    throw new Error(`HTML runtime surface without local script reference: ${relativePath}`);
  }
}

function validateCriticalJavaScriptContracts() {
  const failures = [];

  for (const rule of CRITICAL_JAVASCRIPT_RULES) {
    const filePath = path.join(publicRoot, rule.relativePath);
    const source = readSource(filePath);

    for (const check of rule.checks) {
      if (!check.pattern.test(source)) {
        failures.push(`${rule.relativePath}: missing contract -> ${check.description}`);
      }
    }
  }

  if (failures.length > 0) {
    throw new Error(`Critical public runtime contract drift detected:\n- ${failures.join('\n- ')}`);
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

  for (const filePath of javascriptFiles) {
    validateJavaScriptSyntax(filePath);
  }

  for (const filePath of htmlFiles) {
    validateHtmlAssets(filePath);
  }

  validateCriticalJavaScriptContracts();

  console.log(`Validated embedded public runtime syntax and critical browser contracts for ${javascriptFiles.length} JS files and ${htmlFiles.length} HTML files.`);
}

if (require.main === module) {
  main();
}

module.exports = {
  collectLocalAssetReferences,
  listHtmlFiles,
  listJavaScriptFiles,
  validateCriticalJavaScriptContracts,
};
