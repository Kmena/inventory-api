const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createSupplierSchema,
  updateSupplierSchema,
  addProductToSupplierSchema,
} = require('../src/schemas/supplier.schema');

// --- createSupplierSchema ---

test('createSupplierSchema accepts minimal valid payload with only name', () => {
  const result = createSupplierSchema.safeParse({ name: 'Proveedor ABC' });
  assert.equal(result.success, true);
  assert.equal(result.data.name, 'Proveedor ABC');
});

test('createSupplierSchema accepts complete valid payload', () => {
  const result = createSupplierSchema.safeParse({
    name: 'Proveedor XYZ',
    email: 'contact@xyz.com',
    phone: '8888-8888',
    country: 'Costa Rica',
    note: 'Proveedor principal',
  });
  assert.equal(result.success, true);
  assert.equal(result.data.email, 'contact@xyz.com');
  assert.equal(result.data.country, 'Costa Rica');
});

test('createSupplierSchema rejects empty name', () => {
  const result = createSupplierSchema.safeParse({ name: '' });
  assert.equal(result.success, false);
});

test('createSupplierSchema rejects name shorter than 2 characters', () => {
  const result = createSupplierSchema.safeParse({ name: 'A' });
  assert.equal(result.success, false);
});

test('createSupplierSchema rejects invalid email format', () => {
  const result = createSupplierSchema.safeParse({ name: 'Valid Name', email: 'not-an-email' });
  assert.equal(result.success, false);
});

test('createSupplierSchema rejects unknown fields with strict mode', () => {
  const result = createSupplierSchema.safeParse({ name: 'Valid Name', unknownField: 'value' });
  assert.equal(result.success, false);
});

test('createSupplierSchema accepts nullable optional fields', () => {
  const result = createSupplierSchema.safeParse({ name: 'Valid Name', email: null, phone: null });
  assert.equal(result.success, true);
  assert.equal(result.data.email, null);
  assert.equal(result.data.phone, null);
});

// --- updateSupplierSchema ---

test('updateSupplierSchema accepts partial payload with only one field', () => {
  const result = updateSupplierSchema.safeParse({ phone: '9999-9999' });
  assert.equal(result.success, true);
  assert.equal(result.data.phone, '9999-9999');
});

test('updateSupplierSchema accepts empty payload (all optional)', () => {
  const result = updateSupplierSchema.safeParse({});
  assert.equal(result.success, true);
});

// --- addProductToSupplierSchema ---

test('addProductToSupplierSchema requires productId', () => {
  const result = addProductToSupplierSchema.safeParse({});
  assert.equal(result.success, false);
});

test('addProductToSupplierSchema accepts valid product assignment payload', () => {
  const result = addProductToSupplierSchema.safeParse({
    productId: 123,
    isPreferred: true,
    supplierSku: 'ABC-001',
    unitPrice: 1500,
    currency: 'CRC',
    leadTimeDays: 5,
    minimumOrderQuantity: 10,
    notes: 'Bulk discount available',
  });
  assert.equal(result.success, true);
  assert.equal(result.data.productId, 123n);
  assert.equal(result.data.isPreferred, true);
  assert.equal(result.data.unitPrice, 1500);
});

test('addProductToSupplierSchema rejects negative unitPrice', () => {
  const result = addProductToSupplierSchema.safeParse({
    productId: 123,
    unitPrice: -10,
  });
  assert.equal(result.success, false);
});

test('addProductToSupplierSchema rejects unknown fields', () => {
  const result = addProductToSupplierSchema.safeParse({
    productId: 123,
    extraField: 'nope',
  });
  assert.equal(result.success, false);
});

test('addProductToSupplierSchema accepts minimal payload with only productId', () => {
  const result = addProductToSupplierSchema.safeParse({ productId: 456 });
  assert.equal(result.success, true);
  assert.equal(result.data.productId, 456n);
  assert.equal(result.data.isPreferred, false);
});
