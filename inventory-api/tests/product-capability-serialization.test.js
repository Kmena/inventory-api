const test = require('node:test');
const assert = require('node:assert/strict');

const { serializeProductForPermissions } = require('../src/services/product-permission-shaping.service');

// MASTER-002 / NPP-TASK-002 — Serializer must expose `inventoryApplicability`
// derived from Product.controlsInventory. Referenced by
// specs/non-physical-products-mvp/api-contracts.md §1.

const auth = { companyId: '1', sub: '10', permissions: ['inventory.view'] };
const catalogOnlyAuth = { companyId: '1', sub: '11', permissions: [] };

test('inventoryApplicability = APPLIES when controlsInventory is true', () => {
  const serialized = serializeProductForPermissions({
    id: 1n,
    name: 'Físico',
    controlsInventory: true,
  }, auth);
  assert.equal(serialized.inventoryApplicability, 'APPLIES');
});

test('inventoryApplicability = NOT_APPLICABLE when controlsInventory is false', () => {
  const serialized = serializeProductForPermissions({
    id: 2n,
    name: 'Servicio',
    controlsInventory: false,
  }, auth);
  assert.equal(serialized.inventoryApplicability, 'NOT_APPLICABLE');
});

test('inventoryApplicability defaults to APPLIES when controlsInventory is missing (legacy row)', () => {
  const serialized = serializeProductForPermissions({
    id: 3n,
    name: 'Producto histórico',
  }, auth);
  assert.equal(serialized.inventoryApplicability, 'APPLIES');
});

test('inventoryApplicability is preserved for catalog-only actors without inventory permissions', () => {
  const serialized = serializeProductForPermissions({
    id: 4n,
    name: 'Servicio en catálogo',
    controlsInventory: false,
    quantity: 100, // should be stripped
    reservedQuantity: 20, // should be stripped
    warehouseStocks: [{ warehouseId: 5, quantity: 3 }], // should be stripped
  }, catalogOnlyAuth);

  assert.equal(serialized.inventoryApplicability, 'NOT_APPLICABLE');
  assert.equal(serialized.quantity, undefined, 'catalog-only actor must not see stock counters');
  assert.equal(serialized.reservedQuantity, undefined);
  assert.equal(serialized.warehouseStocks, undefined);
});

test('serializer does not overwrite a pre-computed inventoryApplicability field', () => {
  const serialized = serializeProductForPermissions({
    id: 5n,
    name: 'Preserializado',
    controlsInventory: true,
    inventoryApplicability: 'NOT_APPLICABLE',
  }, auth);
  assert.equal(serialized.inventoryApplicability, 'NOT_APPLICABLE');
});

test('serializer returns null/undefined unchanged', () => {
  assert.equal(serializeProductForPermissions(null, auth), null);
  assert.equal(serializeProductForPermissions(undefined, auth), undefined);
});
