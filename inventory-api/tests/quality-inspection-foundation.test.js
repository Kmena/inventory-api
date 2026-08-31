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
  updateStageExecutionStatus: productionRepository.updateStageExecutionStatus,
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
    updateStageExecutionStatus: overrides.updateStageExecutionStatus || productionOriginals.updateStageExecutionStatus,
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

// TASK-005 / DEC-001: QA formal solo acepta parámetros numéricos.
// z.coerce.number() convierte strings numéricos y rechaza non-numeric strings.
test('qualityInspectionSchema coerces numeric string values in actualResults (TASK-005)', () => {
  const result = qualityInspectionSchema.safeParse({
    result: 'APPROVED',
    actualResults: [{ name: 'pH', value: '7.5', unit: 'pH' }],
  });
  assert.ok(result.success, `Must coerce string '7.5' to 7.5: ${JSON.stringify(result.error?.issues)}`);
  assert.strictEqual(result.data.actualResults[0].value, 7.5);
});

test('qualityInspectionSchema rejects non-numeric string values in actualResults (TASK-005)', () => {
  const result = qualityInspectionSchema.safeParse({
    result: 'APPROVED',
    actualResults: [{ name: 'pH', value: 'alto', unit: 'pH' }],
  });
  assert.ok(!result.success, 'Non-numeric string must be rejected');
});

test('qualityInspectionSchema coerces numeric string values in expectedParameters (TASK-005)', () => {
  const result = qualityInspectionSchema.safeParse({
    result: 'APPROVED',
    expectedParameters: [{ name: 'viscosidad', value: '42.5', unit: 'cP' }],
  });
  assert.ok(result.success, `Must coerce string '42.5' to 42.5: ${JSON.stringify(result.error?.issues)}`);
  assert.strictEqual(result.data.expectedParameters[0].value, 42.5);
});

