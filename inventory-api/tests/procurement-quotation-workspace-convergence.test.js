const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.join(__dirname, '..');

function readRepositoryFile(relativePath) {
  return fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8');
}

test('procurement quotation workspace convergence keeps migrations, backend routes, root shell wiring and tests aligned', () => {
  const permissionMigration = readRepositoryFile('prisma/migrations/20260822000000_backfill_suppliers_permission_catalog/migration.sql');
  const pricingMigration = readRepositoryFile('prisma/migrations/20260822001000_backfill_supplier_product_pricing_convergence/migration.sql');
  const procurementRoutesSource = readRepositoryFile('src/routes/procurement.routes.js');
  const procurementServiceSource = readRepositoryFile('src/services/procurement.service.js');
  const procurementRfqServiceSource = readRepositoryFile('src/services/procurement-rfq.service.js');
  const procurementSchemaSource = readRepositoryFile('src/schemas/procurement.schema.js');
  const quotationsApiSource = readRepositoryFile('src/public/root/quotations-api.js');
  const quotationsViewSource = readRepositoryFile('src/public/root/views/quotations-admin.js');
  const quotationsRenderersSource = readRepositoryFile('src/public/root/views/quotations-admin.renderers.js');
  const rfqTrackingRenderersSource = readRepositoryFile('src/public/root/views/rfq-tracking-admin.renderers.js');
  const manifestSource = readRepositoryFile('src/public/root/manifest.js');
  const routerSource = readRepositoryFile('src/public/root/router.js');
  const rootIndexSource = readRepositoryFile('src/public/root/index.html');
  const implementationReportSource = readRepositoryFile('../specs/procurement-quotation-workspace/implementation-report.md');

  assert.match(permissionMigration, /suppliers\.view/);
  assert.match(permissionMigration, /suppliers\.manage/);
  assert.match(pricingMigration, /ADD COLUMN "unit_price" DECIMAL\(14, 2\)/);
  assert.match(pricingMigration, /SET "currency" = 'CRC'/);

  assert.match(procurementRoutesSource, /router\.get\('\/quotable-products'/);
  assert.match(procurementRoutesSource, /authorizeAccessPolicy\('procurement\.view'\)/);
  assert.match(procurementRoutesSource, /router\.get\('\/products\/:id\/suppliers-pricing'/);
  assert.match(procurementRoutesSource, /router\.post\('\/products\/:id\/request-quotations'/);
  assert.match(procurementRoutesSource, /authorizeAccessPolicy\('procurement\.manage'\)/);

  assert.match(procurementServiceSource, /async function listQuotableProducts\(auth\)/);
  assert.match(procurementServiceSource, /shortage: calculateProductShortage\(product\)/);
  assert.match(procurementServiceSource, /async function getProductSuppliersPricing\(productId, auth\)/);
  assert.match(procurementServiceSource, /async function createAssistedQuotationRequest\(payload, auth\)/);
  assert.match(procurementServiceSource, /groupedBySupplier/);

  assert.match(procurementSchemaSource, /const createAssistedQuotationRequestSchema = z\.object\(/);
  assert.match(procurementSchemaSource, /products: z\.array\(assistedQuotationProductSchema\)\.min\(1\)/);
  assert.match(procurementSchemaSource, /suppliers: z\.array\(assistedQuotationSupplierSchema\)\.min\(1\)/);

  assert.match(quotationsApiSource, /'\/api\/procurement\/quotable-products'/);
  assert.match(quotationsApiSource, /\/api\/procurement\/products\/\$\{productId\}\/suppliers-pricing/);
  assert.match(quotationsApiSource, /\/api\/procurement\/products\/\$\{products\[0\]\.productId\}\/request-quotations/);
  assert.match(quotationsApiSource, /\/api\/procurement\/rfq-tracking/);
  // Flujo de cotizacion directa (sin invitacion RFQ)
  assert.match(quotationsApiSource, /\/api\/procurement\/requests\/\$\{purchaseRequestId\}\/quotations/);
  assert.match(quotationsApiSource, /createDirectQuotation/);
  assert.match(quotationsApiSource, /'\/api\/suppliers\/company'/);
  assert.match(quotationsApiSource, /listSuppliers/);

  assert.match(procurementRfqServiceSource, /serializeQuotationResponseSummary/);
  assert.match(procurementRfqServiceSource, /manualResponseCount/);
  assert.match(procurementRfqServiceSource, /publicResponseCount/);
  assert.match(quotationsViewSource, /Solicitud activa/);
  assert.match(quotationsViewSource, /rfq-response-details-dialog/);
  assert.match(quotationsRenderersSource, /renderResponseDetails/);
  assert.match(rfqTrackingRenderersSource, /Pendiente de invitar/);
  assert.match(rfqTrackingRenderersSource, /Detalle de respuestas/);

  assert.match(manifestSource, /id: 'cotizaciones'/);
  assert.match(manifestSource, /routeKey: 'cotizaciones'/);
  assert.match(manifestSource, /implemented: true/);
  assert.match(routerSource, /const quotationsAdminView = rootShell\.require\('views\.quotationsAdmin'\)/);
  assert.match(routerSource, /if \(item\.routeKey === 'cotizaciones'\) \{/);
  assert.match(rootIndexSource, /<script src="\/root\/quotations-api\.js"><\/script>/);
  assert.match(rootIndexSource, /<script src="\/root\/views\/quotations-admin\.helpers\.js"><\/script>/);
  assert.match(rootIndexSource, /<script src="\/root\/views\/quotations-admin\.renderers\.js"><\/script>/);
  assert.match(rootIndexSource, /<script src="\/root\/views\/quotations-admin\.js"><\/script>/);

  assert.match(implementationReportSource, /TASK-008: Suite final de convergencia procurement\/root shell/);
  assert.match(implementationReportSource, /TASK-007/);
});

test('procurement quotation workspace convergence keeps focused evidence suites present in repository', () => {
  const expectedTestFiles = [
    'tests/suppliers-permission-catalog-backfill-migration.test.js',
    'tests/supplier-pricing-migration.test.js',
    'tests/procurement-foundation.test.js',
    'tests/procurement-routes-contract.test.js',
    'tests/root-shell-quotations-api-characterization.test.js',
    'tests/quotations-view-characterization.test.js',
    'tests/root-shell-supply-manifest.test.js',
    'tests/root-shell-router-characterization.test.js',
    'tests/public-surface-characterization.test.js',
    'tests/public-runtime-http-smoke.test.js',
    'tests/procurement-quotation-workspace-convergence.test.js',
  ];

  for (const relativePath of expectedTestFiles) {
    assert.equal(fs.existsSync(path.join(repositoryRoot, relativePath)), true, `${relativePath} should exist as part of the approved convergence suite`);
  }
});
