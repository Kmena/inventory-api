'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createAgentOrderSchema } = require('../src/schemas/agent-workspace.schema');

// Minimal valid items for all tests
const validItems = [
  { productId: '1', quantity: 2, unitPrice: 10, discountPercent: 0, discountAmount: 0, totalDiscount: 0 },
];

const validTransferMetadata = {
  bank: 'BCR',
  reference: 'REF-123456',
  amount: 200,
  date: '2026-08-01T10:00:00.000Z',
};

test('createAgentOrderSchema rejects TRANSFER without transferMetadata', () => {
  assert.throws(() => {
    createAgentOrderSchema.parse({ items: validItems, paymentCondition: 'TRANSFER' });
  }, (err) => {
    assert.ok(err.name === 'ZodError');
    const paths = err.issues.map((issue) => issue.path.join('.'));
    assert.ok(paths.some((p) => p === 'transferMetadata'));
    return true;
  });
});

test('createAgentOrderSchema accepts CASH without transferMetadata', () => {
  const result = createAgentOrderSchema.parse({ items: validItems, paymentCondition: 'CASH' });
  assert.equal(result.paymentCondition, 'CASH');
  assert.equal(result.transferMetadata, undefined);
});

test('createAgentOrderSchema accepts CREDIT without transferMetadata', () => {
  const result = createAgentOrderSchema.parse({ items: validItems, paymentCondition: 'CREDIT' });
  assert.equal(result.paymentCondition, 'CREDIT');
});

test('createAgentOrderSchema accepts missing paymentCondition (backward compatibility)', () => {
  const result = createAgentOrderSchema.parse({ items: validItems });
  assert.equal(result.paymentCondition, undefined);
});

test('createAgentOrderSchema accepts TRANSFER with complete transferMetadata', () => {
  const result = createAgentOrderSchema.parse({
    items: validItems,
    paymentCondition: 'TRANSFER',
    transferMetadata: validTransferMetadata,
  });
  assert.equal(result.paymentCondition, 'TRANSFER');
  assert.deepEqual(result.transferMetadata, validTransferMetadata);
});

test('createAgentOrderSchema rejects negative transferMetadata.amount', () => {
  assert.throws(() => {
    createAgentOrderSchema.parse({
      items: validItems,
      paymentCondition: 'TRANSFER',
      transferMetadata: { ...validTransferMetadata, amount: -1 },
    });
  }, (err) => {
    assert.ok(err.name === 'ZodError');
    return true;
  });
});

test('createAgentOrderSchema rejects invalid datetime in transferMetadata.date', () => {
  assert.throws(() => {
    createAgentOrderSchema.parse({
      items: validItems,
      paymentCondition: 'TRANSFER',
      transferMetadata: { ...validTransferMetadata, date: 'no-es-datetime' },
    });
  }, (err) => {
    assert.ok(err.name === 'ZodError');
    return true;
  });
});