test('qualityInspectionSchema rejects non-numeric string values in expectedParameters (TASK-005)', () => {
  const result = qualityInspectionSchema.safeParse({
    result: 'APPROVED',
    expectedParameters: [{ name: 'pH', value: 'N/A', unit: 'pH' }],
  });
  assert.ok(!result.success, 'Non-numeric string must be rejected in expectedParameters');
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

    // Service now returns { inspection, dispositionsSummary }
    assert.equal(result.inspection.id, 1001n);
    assert.equal(result.inspection.productionOrderId, 501n);
    assert.equal(result.inspection.stageExecutionId, 901n);
    assert.equal(result.inspection.inspectorUserId, 99n);
    assert.equal(result.inspection.result, 'APPROVED');
    assert.equal(result.inspection.lotId, 700n);
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
    // TASK-003: must be mocked so it does not hit the real DB with a fake id
    updateStageExecutionStatus: async () => ({}),
  }, async () => {
    const result = await qualityService.createInspectionForStage(501n, 101n, {
      result: 'REJECTED',
      observations: 'pH fuera de rango',
      correctiveAction: 'Repetir mezcla',
    }, auth);

    assert.equal(result.inspection.result, 'REJECTED');
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

    assert.equal(result.inspection.result, 'APPROVED');
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

// TASK-007: multi-tenant scope — findQualityInspectionsForOrder must receive companyId
test('listInspectionsForOrder passes companyId to repository for multi-tenant isolation (TASK-007)', async () => {
  const repositoryCalls = [];

  await withPatchedRepositories({
    findProductionOrderById: async () => ({ id: 501n, companyId: 7n, status: 'IN_PROGRESS' }),
    findQualityInspectionsForOrder: async (orderId, companyId) => {
      repositoryCalls.push({ orderId, companyId });
      return [];
    },
  }, async () => {
    await qualityService.listInspectionsForOrder(501n, auth);

    assert.equal(repositoryCalls.length, 1);
    assert.equal(repositoryCalls[0].orderId, 501n);
    assert.equal(repositoryCalls[0].companyId, 7n,
      'companyId must be passed to repository for multi-tenant enforcement');
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
      qaOutOfTolerance: true,
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

// Modelo nuevo: cualquier etapa qaMandatory requiere inspeccion aprobada,
// no solo las que tuvieron qaOutOfTolerance. El reason code cambio a qa_analysis_required.
test('checkMandatoryQaGatesForOrder fails when mandatory stage has no approved inspection (any case)', async () => {
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
      qaOutOfTolerance: false, // aunque este dentro de tolerancia, igual requiere inspeccion QA
    }),
    findApprovedInspectionForStageExecution: async () => null,
    findQualityInspectionsForStageExecution: async () => [],
  }, async () => {
    const result = await qualityService.checkMandatoryQaGatesForOrder(501n, 7n);
    assert.equal(result.allMandatoryGatesPassed, false);
    assert.equal(result.pendingStages.length, 1);
    assert.equal(result.pendingStages[0].reason, 'qa_analysis_required');
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
      qaOutOfTolerance: true,
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

// Modelo nuevo: estar dentro de tolerancia ya NO es suficiente para pasar el gate.
// Siempre se requiere inspeccion aprobada en etapas qaMandatory.
test('checkMandatoryQaGatesForOrder requires approved inspection even when within tolerance', async () => {
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
      qaOutOfTolerance: false, // dentro de tolerancia
    }),
    findApprovedInspectionForStageExecution: async () => null, // pero sin inspeccion aprobada
    findQualityInspectionsForStageExecution: async () => [],
  }, async () => {
    const result = await qualityService.checkMandatoryQaGatesForOrder(501n, 7n);
    // Ahora FALLA aunque qaOutOfTolerance sea false: se requiere inspeccion QA
    assert.equal(result.allMandatoryGatesPassed, false);
    assert.equal(result.pendingStages.length, 1);
    assert.equal(result.pendingStages[0].reason, 'qa_analysis_required');
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

// ─── TASK-003 / AC-001: REJECTED marks stageExecution as QA_REJECTED ────────

test('[AC-001] REJECTED inspection marks stageExecution.status=QA_REJECTED', async () => {
  const statusUpdates = [];

  await withPatchedRepositories({
    findProductionOrderById: async () => ({
      id: 501n,
      companyId: 7n,
      status: 'IN_PROGRESS',
      recipeVersionSnapshot: { recipeVersion: { stages: [] } },
    }),
    findLatestProductionStageExecutionForOrderStage: async () => ({
      id: 901n,
      productionOrderId: 501n,
      recipeStageId: 101n,
    }),
    createQualityInspection: async (data) => ({
      id: 1010n, ...data, createdAt: new Date(), updatedAt: new Date(),
    }),
    updateProductionOrder: async () => ({}),
    updateStageExecutionStatus: async (execId, status) => {
      statusUpdates.push({ execId, status });
      return {};
    },
  }, async () => {
    await qualityService.createInspectionForStage(501n, 101n, {
      result: 'REJECTED',
      observations: 'pH fuera de rango',
    }, auth);

    assert.equal(
      statusUpdates.length,
      1,
      'updateStageExecutionStatus must be called once on REJECTED',
    );
    assert.equal(statusUpdates[0].execId, 901n);
    assert.equal(statusUpdates[0].status, 'QA_REJECTED');
  });
});

test('[AC-001] APPROVED inspection does NOT change stageExecution status', async () => {
  const statusUpdates = [];

  await withPatchedRepositories({
    findProductionOrderById: async () => ({
      id: 501n,
      companyId: 7n,
      status: 'IN_PROGRESS',
      recipeVersionSnapshot: { recipeVersion: { stages: [] } },
    }),
    findLatestProductionStageExecutionForOrderStage: async () => ({
      id: 902n,
      productionOrderId: 501n,
      recipeStageId: 101n,
    }),
    createQualityInspection: async (data) => ({
      id: 1011n, ...data, createdAt: new Date(), updatedAt: new Date(),
    }),
    updateProductionOrder: async () => ({}),
    updateStageExecutionStatus: async (execId, status) => {
      statusUpdates.push({ execId, status });
      return {};
    },
  }, async () => {
    await qualityService.createInspectionForStage(501n, 101n, {
      result: 'APPROVED',
    }, auth);

    assert.equal(
      statusUpdates.length,
      0,
      'updateStageExecutionStatus must NOT be called for APPROVED result',
    );
  });
});

test('[AC-001] After REJECTED: stageExecution.lossesAcknowledged stays false (gate not cleared)', async () => {
  // This test confirms that the quality service does NOT call acknowledgeStageExecutionLosses.
  // The lossesAcknowledged field only becomes true after POST .../losses is called.
  const acknowledgesCalled = [];

  await withPatchedRepositories({
    findProductionOrderById: async () => ({
      id: 501n,
      companyId: 7n,
      status: 'IN_PROGRESS',
      recipeVersionSnapshot: { recipeVersion: { stages: [] } },
    }),
    findLatestProductionStageExecutionForOrderStage: async () => ({
      id: 903n,
      productionOrderId: 501n,
      recipeStageId: 101n,
      lossesAcknowledged: false,
    }),
    createQualityInspection: async (data) => ({
      id: 1012n, ...data, createdAt: new Date(), updatedAt: new Date(),
    }),
    updateProductionOrder: async () => ({}),
    updateStageExecutionStatus: async () => ({}),
    // acknowledgeStageExecutionLosses should NOT be called by quality.service
    acknowledgeStageExecutionLosses: async (execId) => {
      acknowledgesCalled.push(execId);
      return {};
    },
  }, async () => {
    await qualityService.createInspectionForStage(501n, 101n, {
      result: 'REJECTED',
    }, auth);

    assert.equal(
      acknowledgesCalled.length,
      0,
      'quality.service must NOT call acknowledgeStageExecutionLosses — lossesAcknowledged stays false',
    );
  });
});

// ─── TASK-004: New disposition + continuation tests ──────────────────────────

test('[AC-005] Sin materialDispositions → dispositionsSummary=null (backward compat)', async () => {
  await withPatchedRepositories({
    findProductionOrderById: async () => ({
      id: 501n, companyId: 7n, status: 'IN_PROGRESS',
      recipeVersionSnapshot: { recipeVersion: { stages: [] } },
    }),
    findLatestProductionStageExecutionForOrderStage: async () => ({
      id: 901n, productionOrderId: 501n, recipeStageId: 101n,
    }),
    createQualityInspection: async (data) => ({ id: 1020n, ...data, createdAt: new Date(), updatedAt: new Date() }),
    updateProductionOrder: async () => ({}),
    updateStageExecutionStatus: async () => ({}),
  }, async () => {
    const result = await qualityService.createInspectionForStage(501n, 101n, {
      result: 'REJECTED',
      observations: 'sin disposiciones',
    }, auth);

    assert.equal(result.inspection.result, 'REJECTED');
    assert.equal(result.dispositionsSummary, null,
      '[AC-005] Without materialDispositions, dispositionsSummary must be null (backward compat)');
  });
});

test('acquireInventoryLockWithRetry retries up to 3 times and fails with 503 when lock is unavailable', async () => {
  const inventoryRepo = require('../src/repositories/inventory.repository');
  const originalTryAcquire = inventoryRepo.tryAcquireCompanyInventoryAdvisoryLock;
  let attempts = 0;
  inventoryRepo.tryAcquireCompanyInventoryAdvisoryLock = async () => {
    attempts += 1;
    return false;
  };

  try {
    await assert.rejects(
      () => qualityService.__private__.acquireInventoryLockWithRetry(7n, {}),
      (err) => err?.statusCode === 503 && err?.code === 'inventory_lock_unavailable',
    );
    assert.equal(attempts, 3);
  } finally {
    inventoryRepo.tryAcquireCompanyInventoryAdvisoryLock = originalTryAcquire;
  }
});

test('[AC-018] REJECTED inspection persists continuationPoint and materialDispositions in BD', async () => {
  let persistedData = null;
  const inventoryRepo = require('../src/repositories/inventory.repository');
  const origTransaction2 = inventoryRepo.transaction;
  const origTryAcquireLock = inventoryRepo.tryAcquireCompanyInventoryAdvisoryLock;
  const origAcknowledge = productionRepository.acknowledgeStageExecutionLosses;
  const origFindConsumptions = productionRepository.findConsumptionsByExecutionId;
  const origFindRecolection = productionRepository.findRecolectionStageByExecutionId;

  inventoryRepo.transaction = async (cb) => cb(productionRepository);
  inventoryRepo.tryAcquireCompanyInventoryAdvisoryLock = async () => true;
  productionRepository.acknowledgeStageExecutionLosses = async () => ({});
  productionRepository.findConsumptionsByExecutionId = async () => [];
  productionRepository.findRecolectionStageByExecutionId = async () => null;

  try {
    await withPatchedRepositories({
      findProductionOrderById: async () => ({
        id: 501n, companyId: 7n, status: 'IN_PROGRESS',
        recipeVersionSnapshot: { recipeVersion: { stages: [{ id: 101, stageOrder: 0, name: 'Mezcla' }] } },
        materialRequirements: [],
      }),
      findLatestProductionStageExecutionForOrderStage: async () => ({
        id: 901n, productionOrderId: 501n, recipeStageId: 101n,
      }),
      createQualityInspection: async (data) => {
        persistedData = data;
        return { id: 1021n, ...data, createdAt: new Date(), updatedAt: new Date() };
      },
      updateProductionOrder: async () => ({}),
      updateStageExecutionStatus: async () => ({}),
    }, async () => {
      const result = await qualityService.createInspectionForStage(501n, 101n, {
        result: 'REJECTED',
        continuationPoint: 'CURRENT',
        materialDispositions: [],
      }, auth);

      assert.ok(persistedData, 'createQualityInspection must be called');
      assert.equal(persistedData.continuationPoint, 'CURRENT',
        '[AC-018] continuationPoint must be persisted in quality_inspections');
      assert.ok(result.dispositionsSummary !== null,
        'dispositionsSummary must be present when materialDispositions provided');
      assert.equal(result.dispositionsSummary.lossesAcknowledged, true,
        'lossesAcknowledged must be true when materialDispositions provided (even [])');
    });
  } finally {
    inventoryRepo.transaction = origTransaction2;
    inventoryRepo.tryAcquireCompanyInventoryAdvisoryLock = origTryAcquireLock;
    productionRepository.acknowledgeStageExecutionLosses = origAcknowledge;
    productionRepository.findConsumptionsByExecutionId = origFindConsumptions;
    productionRepository.findRecolectionStageByExecutionId = origFindRecolection;
  }
});

test('[AC-008] PRIOR_STAGE with stageOrder >= rejected → 400 validation_error', async () => {
  await withPatchedRepositories({
    findProductionOrderById: async () => ({
      id: 501n, companyId: 7n, status: 'IN_PROGRESS',
      stageExecutions: [{ id: 800n, recipeStageId: 102n, endedAt: new Date(), status: 'COMPLETED', createdAt: new Date() }],
      recipeVersionSnapshot: {
        recipeVersion: {
          stages: [
            { id: 101, stageOrder: 1, name: 'Etapa1' },
            { id: 102, stageOrder: 2, name: 'Etapa2' },
            { id: 103, stageOrder: 3, name: 'Etapa3' },
          ],
        },
      },
    }),
    findLatestProductionStageExecutionForOrderStage: async () => ({
      id: 901n, productionOrderId: 501n, recipeStageId: 103n,
    }),
  }, async () => {
    // Trying to go to etapa2 (stageOrder=2) when rejecting etapa2 (stageOrder=2)
    await assert.rejects(
      () => qualityService.createInspectionForStage(501n, 103n, {
        result: 'REJECTED',
        continuationPoint: 'PRIOR_STAGE',
        continuationStageId: 103n, // same stageOrder as rejected → invalid
        materialDispositions: [],
        invalidatedStagesDispositions: [],
      }, auth),
      (err) => err?.statusCode === 400 && err?.code === 'validation_error',
    );
  });
});
