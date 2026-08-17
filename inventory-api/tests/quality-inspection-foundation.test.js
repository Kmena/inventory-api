const { test } = require('node:test');
const assert = require('node:assert/strict');

const productionRepository = require('../src/repositories/production.repository');
const qualityRepository = require('../src/repositories/quality.repository');
const qualityService = require('../src/services/quality.service');
const { qualityInspectionSchema, QUALITY_INSPECTION_RESULTS } = require('../src/schemas/quality.schema');

const auth = {
  sub: 99,
  companyId: 7,
  permissions: ['quality.inspect', 'quality.view'],
};

// --- Harness for patching repositories ---

const productionOriginals = {
  findProductionOrderById: productionRepository.findProductionOrderById,
  findLatestProductionStageExecutionForOrderStage: productionRepository.findLatestProductionStageExecutionForOrderStage,
  updateProductionOrder: productionRepository.updateProductionOrder,
};

const qualityOriginals = {
  createQualityInspection: qualityRepository.createQualityInspection,
  findQualityInspectionsForOrder: qualityRepository.findQualityInspectionsForOrder,
  findQualityInspectionsForStageExecution: qualityRepository.findQualityInspectionsForStageExecution,
  findApprovedInspectionForStageExecution: qualityRepository.findApprovedInspectionForStageExecution,
};

function patchRepositories(overrides) {
  Object.assign(productionRepository, {
    findProductionOrderById: overrides.findProductionOrderById || productionOriginals.findProductionOrderById,
    findLatestProductionStageExecutionForOrderStage: overrides.findLatestProductionStageExecutionForOrderStage || productionOriginals.findLatestProductionStageExecutionForOrderStage,
    updateProductionOrder: overrides.updateProductionOrder || productionOriginals.updateProductionOrder,
  });
  Object.assign(qualityRepository, {
    createQualityInspection: overrides.createQualityInspection || qualityOriginals.createQualityInspection,
    findQualityInspectionsForOrder: overrides.findQualityInspectionsForOrder || qualityOriginals.findQualityInspectionsForOrder,
    findQualityInspectionsForStageExecution: overrides.findQualityInspectionsForStageExecution || qualityOriginals.findQualityInspectionsForStageExecution,
    findApprovedInspectionForStageExecution: overrides.findApprovedInspectionForStageExecution || qualityOriginals.findApprovedInspectionForStageExecution,
  });
}

function restoreRepositories() {
  Object.assign(productionRepository, productionOriginals);
  Object.assign(qualityRepository, qualityOriginals);
}

async function withPatchedRepositories(overrides, testFn) {
  patchRepositories(overrides);
  try {
    await testFn();
  } finally {
    restoreRepositories();
  }
}

// --- Schema tests ---

test('qualityInspectionSchema accepts a complete QA inspection payload', () => {
  const payload = {
    result: 'APPROVED',
    lotId: '700',
    expectedParameters: [{ name: 'pH', value: 6.5, unit: 'pH' }],
    actualResults: [{ name: 'pH', value: 6.4, unit: 'pH' }],
    observations: 'Dentro de tolerancia',
    evidence: [{ type: 'photo', reference: 'storage://qa-photo-1.jpg' }],
    correctiveAction: null,
    inspectedAt: '2026-08-18T10:00:00.000Z',
  };

  const result = qualityInspectionSchema.safeParse(payload);
  assert.ok(result.success, `Schema must accept valid QA payload: ${JSON.stringify(result.error?.issues)}`);
  assert.equal(result.data.result, 'APPROVED');
  assert.equal(result.data.lotId, 700n);
});

test('qualityInspectionSchema accepts CONDITIONALLY_ACCEPTED and REJECTED results', () => {
  for (const resultValue of ['CONDITIONALLY_ACCEPTED', 'REJECTED']) {
    const result = qualityInspectionSchema.safeParse({ result: resultValue });
    assert.ok(result.success, `Schema must accept result: ${resultValue}`);
    assert.equal(result.data.result, resultValue);
  }
});

test('qualityInspectionSchema rejects invalid result values', () => {
  const result = qualityInspectionSchema.safeParse({ result: 'INVALID' });
  assert.ok(!result.success);
});

