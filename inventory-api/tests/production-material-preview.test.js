const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

/*
 * TASK-006 (purchase-production-order-ux): Verify that the pre-order material
 * availability preview endpoint exists and has the expected contract.
 * FR-016, FR-017, FR-018, BR-007, AC-013, AC-014.
 */

const routeSource = readFileSync(
  resolve(__dirname, '../src/routes/production.routes.js'),
  'utf8',
);

const schemaSource = readFileSync(
  resolve(__dirname, '../src/schemas/production.schema.js'),
  'utf8',
);

const serviceSource = readFileSync(
  resolve(__dirname, '../src/services/production-material-availability.service.js'),
  'utf8',
);

describe('Pre-order material availability preview (TASK-006)', () => {

  it('route registers POST /orders/material-availability-preview with production.create policy', () => {
    assert.ok(
      routeSource.includes("'/orders/material-availability-preview'"),
      'Route path must be /orders/material-availability-preview',
    );
    assert.ok(
      routeSource.includes("authorizeAccessPolicy('production.create')") &&
      routeSource.includes('materialAvailabilityPreviewSchema'),
      'Route must use production.create policy and materialAvailabilityPreviewSchema',
    );
  });

  it('route is placed before /orders/:id to avoid Express param collision', () => {
    const previewIndex = routeSource.indexOf("'/orders/material-availability-preview'");
    const paramIndex = routeSource.indexOf("'/orders/:id'");
    assert.ok(
      previewIndex < paramIndex,
      'Preview route must appear before /orders/:id to avoid Express matching the literal as :id',
    );
  });

  it('schema materialAvailabilityPreviewSchema validates required fields', () => {
    assert.ok(schemaSource.includes('materialAvailabilityPreviewSchema'), 'Schema must export materialAvailabilityPreviewSchema');
    assert.ok(schemaSource.includes('productId: z.coerce.bigint()'), 'Must require productId');
    assert.ok(schemaSource.includes('recipeVersionId: z.coerce.bigint()'), 'Must require recipeVersionId');
    assert.ok(schemaSource.includes('originWarehouseId: z.coerce.bigint()'), 'Must require originWarehouseId');
  });

  it('service exports previewMaterialAvailability function', () => {
    assert.ok(
      serviceSource.includes('async function previewMaterialAvailability'),
      'Service must implement previewMaterialAvailability',
    );
    assert.ok(
      serviceSource.includes('previewMaterialAvailability'),
      'Service must export previewMaterialAvailability',
    );
  });

  it('service preview does not create an order (FR-017)', () => {
    // Extract the function body and filter active code lines
    const fnMatch = serviceSource.match(
      /async function previewMaterialAvailability[\s\S]*?^}/m,
    );
    assert.ok(fnMatch, 'previewMaterialAvailability should exist');
    const fnBody = fnMatch[0];
    const activeLines = fnBody.split('\n').filter((l) => {
      const t = l.trim();
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
    }).join('\n');

    assert.ok(
      !activeLines.includes('productionRepository.createProductionOrder'),
      'Preview function must NOT create an order in the database',
    );
    assert.ok(
      !activeLines.includes('.create('),
      'Preview function must NOT call .create() on a repository',
    );
  });

  it('service preview returns hasShortage and items with required/available/missing', () => {
    assert.ok(serviceSource.includes('hasShortage'), 'Response must include hasShortage');
    assert.ok(serviceSource.includes('required'), 'Items must include required quantity');
    assert.ok(serviceSource.includes('available'), 'Items must include available quantity');
    assert.ok(serviceSource.includes('missing'), 'Items must include missing quantity');
  });

  it('service preview validates company-scoped data (security)', () => {
    const fnMatch = serviceSource.match(
      /async function previewMaterialAvailability[\s\S]*?^}/m,
    );
    const fnBody = fnMatch[0];
    assert.ok(
      fnBody.includes('assertCompanyScope') || fnBody.includes('companyId'),
      'Preview must enforce company scope',
    );
  });
});
