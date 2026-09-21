'use strict';

/**
 * Zod schema validation tests for inventory requests.
 *
 * Covers:
 *  - createInventoryRequestSchema: valid ADJUSTMENT, valid TRANSFER, cross-field superRefine,
 *    invalid type, note length
 *  - executeAdjustmentRequestSchema: valid, negative quantity, invalid direction, reasonCode length
 *  - executeTransferRequestSchema: fully optional
 *  - pickupTransferRequestSchema: fully optional
 *  - cancelInventoryRequestSchema: optional cancelledReason, length limit
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createInventoryRequestSchema,
  executeAdjustmentRequestSchema,
  executeTransferRequestSchema,
  pickupTransferRequestSchema,
  cancelInventoryRequestSchema,
} = require('../src/schemas/inventory.schema');

// ── createInventoryRequestSchema ──────────────────────────────────────────────

test('createInventoryRequestSchema accepts valid ADJUSTMENT with minimum fields', () => {
  const result = createInventoryRequestSchema.safeParse({
    type: 'ADJUSTMENT',
    lotId: 1,
    productId: 1,
    sourceWarehouseId: 1,
  });
  assert.ok(result.success, `Should pass: ${JSON.stringify(result.error?.issues)}`);
  assert.equal(result.data.type, 'ADJUSTMENT');
});

test('createInventoryRequestSchema accepts valid TRANSFER with all required fields', () => {
  const result = createInventoryRequestSchema.safeParse({
    type: 'TRANSFER',
    lotId: 9,
    productId: 5,
    sourceWarehouseId: 3,
    destinationWarehouseId: 7,
    quantity: 50,
    note: 'Traslado urgente',
  });
  assert.ok(result.success, `Should pass: ${JSON.stringify(result.error?.issues)}`);
  assert.equal(result.data.type, 'TRANSFER');
  assert.equal(result.data.quantity, 50);
});

test('createInventoryRequestSchema rejects TRANSFER without destinationWarehouseId', () => {
  const result = createInventoryRequestSchema.safeParse({
    type: 'TRANSFER',
    lotId: 9,
    productId: 5,
    sourceWarehouseId: 3,
    quantity: 50,
    // missing destinationWarehouseId
  });
  assert.ok(!result.success, 'Should fail when TRANSFER missing destination warehouse');
  const codes = result.error.issues.map((i) => i.code);
  assert.ok(codes.length > 0, 'Should have validation errors');
});

test('createInventoryRequestSchema rejects TRANSFER without quantity', () => {
  const result = createInventoryRequestSchema.safeParse({
    type: 'TRANSFER',
    lotId: 9,
    productId: 5,
    sourceWarehouseId: 3,
    destinationWarehouseId: 7,
    // missing quantity
  });
  assert.ok(!result.success, 'Should fail when TRANSFER missing quantity');
});

test('createInventoryRequestSchema rejects TRANSFER when source equals destination warehouse', () => {
  const result = createInventoryRequestSchema.safeParse({
    type: 'TRANSFER',
    lotId: 9,
    productId: 5,
    sourceWarehouseId: 3,
    destinationWarehouseId: 3, // same as source
    quantity: 50,
  });
  assert.ok(!result.success, 'Should fail when source === destination warehouse');
});

test('createInventoryRequestSchema rejects unknown type', () => {
  const result = createInventoryRequestSchema.safeParse({
    type: 'EXCHANGE', // not in allowed types
    lotId: 9,
    productId: 5,
    sourceWarehouseId: 3,
  });
  assert.ok(!result.success, 'Should fail for unknown type EXCHANGE');
});

test('createInventoryRequestSchema rejects note longer than 500 chars', () => {
  const result = createInventoryRequestSchema.safeParse({
    type: 'ADJUSTMENT',
    lotId: 9,
    productId: 5,
    sourceWarehouseId: 3,
    note: 'x'.repeat(501),
  });
  assert.ok(!result.success, 'Should fail when note exceeds 500 characters');
});

test('createInventoryRequestSchema accepts note exactly at 500 chars', () => {
  const result = createInventoryRequestSchema.safeParse({
    type: 'ADJUSTMENT',
    lotId: 9,
    productId: 5,
    sourceWarehouseId: 3,
    note: 'x'.repeat(500),
  });
  assert.ok(result.success, 'Should pass when note is exactly 500 characters');
});

test('createInventoryRequestSchema rejects missing lotId', () => {
  const result = createInventoryRequestSchema.safeParse({
    type: 'ADJUSTMENT',
    productId: 5,
    sourceWarehouseId: 3,
  });
  assert.ok(!result.success, 'Should fail when lotId is missing');
});

// ── executeAdjustmentRequestSchema ───────────────────────────────────────────

test('executeAdjustmentRequestSchema accepts valid adjustment payload', () => {
  const result = executeAdjustmentRequestSchema.safeParse({
    actualQuantity: 5,
    direction: 'IN',
    reasonCode: 'AJUSTE',
  });
  assert.ok(result.success, `Should pass: ${JSON.stringify(result.error?.issues)}`);
  assert.equal(result.data.actualQuantity, 5);
  assert.equal(result.data.direction, 'IN');
  assert.equal(result.data.reasonCode, 'AJUSTE');
});

test('executeAdjustmentRequestSchema accepts OUT direction', () => {
  const result = executeAdjustmentRequestSchema.safeParse({
    actualQuantity: 10,
    direction: 'OUT',
    reasonCode: 'MERMA',
    operatorNote: 'Producto dañado',
  });
  assert.ok(result.success, `Should pass: ${JSON.stringify(result.error?.issues)}`);
  assert.equal(result.data.direction, 'OUT');
});

test('executeAdjustmentRequestSchema rejects negative actualQuantity', () => {
  const result = executeAdjustmentRequestSchema.safeParse({
    actualQuantity: -1,
    direction: 'IN',
    reasonCode: 'AJUSTE',
  });
  assert.ok(!result.success, 'Should fail for negative quantity');
});

test('executeAdjustmentRequestSchema rejects zero actualQuantity', () => {
  const result = executeAdjustmentRequestSchema.safeParse({
    actualQuantity: 0,
    direction: 'IN',
    reasonCode: 'AJUSTE',
  });
  assert.ok(!result.success, 'Should fail for zero quantity (must be positive)');
});

test('executeAdjustmentRequestSchema rejects invalid direction', () => {
  const result = executeAdjustmentRequestSchema.safeParse({
    actualQuantity: 5,
    direction: 'SIDEWAYS',
    reasonCode: 'AJUSTE',
  });
  assert.ok(!result.success, 'Should fail for direction SIDEWAYS');
});

test('executeAdjustmentRequestSchema rejects reasonCode shorter than 2 chars', () => {
  const result = executeAdjustmentRequestSchema.safeParse({
    actualQuantity: 5,
    direction: 'IN',
    reasonCode: 'X',
  });
  assert.ok(!result.success, 'Should fail when reasonCode has only 1 character');
});

test('executeAdjustmentRequestSchema rejects reasonCode longer than 80 chars', () => {
  const result = executeAdjustmentRequestSchema.safeParse({
    actualQuantity: 5,
    direction: 'IN',
    reasonCode: 'X'.repeat(81),
  });
  assert.ok(!result.success, 'Should fail when reasonCode exceeds 80 characters');
});

test('executeAdjustmentRequestSchema accepts reasonCode exactly at 80 chars', () => {
  const result = executeAdjustmentRequestSchema.safeParse({
    actualQuantity: 5,
    direction: 'IN',
    reasonCode: 'X'.repeat(80),
  });
  assert.ok(result.success, 'Should pass when reasonCode is exactly 80 characters');
});

test('executeAdjustmentRequestSchema accepts optional operatorNote', () => {
  const result = executeAdjustmentRequestSchema.safeParse({
    actualQuantity: 5,
    direction: 'IN',
    reasonCode: 'AJUSTE',
    operatorNote: 'Nota del operador',
  });
  assert.ok(result.success, 'Should accept operatorNote');
  assert.equal(result.data.operatorNote, 'Nota del operador');
});

test('executeAdjustmentRequestSchema rejects operatorNote longer than 500 chars', () => {
  const result = executeAdjustmentRequestSchema.safeParse({
    actualQuantity: 5,
    direction: 'IN',
    reasonCode: 'AJUSTE',
    operatorNote: 'x'.repeat(501),
  });
  assert.ok(!result.success, 'Should fail when operatorNote exceeds 500 characters');
});

// ── executeTransferRequestSchema ──────────────────────────────────────────────

test('executeTransferRequestSchema accepts empty object (all optional)', () => {
  const result = executeTransferRequestSchema.safeParse({});
  assert.ok(result.success, 'Should pass with empty object (all fields optional)');
});

test('executeTransferRequestSchema accepts operatorNote', () => {
  const result = executeTransferRequestSchema.safeParse({
    operatorNote: 'Traslado completado',
  });
  assert.ok(result.success, 'Should accept operatorNote');
});

test('executeTransferRequestSchema rejects operatorNote longer than 500 chars', () => {
  const result = executeTransferRequestSchema.safeParse({
    operatorNote: 'x'.repeat(501),
  });
  assert.ok(!result.success, 'Should fail when operatorNote exceeds 500 chars');
});

// ── pickupTransferRequestSchema ───────────────────────────────────────────────

test('pickupTransferRequestSchema accepts empty object', () => {
  const result = pickupTransferRequestSchema.safeParse({});
  assert.ok(result.success, 'Should pass with empty object');
});

test('pickupTransferRequestSchema accepts operatorNote', () => {
  const result = pickupTransferRequestSchema.safeParse({
    operatorNote: 'Recogiendo lote',
  });
  assert.ok(result.success, 'Should accept operatorNote');
});

// ── cancelInventoryRequestSchema ──────────────────────────────────────────────

test('cancelInventoryRequestSchema accepts empty object', () => {
  const result = cancelInventoryRequestSchema.safeParse({});
  assert.ok(result.success, 'Should pass with empty object');
});

test('cancelInventoryRequestSchema accepts cancelledReason', () => {
  const result = cancelInventoryRequestSchema.safeParse({
    cancelledReason: 'Ya no es necesario',
  });
  assert.ok(result.success, 'Should accept cancelledReason');
  assert.equal(result.data.cancelledReason, 'Ya no es necesario');
});

test('cancelInventoryRequestSchema rejects cancelledReason longer than 500 chars', () => {
  const result = cancelInventoryRequestSchema.safeParse({
    cancelledReason: 'x'.repeat(501),
  });
  assert.ok(!result.success, 'Should fail when cancelledReason exceeds 500 characters');
});