test('qualityInspectionSchema rejects unexpected fields', () => {
  const result = qualityInspectionSchema.safeParse({ result: 'APPROVED', unexpectedField: 'oops' });
  assert.ok(!result.success);
});

test('QUALITY_INSPECTION_RESULTS exports the expected enum values', () => {
  assert.deepStrictEqual(QUALITY_INSPECTION_RESULTS, ['APPROVED', 'CONDITIONALLY_ACCEPTED', 'REJECTED']);
});

// --- Service tests ---

test('createInspectionForStage creates a QA inspection linked to the latest stage execution', async () => {
  const createdInspections = [];
  const orderUpdates = [];

  await withPatchedRepositories({
    findProductionOrderById: async () => ({
      id: 501n,
      companyId: 7n,
      status: 'IN_PROGRESS',
      recipeVersionSnapshot: { recipeVersion: { stages: [{ id: 101, stageOrder: 0, name: 'Mezcla', qaMandatory: true }] } },
    }),
    findLatestProductionStageExecutionForOrderStage: async () => ({
      id: 901n,
      productionOrderId: 501n,
      recipeStageId: 101n,
    }),
    createQualityInspection: async (data) => {
      const inspection = { id: 1001n, ...data, createdAt: new Date(), updatedAt: new Date() };
      createdInspections.push(inspection);
      return inspection;
    },
    updateProductionOrder: async (id, companyId, data) => {
      orderUpdates.push({ id, companyId, data });
      return {};
    },
  }, async () => {
    const result = await qualityService.createInspectionForStage(501n, 101n, {
      result: 'APPROVED',
      lotId: 700n,
      expectedParameters: [{ name: 'pH', value: 6.5, unit: 'pH' }],
      actualResults: [{ name: 'pH', value: 6.4, unit: 'pH' }],
      observations: 'OK',
    }, auth);

    assert.equal(result.id, 1001n);
    assert.equal(result.productionOrderId, 501n);
    assert.equal(result.stageExecutionId, 901n);
    assert.equal(result.inspectorUserId, 99n);
    assert.equal(result.result, 'APPROVED');
    assert.equal(result.lotId, 700n);
    assert.equal(createdInspections.length, 1);
    assert.equal(orderUpdates.length, 0, 'APPROVED should not transition order status when already IN_PROGRESS');
  });
});

test('createInspectionForStage transitions order to QA_HOLD on REJECTED result', async () => {
  const orderUpdates = [];

  await withPatchedRepositories({
    findProductionOrderById: async () => ({
      id: 501n,
      companyId: 7n,
      status: 'IN_PROGRESS',
      recipeVersionSnapshot: { recipeVersion: { stages: [{ id: 101, stageOrder: 0, name: 'Mezcla', qaMandatory: true }] } },
    }),
    findLatestProductionStageExecutionForOrderStage: async () => ({
      id: 901n,
      productionOrderId: 501n,
      recipeStageId: 101n,
    }),
    createQualityInspection: async (data) => ({
      id: 1002n, ...data, createdAt: new Date(), updatedAt: new Date(),
    }),
    updateProductionOrder: async (id, companyId, data) => {
      orderUpdates.push({ id, companyId, data });
      return {};
    },
  }, async () => {
    const result = await qualityService.createInspectionForStage(501n, 101n, {
      result: 'REJECTED',
      observations: 'pH fuera de rango',
      correctiveAction: 'Repetir mezcla',
    }, auth);

    assert.equal(result.result, 'REJECTED');
    assert.equal(orderUpdates.length, 1, 'REJECTED must transition order to QA_HOLD');
    assert.equal(orderUpdates[0].data.status, 'QA_HOLD');
  });
});

