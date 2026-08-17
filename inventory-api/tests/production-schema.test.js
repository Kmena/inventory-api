const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createProductionOrderSchema,
  productionApprovalSchema,
  productionStageExecutionSchema,
  productionStageReturnSchema,
} = require('../src/schemas/production.schema');

test('createProductionOrderSchema accepts the foundational production order payload', () => {
  const result = createProductionOrderSchema.safeParse({
    productId: '11',
    recipeVersionId: '21',
    quantity: 125.5,
    originWarehouseId: '5',
    destinationWarehouseId: '8',
    responsibleUserId: '34',
    priority: 2,
    productionLotCode: 'LOT-PROD-001',
    plannedDate: '2026-08-13T10:00:00.000Z',
    productionDate: '2026-08-13T12:00:00.000Z',
    expirationDate: '2026-12-13T12:00:00.000Z',
  });

  assert.equal(result.success, true);
  assert.equal(result.data.productId, 11n);
  assert.equal(result.data.destinationWarehouseId, 8n);
});

test('production schemas reject same-warehouse routing and inconsistent expiration dates', () => {
  assert.equal(createProductionOrderSchema.safeParse({
    productId: '11',
    recipeVersionId: '21',
    quantity: 125.5,
    originWarehouseId: '5',
    destinationWarehouseId: '5',
    responsibleUserId: '34',
    productionLotCode: 'LOT-PROD-001',
  }).success, false);

  assert.equal(createProductionOrderSchema.safeParse({
    productId: '11',
    recipeVersionId: '21',
    quantity: 125.5,
    originWarehouseId: '5',
    destinationWarehouseId: '8',
    responsibleUserId: '34',
    productionLotCode: 'LOT-PROD-001',
    productionDate: '2026-08-13T12:00:00.000Z',
    expirationDate: '2026-08-12T12:00:00.000Z',
  }).success, false);

  assert.equal(productionApprovalSchema.safeParse({ overrideJustification: 'Justificación válida de override' }).success, true);
});

test('productionStageExecutionSchema accepts stage parameters, consumptions and waste with chronological timestamps', () => {
  const result = productionStageExecutionSchema.safeParse({
    startedAt: '2026-08-14T08:00:00.000Z',
    endedAt: '2026-08-14T08:45:00.000Z',
    actualParameters: [{ name: 'temperature', value: 45.5, unit: 'C' }],
    evidence: [{ type: 'photo', reference: 'storage://stage-evidence-1.jpg' }],
    consumptions: [{ productId: '31', lotId: '91', quantity: 12.5, note: 'Consumo base líquida' }],
    waste: [{ productId: '31', lotId: '91', quantity: 0.5, note: 'Merma controlada' }],
    notes: 'Ejecución de mezcla registrada',
  });

  assert.equal(result.success, true);
  assert.equal(result.data.consumptions[0].productId, 31n);
  assert.equal(result.data.waste[0].lotId, 91n);
});

test('productionStageExecutionSchema rejects waste rows without lotId', () => {
  const result = productionStageExecutionSchema.safeParse({
    startedAt: '2026-08-14T08:00:00.000Z',
    endedAt: '2026-08-14T08:45:00.000Z',
    waste: [{ productId: '31', quantity: 0.5 }],
  });

  assert.equal(result.success, false);
});

test('productionStageReturnSchema accepts explicit return payload by stage/product/lot', () => {
  const result = productionStageReturnSchema.safeParse({
    productId: '31',
    lotId: '91',
    quantity: 2,
    reasonCode: 'RETURN_UNUSED_RAW_MATERIAL',
    returnedAt: '2026-08-16T10:00:00.000Z',
    note: 'Excedente recuperado',
  });

  assert.equal(result.success, true);
  assert.equal(result.data.productId, 31n);
  assert.equal(result.data.lotId, 91n);
  assert.equal(result.data.reasonCode, 'RETURN_UNUSED_RAW_MATERIAL');
});

test('productionStageReturnSchema rejects return payloads without lotId', () => {
  const result = productionStageReturnSchema.safeParse({
    productId: '31',
    quantity: 2,
    reasonCode: 'RETURN_UNUSED_RAW_MATERIAL',
  });

  assert.equal(result.success, false);
});

test('productionStageExecutionSchema rejects reversed stage timestamps', () => {
  const result = productionStageExecutionSchema.safeParse({
    startedAt: '2026-08-14T09:00:00.000Z',
    endedAt: '2026-08-14T08:00:00.000Z',
    consumptions: [{ productId: '31', lotId: '91', quantity: 12.5 }],
  });

  assert.equal(result.success, false);
});
