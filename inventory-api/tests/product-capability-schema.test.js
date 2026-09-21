const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createProductSchema,
  updateProductSchema,
  productNatureSchema,
  productCommercialBehaviorSchema,
  productEntitlementKindSchema,
  productValidityUnitSchema,
  productBillingIntervalSchema,
} = require('../src/schemas/product.schema');

// MASTER-002 / NPP-TASK-002 — Product capability schema tests.
// Every rule below is enforced by the invariants in
// specs/non-physical-products-mvp/domain-model.md §3.

test('capability enum schemas expose only the approved values', () => {
  assert.deepEqual(productNatureSchema.options, ['GOOD', 'SERVICE']);
  assert.deepEqual(productCommercialBehaviorSchema.options, ['STANDARD', 'ENTITLEMENT']);
  assert.deepEqual(productEntitlementKindSchema.options, [
    'SUBSCRIPTION',
    'MEMBERSHIP',
    'AFFILIATION',
    'COURSE',
    'SERVICE_PERIOD',
  ]);
  assert.deepEqual(productValidityUnitSchema.options, ['DAY', 'MONTH', 'YEAR']);
  assert.deepEqual(productBillingIntervalSchema.options, ['MONTHLY', 'QUARTERLY', 'YEARLY']);
});

test('createProductSchema accepts a physical Product with default capability shape', () => {
  const result = createProductSchema.safeParse({
    name: 'Producto físico',
    productNature: 'GOOD',
    controlsInventory: true,
    commercialBehavior: 'STANDARD',
  });
  assert.equal(result.success, true);
  assert.equal(result.data.productNature, 'GOOD');
  assert.equal(result.data.controlsInventory, true);
  assert.equal(result.data.commercialBehavior, 'STANDARD');
});

test('createProductSchema accepts a Service with controlsInventory=false', () => {
  const result = createProductSchema.safeParse({
    name: 'Servicio de consultoría',
    productNature: 'SERVICE',
    controlsInventory: false,
    commercialBehavior: 'STANDARD',
  });
  assert.equal(result.success, true);
});

test('createProductSchema accepts an ENTITLEMENT subscription with validity metadata', () => {
  const result = createProductSchema.safeParse({
    name: 'Suscripción mensual',
    productNature: 'SERVICE',
    controlsInventory: false,
    commercialBehavior: 'ENTITLEMENT',
    entitlementKind: 'SUBSCRIPTION',
    defaultValidityCount: 1,
    defaultValidityUnit: 'MONTH',
    billingInterval: 'MONTHLY',
  });
  assert.equal(result.success, true);
  assert.equal(result.data.entitlementKind, 'SUBSCRIPTION');
  assert.equal(result.data.defaultValidityCount, 1);
});

test('createProductSchema rejects controlsInventory=false with initialLots', () => {
  const result = createProductSchema.safeParse({
    name: 'Servicio con lotes',
    productNature: 'SERVICE',
    controlsInventory: false,
    initialLots: [{ warehouseId: '1', quantity: 10, internalLotNumber: 'L1' }],
  });
  assert.equal(result.success, false);
  assert.ok(result.error.issues.some((i) => i.path.includes('initialLots')));
});

test('createProductSchema rejects controlsInventory=false with allowedWarehouseIds', () => {
  const result = createProductSchema.safeParse({
    name: 'Servicio con bodegas',
    productNature: 'SERVICE',
    controlsInventory: false,
    allowedWarehouseIds: ['5'],
  });
  assert.equal(result.success, false);
  assert.ok(result.error.issues.some((i) => i.path.includes('allowedWarehouseIds')));
});

test('createProductSchema rejects controlsInventory=false with requiresLot=true', () => {
  const result = createProductSchema.safeParse({
    name: 'Servicio con lote requerido',
    productNature: 'SERVICE',
    controlsInventory: false,
    requiresLot: true,
  });
  assert.equal(result.success, false);
  assert.ok(result.error.issues.some((i) => i.path.includes('requiresLot')));
});

test('createProductSchema rejects controlsInventory=false with requiresExpiration=true', () => {
  const result = createProductSchema.safeParse({
    name: 'Servicio con vencimiento',
    productNature: 'SERVICE',
    controlsInventory: false,
    requiresExpiration: true,
  });
  assert.equal(result.success, false);
  assert.ok(result.error.issues.some((i) => i.path.includes('requiresExpiration')));
});

test('createProductSchema rejects STANDARD with entitlementKind set', () => {
  const result = createProductSchema.safeParse({
    name: 'Estándar con derecho',
    commercialBehavior: 'STANDARD',
    entitlementKind: 'SUBSCRIPTION',
  });
  assert.equal(result.success, false);
  assert.ok(result.error.issues.some((i) => i.path.includes('entitlementKind')));
});

test('createProductSchema rejects ENTITLEMENT with controlsInventory=true', () => {
  const result = createProductSchema.safeParse({
    name: 'Derecho con inventario',
    productNature: 'SERVICE',
    controlsInventory: true,
    commercialBehavior: 'ENTITLEMENT',
    entitlementKind: 'SUBSCRIPTION',
  });
  assert.equal(result.success, false);
  assert.ok(result.error.issues.some((i) => i.path.includes('controlsInventory')));
});

test('createProductSchema rejects ENTITLEMENT with productNature=GOOD', () => {
  const result = createProductSchema.safeParse({
    name: 'Derecho como bien',
    productNature: 'GOOD',
    controlsInventory: false,
    commercialBehavior: 'ENTITLEMENT',
    entitlementKind: 'SUBSCRIPTION',
  });
  assert.equal(result.success, false);
  assert.ok(result.error.issues.some((i) => i.path.includes('productNature')));
});

test('createProductSchema rejects ENTITLEMENT without entitlementKind', () => {
  const result = createProductSchema.safeParse({
    name: 'Derecho sin tipo',
    productNature: 'SERVICE',
    controlsInventory: false,
    commercialBehavior: 'ENTITLEMENT',
  });
  assert.equal(result.success, false);
  assert.ok(result.error.issues.some((i) => i.path.includes('entitlementKind')));
});

test('createProductSchema rejects requiresExpiration=true with requiresLot=false', () => {
  const result = createProductSchema.safeParse({
    name: 'Físico contradictorio',
    controlsInventory: true,
    requiresLot: false,
    requiresExpiration: true,
  });
  assert.equal(result.success, false);
  assert.ok(result.error.issues.some((i) => i.path.includes('requiresExpiration')));
});

test('updateProductSchema accepts a partial capability update to reclassify as ENTITLEMENT', () => {
  const result = updateProductSchema.safeParse({
    productNature: 'SERVICE',
    controlsInventory: false,
    commercialBehavior: 'ENTITLEMENT',
    entitlementKind: 'MEMBERSHIP',
    defaultValidityCount: 12,
    defaultValidityUnit: 'MONTH',
  });
  assert.equal(result.success, true);
});

test('updateProductSchema rejects setting entitlementKind=null while behavior=ENTITLEMENT is set in same payload', () => {
  const result = updateProductSchema.safeParse({
    commercialBehavior: 'ENTITLEMENT',
    entitlementKind: null,
  });
  assert.equal(result.success, false);
  assert.ok(result.error.issues.some((i) => i.path.includes('entitlementKind')));
});

test('updateProductSchema accepts a purely commercial update without capability fields (backward compatibility)', () => {
  const result = updateProductSchema.safeParse({
    name: 'Nombre actualizado',
    price: 100,
  });
  assert.equal(result.success, true);
});