test('createInspectionForStage transitions order from QA_HOLD to IN_PROGRESS on APPROVED result', async () => {
  const orderUpdates = [];

  await withPatchedRepositories({
    findProductionOrderById: async () => ({
      id: 501n,
      companyId: 7n,
      status: 'QA_HOLD',
      recipeVersionSnapshot: { recipeVersion: { stages: [{ id: 101, stageOrder: 0, name: 'Mezcla', qaMandatory: true }] } },
    }),
    findLatestProductionStageExecutionForOrderStage: async () => ({
      id: 901n,
      productionOrderId: 501n,
      recipeStageId: 101n,
    }),
    createQualityInspection: async (data) => ({
      id: 1003n, ...data, createdAt: new Date(), updatedAt: new Date(),
    }),
    updateProductionOrder: async (id, companyId, data) => {
      orderUpdates.push({ id, companyId, data });
      return {};
    },
  }, async () => {
    const result = await qualityService.createInspectionForStage(501n, 101n, {
      result: 'APPROVED',
    }, auth);

    assert.equal(result.result, 'APPROVED');
    assert.equal(orderUpdates.length, 1, 'APPROVED on QA_HOLD order must restore IN_PROGRESS');
    assert.equal(orderUpdates[0].data.status, 'IN_PROGRESS');
  });
});

test('createInspectionForStage rejects when no stage execution exists', async () => {
  await withPatchedRepositories({
    findProductionOrderById: async () => ({
      id: 501n,
      companyId: 7n,
      status: 'IN_PROGRESS',
    }),
    findLatestProductionStageExecutionForOrderStage: async () => null,
  }, async () => {
    await assert.rejects(
      () => qualityService.createInspectionForStage(501n, 101n, { result: 'APPROVED' }, auth),
      (error) => error?.statusCode === 409 && error?.code === 'conflict',
    );
  });
});

test('createInspectionForStage rejects when order is not IN_PROGRESS or QA_HOLD', async () => {
  await withPatchedRepositories({
    findProductionOrderById: async () => ({
      id: 501n,
      companyId: 7n,
      status: 'DRAFT',
    }),
  }, async () => {
    await assert.rejects(
      () => qualityService.createInspectionForStage(501n, 101n, { result: 'APPROVED' }, auth),
      (error) => error?.statusCode === 409 && error?.code === 'conflict',
    );
  });
});

test('createInspectionForStage rejects non-existent production order', async () => {
  await withPatchedRepositories({
    findProductionOrderById: async () => null,
  }, async () => {
    await assert.rejects(
      () => qualityService.createInspectionForStage(999n, 101n, { result: 'APPROVED' }, auth),
      (error) => error?.statusCode === 404 && error?.code === 'not_found',
    );
  });
});

test('listInspectionsForOrder returns all inspections for the order', async () => {
  const mockInspections = [
    { id: 1001n, productionOrderId: 501n, stageExecutionId: 901n, inspectorUserId: 99n, lotId: null, result: 'APPROVED', expectedParameters: null, actualResults: null, observations: null, evidence: null, correctiveAction: null, inspectedAt: new Date(), createdAt: new Date(), updatedAt: new Date() },
    { id: 1002n, productionOrderId: 501n, stageExecutionId: 902n, inspectorUserId: 99n, lotId: 700n, result: 'REJECTED', expectedParameters: null, actualResults: null, observations: 'Falla', evidence: null, correctiveAction: 'Repetir', inspectedAt: new Date(), createdAt: new Date(), updatedAt: new Date() },
  ];

  await withPatchedRepositories({
    findProductionOrderById: async () => ({ id: 501n, companyId: 7n, status: 'IN_PROGRESS' }),
    findQualityInspectionsForOrder: async () => mockInspections,
  }, async () => {
    const results = await qualityService.listInspectionsForOrder(501n, auth);
    assert.equal(results.length, 2);
    assert.equal(results[0].id, 1001n);
    assert.equal(results[1].result, 'REJECTED');
  });
});

test('listInspectionsForOrder rejects non-existent order', async () => {
  await withPatchedRepositories({
    findProductionOrderById: async () => null,
  }, async () => {
    await assert.rejects(
      () => qualityService.listInspectionsForOrder(999n, auth),
      (error) => error?.statusCode === 404 && error?.code === 'not_found',
    );
  });
});

// --- Gate check tests ---

