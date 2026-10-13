/* global process, URL, localStorage, fetch */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

function readEnvValue(filePath, name) {
  const content = fs.readFileSync(filePath, 'utf8');
  const line = content.split(/\r?\n/u).find((entry) => entry.startsWith(`${name}=`));
  if (!line) throw new Error(`${name} is not configured in ${path.basename(filePath)}`);
  const raw = line.slice(name.length + 1).trim();
  return raw.replace(/^(['"])(.*)\1$/u, '$2');
}

async function main() {
  const appRoot = process.env.INVENTORI_APP_ROOT || process.cwd();
  const baseUrl = process.env.INVENTORI_LOCAL_URL || 'http://localhost:2500';
  const envFile = path.resolve(appRoot, '.env.production');
  const password = readEnvValue(envFile, 'SEED_ADMIN_PASSWORD');
  const evidenceDir = path.resolve(appRoot, 'test-results', 'company1-activation');
  fs.mkdirSync(evidenceDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const responses = [];

  page.on('response', async (response) => {
    const requestUrl = response.url();
    if (!requestUrl.includes('/api/company/fiscal-settings')) return;
    let safeCode = null;
    try {
      const body = await response.json();
      safeCode = body?.code || body?.error?.code || null;
    } catch {
      // Non-JSON responses have no safe error code to record.
    }
    responses.push({
      method: response.request().method(),
      path: new URL(requestUrl).pathname,
      status: response.status(),
      code: safeCode,
      correlationId: response.headers()['x-correlation-id'] || null,
    });
  });

  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Usuario').fill('admin');
  await page.getByLabel('Contrasena').fill(password);
  const loginResponsePromise = page.waitForResponse((response) => (
    response.request().method() === 'POST'
      && new URL(response.url()).pathname === '/api/auth/login'
  ), { timeout: 15_000 });
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  const loginResponse = await loginResponsePromise;
  if (!loginResponse.ok()) {
    let safeCode = null;
    try {
      const body = await loginResponse.json();
      safeCode = body?.code || body?.error?.code || null;
    } catch {
      // Do not expose response bodies from failed authentication.
    }
    throw new Error(`Normal admin login failed with HTTP ${loginResponse.status()}${safeCode ? ` (${safeCode})` : ''}`);
  }
  await page.waitForURL((url) => url.pathname.startsWith('/root/'), { timeout: 15_000, waitUntil: 'domcontentloaded' });

  await page.goto(`${baseUrl}/root/#configuracion_fiscal`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Configuración fiscal' }).waitFor({ timeout: 15_000 });
  await page.getByRole('heading', { name: 'Listo para facturar electrónicamente' }).waitFor({ timeout: 20_000 });

  const session = await page.evaluate(() => {
    for (const [, value] of Object.entries(localStorage)) {
      try {
        const parsed = JSON.parse(value);
        if (parsed?.user?.username === 'admin') return parsed;
      } catch {
        // Ignore unrelated local storage values.
      }
    }
    return null;
  });

  const bodyText = await page.locator('body').innerText();
  const testButton = page.getByRole('button', { name: 'Probar facturación en SANDBOX' });
  const sandboxActionCount = await testButton.count();
  const sandboxActionVisible = sandboxActionCount > 0 && await testButton.first().isVisible();
  const sandboxActionEnabled = sandboxActionVisible && await testButton.first().isEnabled();

  const directChecks = await page.evaluate(async () => {
    const paths = [
      '/api/company/fiscal-settings',
      '/api/company/fiscal-settings/readiness',
      '/api/company/fiscal-settings/issuer',
      '/api/company/fiscal-settings/security',
      '/api/company/fiscal-settings/issuance-points',
    ];
    return Promise.all(paths.map(async (requestPath) => {
      const response = await fetch(requestPath, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
      let code = null;
      try {
        const body = await response.clone().json();
        code = body?.code || body?.error?.code || null;
      } catch {
        // Keep the report secret-free when a route returns non-JSON.
      }
      return {
        path: requestPath,
        status: response.status,
        code,
        correlationId: response.headers.get('x-correlation-id'),
      };
    }));
  });

  const screenshotPath = path.join(evidenceDir, 'authenticated-fiscal-admin.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const report = {
    authenticatedUser: session?.user?.username || null,
    activeCompanyId: session?.user?.companyId || null,
    role: session?.user?.role?.code || null,
    fiscalPermissions: (session?.user?.permissions || []).filter((permission) => String(permission).startsWith('fiscal.')).sort(),
    url: page.url(),
    ui: {
      readyHeading: bodyText.includes('Listo para facturar electrónicamente'),
      disabledIntegrationError: bodyText.includes('BILLING_INTEGRATION_DISABLED'),
      historicalOnlyWarning: bodyText.includes('Asociación solo histórica'),
      issuerVisible: bodyText.includes('Emisor fiscal') && bodyText.includes('207530251'),
      haciendaVisible: bodyText.includes('Conexión con Hacienda'),
      certificateVisible: bodyText.includes('Certificado'),
      branchesVisible: bodyText.includes('Sucursales') || bodyText.includes('Sucursal'),
      terminalsVisible: bodyText.includes('Terminales') || bodyText.includes('Terminal'),
      loadingVisible: bodyText.includes('Comprobando preparación fiscal'),
      sandboxActionVisible,
      sandboxActionEnabled,
    },
    responses,
    directChecks,
    screenshotPath,
  };

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}

main().catch((error) => {
  process.stderr.write(`${error.name}: ${error.message}\n`);
  process.exitCode = 1;
});