test('checkMandatoryQaGatesForOrder passes when all mandatory stages have approved inspections', async () => {
  await withPatchedRepositories({
    findProductionOrderById: async () => ({
      id: 501n,
      companyId: 7n,
      status: 'IN_PROGRESS',
      recipeVersionSnapshot: {
        recipeVersion: {
          stages: [
            { id: 101, stageOrder: 0, name: 'Mezcla', qaMandatory: true },
            { id: 102, stageOrder: 1, name: 'Envasado', qaMandatory: false },
          ],
        },
      },
    }),
    findLatestProductionStageExecutionForOrderStage: async () => ({
      id: 901n,
      productionOrderId: 501n,
    }),
    findApprovedInspectionForStageExecution: async () => ({
      id: 1001n,
      result: 'APPROVED',
    }),
  }, async () => {
    const result = await qualityService.checkMandatoryQaGatesForOrder(501n, 7n);
    assert.equal(result.allMandatoryGatesPassed, true);
    assert.equal(result.pendingStages.length, 0);
    assert.equal(result.rejectedStages.length, 0);
  });
});

test('checkMandatoryQaGatesForOrder fails when mandatory stage has no stage execution', async () => {
  await withPatchedRepositories({
    findProductionOrderById: async () => ({
      id: 501n,
      companyId: 7n,
      status: 'IN_PROGRESS',
      recipeVersionSnapshot: {
        recipeVersion: {
          stages: [
            { id: 101, stageOrder: 0, name: 'Mezcla', qaMandatory: true },
          ],
        },
      },
    }),
    findLatestProductionStageExecutionForOrderStage: async () => null,
  }, async () => {
    const result = await qualityService.checkMandatoryQaGatesForOrder(501n, 7n);
    assert.equal(result.allMandatoryGatesPassed, false);
    assert.equal(result.pendingStages.length, 1);
    assert.equal(result.pendingStages[0].reason, 'stage_not_executed');
  });
});

test('checkMandatoryQaGatesForOrder fails when mandatory stage has no approved inspection', async () => {
  await withPatchedRepositories({
    findProductionOrderById: async () => ({
      id: 501n,
      companyId: 7n,
      status: 'IN_PROGRESS',
      recipeVersionSnapshot: {
        recipeVersion: {
          stages: [
            { id: 101, stageOrder: 0, name: 'Mezcla', qaMandatory: true },
          ],
        },
      },
    }),
    findLatestProductionStageExecutionForOrderStage: async () => ({
      id: 901n,
      productionOrderId: 501n,
    }),
    findApprovedInspectionForStageExecution: async () => null,
    findQualityInspectionsForStageExecution: async () => [],
  }, async () => {
    const result = await qualityService.checkMandatoryQaGatesForOrder(501n, 7n);
    assert.equal(result.allMandatoryGatesPassed, false);
    assert.equal(result.pendingStages.length, 1);
    assert.equal(result.pendingStages[0].reason, 'qa_inspection_missing');
  });
});

test('checkMandatoryQaGatesForOrder reports rejected stages', async () => {
  await withPatchedRepositories({
    findProductionOrderById: async () => ({
      id: 501n,
      companyId: 7n,
      status: 'IN_PROGRESS',
      recipeVersionSnapshot: {
        recipeVersion: {
          stages: [
            { id: 101, stageOrder: 0, name: 'Mezcla', qaMandatory: true },
          ],
        },
      },
    }),
    findLatestProductionStageExecutionForOrderStage: async () => ({
      id: 901n,
      productionOrderId: 501n,
    }),
    findApprovedInspectionForStageExecution: async () => null,
    findQualityInspectionsForStageExecution: async () => [
      { id: 1001n, result: 'REJECTED' },
    ],
  }, async () => {
    const result = await qualityService.checkMandatoryQaGatesForOrder(501n, 7n);
    assert.equal(result.allMandatoryGatesPassed, false);
    assert.equal(result.rejectedStages.length, 1);
    assert.equal(result.rejectedStages[0].reason, 'qa_rejected');
  });
});

test('checkMandatoryQaGatesForOrder passes when no stages require QA', async () => {
  await withPatchedRepositories({
    findProductionOrderById: async () => ({
      id: 501n,
      companyId: 7n,
      status: 'IN_PROGRESS',
      recipeVersionSnapshot: {
        recipeVersion: {
          stages: [
            { id: 101, stageOrder: 0, name: 'Mezcla', qaMandatory: false },
            { id: 102, stageOrder: 1, name: 'Envasado', qaMandatory: false },
          ],
        },
      },
    }),
  }, async () => {
    const result = await qualityService.checkMandatoryQaGatesForOrder(501n, 7n);
    assert.equal(result.allMandatoryGatesPassed, true);
  });
});
