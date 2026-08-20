const test = require('node:test');
const assert = require('node:assert/strict');

const productRepository = require('../src/repositories/product.repository');
const productionRepository = require('../src/repositories/production.repository');
const recipeRepository = require('../src/repositories/recipe.repository');
const inventoryRepository = require('../src/repositories/inventory.repository');
const inventoryTransactionSupport = require('../src/services/inventory-transaction-support.service');
const audit = require('../src/lib/audit');
const productionService = require('../src/services/production.service');

function withPatchedRepositories(overrides, callback) {
  const originals = {
    findProductById: productRepository.findProductById,
    findCompanyWarehousesByIds: productRepository.findCompanyWarehousesByIds,
    findActiveCompanyUserById: productionRepository.findActiveCompanyUserById,
    createProductionOrder: productionRepository.createProductionOrder,
    createMaterialRequirements: productionRepository.createMaterialRequirements,
    findMaterialRequirementsByOrderId: productionRepository.findMaterialRequirementsByOrderId,
    findProductionOrderById: productionRepository.findProductionOrderById,
    updateProductionOrder: productionRepository.updateProductionOrder,
    findRecipeVersionById: recipeRepository.findRecipeVersionById,
    transaction: inventoryRepository.transaction,
    acquireCompanyInventoryAdvisoryLock: inventoryRepository.acquireCompanyInventoryAdvisoryLock,
    findLotForProduct: inventoryRepository.findLotForProduct,
    updateProductById: inventoryRepository.updateProductById,
    updateLotById: inventoryRepository.updateLotById,
    getInventoryContext: inventoryTransactionSupport.getInventoryContext,
    changeWarehouseStock: inventoryTransactionSupport.changeWarehouseStock,
    changeLotStock: inventoryTransactionSupport.changeLotStock,
    createMovement: inventoryTransactionSupport.createMovement,
    createProductionStageExecution: productionRepository.createProductionStageExecution,
    createProductionConsumption: productionRepository.createProductionConsumption,
    createProductionWaste: productionRepository.createProductionWaste,
    createProductionReturn: productionRepository.createProductionReturn,
    findProductionStageExecutionById: productionRepository.findProductionStageExecutionById,
    findLatestProductionStageExecutionForOrderStage: productionRepository.findLatestProductionStageExecutionForOrderStage,
    syncProductionItemConsumedQuantity: productionRepository.syncProductionItemConsumedQuantity,
    getProductionItemAggregateState: productionRepository.getProductionItemAggregateState,
    recordAuditEventSafelyIfAvailable: audit.recordAuditEventSafelyIfAvailable,
  };

  Object.assign(productRepository, {
    findProductById: overrides.findProductById || originals.findProductById,
    findCompanyWarehousesByIds: overrides.findCompanyWarehousesByIds || originals.findCompanyWarehousesByIds,
  });
  Object.assign(productionRepository, {
    findActiveCompanyUserById: overrides.findActiveCompanyUserById || originals.findActiveCompanyUserById,
    createProductionOrder: overrides.createProductionOrder || originals.createProductionOrder,
    createMaterialRequirements: overrides.createMaterialRequirements || originals.createMaterialRequirements,
    findMaterialRequirementsByOrderId: overrides.findMaterialRequirementsByOrderId || originals.findMaterialRequirementsByOrderId,
    findProductionOrderById: overrides.findProductionOrderById || originals.findProductionOrderById,
    updateProductionOrder: overrides.updateProductionOrder || originals.updateProductionOrder,
  });
  Object.assign(recipeRepository, {
    findRecipeVersionById: overrides.findRecipeVersionById || originals.findRecipeVersionById,
  });
  Object.assign(inventoryRepository, {
    transaction: overrides.transaction || originals.transaction,
    acquireCompanyInventoryAdvisoryLock: overrides.acquireCompanyInventoryAdvisoryLock || originals.acquireCompanyInventoryAdvisoryLock,
    findLotForProduct: overrides.findLotForProduct || originals.findLotForProduct,
    updateProductById: overrides.updateProductById || originals.updateProductById,
    updateLotById: overrides.updateLotById || originals.updateLotById,
  });
  Object.assign(inventoryTransactionSupport, {
    getInventoryContext: overrides.getInventoryContext || originals.getInventoryContext,
    changeWarehouseStock: overrides.changeWarehouseStock || originals.changeWarehouseStock,
    changeLotStock: overrides.changeLotStock || originals.changeLotStock,
    createMovement: overrides.createMovement || originals.createMovement,
  });
  Object.assign(audit, {
    recordAuditEventSafelyIfAvailable: overrides.recordAuditEventSafelyIfAvailable || originals.recordAuditEventSafelyIfAvailable,
  });
  Object.assign(productionRepository, {
    createProductionStageExecution: overrides.createProductionStageExecution || originals.createProductionStageExecution,
    createProductionConsumption: overrides.createProductionConsumption || originals.createProductionConsumption,
    createProductionWaste: overrides.createProductionWaste || originals.createProductionWaste,
    createProductionReturn: overrides.createProductionReturn || originals.createProductionReturn,
    findProductionStageExecutionById: overrides.findProductionStageExecutionById || originals.findProductionStageExecutionById,
    findLatestProductionStageExecutionForOrderStage: overrides.findLatestProductionStageExecutionForOrderStage || originals.findLatestProductionStageExecutionForOrderStage,
    syncProductionItemConsumedQuantity: overrides.syncProductionItemConsumedQuantity || originals.syncProductionItemConsumedQuantity,
    getProductionItemAggregateState: overrides.getProductionItemAggregateState || originals.getProductionItemAggregateState,
  });

  return Promise.resolve()
    .then(callback)
    .finally(() => {
      Object.assign(productRepository, {
        findProductById: originals.findProductById,
        findCompanyWarehousesByIds: originals.findCompanyWarehousesByIds,
      });
      Object.assign(productionRepository, {
        findActiveCompanyUserById: originals.findActiveCompanyUserById,
        createProductionOrder: originals.createProductionOrder,
        createMaterialRequirements: originals.createMaterialRequirements,
        findMaterialRequirementsByOrderId: originals.findMaterialRequirementsByOrderId,
        findProductionOrderById: originals.findProductionOrderById,
        updateProductionOrder: originals.updateProductionOrder,
      });
      Object.assign(recipeRepository, {
        findRecipeVersionById: originals.findRecipeVersionById,
      });
      Object.assign(inventoryRepository, {
        transaction: originals.transaction,
        acquireCompanyInventoryAdvisoryLock: originals.acquireCompanyInventoryAdvisoryLock,
        findLotForProduct: originals.findLotForProduct,
        updateProductById: originals.updateProductById,
        updateLotById: originals.updateLotById,
      });
      Object.assign(inventoryTransactionSupport, {
        getInventoryContext: originals.getInventoryContext,
        changeWarehouseStock: originals.changeWarehouseStock,
        changeLotStock: originals.changeLotStock,
        createMovement: originals.createMovement,
      });
      Object.assign(audit, {
        recordAuditEventSafelyIfAvailable: originals.recordAuditEventSafelyIfAvailable,
      });
      Object.assign(productionRepository, {
        createProductionStageExecution: originals.createProductionStageExecution,
        createProductionConsumption: originals.createProductionConsumption,
        createProductionWaste: originals.createProductionWaste,
        createProductionReturn: originals.createProductionReturn,
        findProductionStageExecutionById: originals.findProductionStageExecutionById,
        findLatestProductionStageExecutionForOrderStage: originals.findLatestProductionStageExecutionForOrderStage,
        syncProductionItemConsumedQuantity: originals.syncProductionItemConsumedQuantity,
        getProductionItemAggregateState: originals.getProductionItemAggregateState,
      });
    });
}

function buildProduct(overrides = {}) {
  return {
    id: 11n,
    companyId: 7n,
    code: 'FG-11',
    name: 'Shampoo final',
    unit: 'KG',
    sourcingMethod: 'PURCHASE_ONLY',
    requiresLot: true,
    requiresExpiration: true,
    recipeId: 50n,
    isActive: true,
    ...overrides,
  };
}

function buildRecipeVersion(overrides = {}) {
  return {
    id: 21n,
    companyId: 7n,
    recipeId: 50n,
    versionNumber: 3,
    status: 'APPROVED',
    effectiveFrom: null,
    effectiveTo: null,
    expectedYield: 100,
    expectedWaste: 2,
    yieldTolerancePercent: 1,
    wasteTolerancePercent: 1,
    instructions: 'Mezclar y envasar',
    notes: 'Snapshot aprobada',
    approvedAt: new Date('2026-08-13T09:00:00.000Z'),
    recipe: {
      id: 50n,
      code: 'REC-50',
      name: 'Formula shampoo',
      recipeType: 'FINISHED_GOOD',
      isActive: true,
    },
    ingredients: [
      {
        id: 91n,
        productId: 31n,
        quantity: 20,
        sortOrder: 0,
        notes: null,
        product: { id: 31n, code: 'RM-31', name: 'Base liquida', unit: 'KG', isActive: true },
      },
    ],
    stages: [
      {
        id: 101n,
        stageOrder: 0,
        name: 'Mezcla',
        instructions: '45C',
        responsibleRoleCode: 'PROD',
        expectedParameters: [],
        parameterTolerances: [],
        requiredEvidence: [],
        qaMandatory: true,
        stageInputs: [],
      },
    ],
    ...overrides,
  };
}

function buildPlanningRecipeVersion(overrides = {}) {
  return buildRecipeVersion({
    stages: [
      {
        id: 101n,
        stageOrder: 0,
        name: 'Pesaje',
        instructions: 'Preparar materias primas',
        responsibleRoleCode: 'PROD',
        expectedParameters: [
          {
            name: 'Temperatura',
            unit: 'C',
            expectedValue: 45,
            minTolerance: -2,
            maxTolerance: 3,
            ignoredLegacyField: 'do-not-copy',
          },
        ],
        parameterTolerances: [],
        requiredEvidence: [],
        qaMandatory: false,
        stageInputs: [
          {
            id: 301n,
            productId: 31n,
            name: 'Base liquida',
            quantity: 1.25,
            unit: 'KG',
            sortOrder: 0,
            notes: null,
            product: { id: 31n, code: 'RM-31', name: 'Base liquida', unit: 'KG', isActive: true },
          },
          {
            id: 302n,
            productId: 32n,
            name: 'Fragancia',
            quantity: 0.25,
            unit: 'L',
            sortOrder: 1,
            notes: null,
            product: { id: 32n, code: 'RM-32', name: 'Fragancia', unit: 'L', isActive: true },
          },
        ],
      },
    ],
    ...overrides,
  });
}

function buildAuditRequestContext() {
  return {
    method: 'POST',
    originalUrl: '/api/production/orders',
    baseUrl: '/api/production',
    route: { path: '/orders' },
    auth: { companyId: '7', sub: '99', username: 'operador', role: 'production_supervisor' },
    requestContext: {
      requestId: 'req-production-stock-override',
      method: 'POST',
      path: '/api/production/orders',
      ip: '127.0.0.1',
      userAgent: 'node-test',
      actor: {
        userId: '99',
        username: 'operador',
        roleCode: 'production_supervisor',
        companyId: '7',
      },
    },
  };
}

const validPayload = {
  productId: 11n,
  recipeVersionId: 21n,
  quantity: 125.5,
  originWarehouseId: 5n,
  destinationWarehouseId: 8n,
  responsibleUserId: 34n,
  priority: 2,
  productionLotCode: 'LOT-PROD-001',
  plannedDate: new Date('2026-08-13T10:00:00.000Z'),
  productionDate: new Date('2026-08-13T12:00:00.000Z'),
  expirationDate: new Date('2026-12-13T12:00:00.000Z'),
};

const auth = {
  companyId: '7',
  sub: '99',
  permissions: ['production.create'],
};

test('createProductionOrder rejects non-production-capable sourcing and unapproved recipes without override', async () => {
  await withPatchedRepositories({
    findProductById: async () => buildProduct({ sourcingMethod: 'PURCHASE_ONLY' }),
    findRecipeVersionById: async () => buildRecipeVersion({ status: 'DRAFT' }),
    findCompanyWarehousesByIds: async () => [{ id: 5n }, { id: 8n }],
    findActiveCompanyUserById: async () => ({ id: 34n, fullName: 'Operador', username: 'operador', status: 'ACTIVE' }),
  }, async () => {
    await assert.rejects(
      () => productionService.createProductionOrder(validPayload, auth),
      (error) => error?.statusCode === 400 && error?.code === 'validation_error',
    );
  });
});

test('createProductionOrder accepts justified override and stores a frozen recipe snapshot', async () => {
  let createdData = null;

  await withPatchedRepositories({
    findProductById: async () => buildProduct({ sourcingMethod: 'PURCHASE_ONLY' }),
    findRecipeVersionById: async () => buildRecipeVersion({ status: 'DRAFT' }),
    findCompanyWarehousesByIds: async () => [{ id: 5n }, { id: 8n }],
    findActiveCompanyUserById: async () => ({ id: 34n, fullName: 'Operador', username: 'operador', status: 'ACTIVE' }),
    createProductionOrder: async (data) => {
      createdData = data;
      return {
        id: 401n,
        companyId: 7n,
        orderId: null,
        productId: data.productId,
        recipeId: data.recipeId,
        recipeVersionId: data.recipeVersionId,
        originWarehouseId: data.originWarehouseId,
        destinationWarehouseId: data.destinationWarehouseId,
        responsibleUserId: data.responsibleUserId,
        quantity: data.quantity,
        status: data.status,
        priority: data.priority,
        responsible: data.responsible,
        productionLotCode: data.productionLotCode,
        plannedDate: data.plannedDate,
        productionDate: data.productionDate,
        expirationDate: data.expirationDate,
        submittedAt: null,
        approvedAt: null,
        startedAt: null,
        cancelledAt: null,
        overrideJustification: data.overrideJustification,
        recipeVersionSnapshot: data.recipeVersionSnapshot,
        createdAt: new Date('2026-08-13T09:30:00.000Z'),
        updatedAt: new Date('2026-08-13T09:30:00.000Z'),
        product: buildProduct({ sourcingMethod: 'PURCHASE_ONLY' }),
        recipe: buildRecipeVersion({ status: 'DRAFT' }).recipe,
        recipeVersion: { id: 21n, recipeId: 50n, versionNumber: 3, status: 'DRAFT', approvedAt: null, updatedAt: new Date('2026-08-13T09:00:00.000Z') },
        originWarehouse: { id: 5n, code: 'RAW', name: 'Raw', warehouseType: 'RAW_MATERIAL', isActive: true },
        destinationWarehouse: { id: 8n, code: 'FG', name: 'Finished', warehouseType: 'FINISHED_GOODS', isActive: true },
        responsibleUser: { id: 34n, fullName: 'Operador', username: 'operador', status: 'ACTIVE' },
        items: [{ id: 1n, productionOrderId: 401n, productId: 11n, recipeId: 50n, plannedQuantity: 125.5, consumedQuantity: 0 }],
      };
    },
  }, async () => {
    const result = await productionService.createProductionOrder({
      ...validPayload,
      overrideJustification: 'Necesitamos correr el lote piloto con validación documentada',
    }, {
      ...auth,
      permissions: ['production.create', 'production.override'],
    });

    assert.equal(result.status, 'DRAFT');
    assert.equal(createdData.overrideJustification, 'Necesitamos correr el lote piloto con validación documentada');
    assert.equal(createdData.items.create[0].plannedQuantity, 125.5);
    assert.equal(createdData.recipeVersionSnapshot.recipeVersion.versionNumber, 3);
    assert.deepEqual(createdData.recipeVersionSnapshot.override.violationCodes, [
      'sourcing_method_not_production_capable',
      'recipe_version_not_approved',
    ]);
  });
});

test('createProductionOrder persists material requirements and enriched snapshot when stock is sufficient', async () => {
  let createdData = null;
  const persistedRequirementRows = [];
  const tx = {
    warehouseStock: {
      findMany: async () => ([
        { productId: 31n, quantity: 500, reservedQuantity: 10 },
        { productId: 32n, quantity: 100, reservedQuantity: 0 },
      ]),
    },
  };

  await withPatchedRepositories({
    findProductById: async () => buildProduct({ sourcingMethod: 'PRODUCTION_ONLY' }),
    findRecipeVersionById: async () => buildPlanningRecipeVersion(),
    findCompanyWarehousesByIds: async () => [{ id: 5n }, { id: 8n }],
    findActiveCompanyUserById: async () => ({ id: 34n, fullName: 'Operador', username: 'operador', status: 'ACTIVE' }),
    transaction: async (work) => work(tx),
    acquireCompanyInventoryAdvisoryLock: async () => {},
    createProductionOrder: async (data) => {
      createdData = data;
      return {
        id: 501n,
        companyId: 7n,
        orderId: null,
        productId: data.productId,
        recipeId: data.recipeId,
        recipeVersionId: data.recipeVersionId,
        originWarehouseId: data.originWarehouseId,
        destinationWarehouseId: data.destinationWarehouseId,
        responsibleUserId: data.responsibleUserId,
        quantity: data.quantity,
        status: data.status,
        priority: data.priority,
        responsible: data.responsible,
        productionLotCode: data.productionLotCode,
        plannedDate: data.plannedDate,
        productionDate: data.productionDate,
        expirationDate: data.expirationDate,
        submittedAt: null,
        approvedAt: null,
        startedAt: null,
        cancelledAt: null,
        overrideJustification: data.overrideJustification,
        recipeVersionSnapshot: data.recipeVersionSnapshot,
        createdAt: new Date('2026-08-20T10:00:00.000Z'),
        updatedAt: new Date('2026-08-20T10:00:00.000Z'),
        product: buildProduct({ sourcingMethod: 'PRODUCTION_ONLY' }),
        recipe: buildPlanningRecipeVersion().recipe,
        recipeVersion: { id: 21n, recipeId: 50n, versionNumber: 3, status: 'APPROVED', approvedAt: new Date('2026-08-13T09:00:00.000Z'), updatedAt: new Date('2026-08-13T09:00:00.000Z') },
        originWarehouse: { id: 5n, code: 'RAW', name: 'Raw', warehouseType: 'RAW_MATERIAL', isActive: true },
        destinationWarehouse: { id: 8n, code: 'FG', name: 'Finished', warehouseType: 'FINISHED_GOODS', isActive: true },
        responsibleUser: { id: 34n, fullName: 'Operador', username: 'operador', status: 'ACTIVE' },
        items: [{ id: 1n, productionOrderId: 501n, productId: 11n, recipeId: 50n, plannedQuantity: 125.5, consumedQuantity: 0 }],
        materialRequirements: [],
      };
    },
    createMaterialRequirements: async (_orderId, rows) => {
      persistedRequirementRows.push(...rows);
      return { count: rows.length };
    },
  }, async () => {
    const result = await productionService.createProductionOrder(validPayload, auth);

    assert.equal(result.status, 'DRAFT');
    assert.equal(createdData.recipeVersionSnapshot.recipeVersion.materialRequirements.length, 2);
    assert.deepEqual(createdData.recipeVersionSnapshot.recipeVersion.materialRequirements, [
      { productId: '31', requiredQuantity: 156.875, availableQuantity: 490, missingQuantity: 0, unit: 'KG' },
      { productId: '32', requiredQuantity: 31.375, availableQuantity: 100, missingQuantity: 0, unit: 'L' },
    ]);
    assert.deepEqual(createdData.recipeVersionSnapshot.recipeVersion.stages[0].expectedParameters, [
      {
        name: 'Temperatura',
        unit: 'C',
        expectedValue: 45,
        minTolerance: -2,
        maxTolerance: 3,
      },
    ]);
    assert.equal('ignoredLegacyField' in createdData.recipeVersionSnapshot.recipeVersion.stages[0].expectedParameters[0], false);
    assert.equal('parameterTolerances' in createdData.recipeVersionSnapshot.recipeVersion.stages[0], false);
    assert.deepEqual(persistedRequirementRows, [
      { companyId: 7n, productionOrderId: 501n, productId: 31n, requiredQuantity: 156.875, unit: 'KG', availableAtCreation: 490, shortageAtCreation: 0 },
      { companyId: 7n, productionOrderId: 501n, productId: 32n, requiredQuantity: 31.375, unit: 'L', availableAtCreation: 100, shortageAtCreation: 0 },
    ]);
  });
});

test('createProductionOrder rejects with 409 insufficient_stock when availability is not enough and no override is provided', async () => {
  const tx = {
    warehouseStock: {
      findMany: async () => ([
        { productId: 31n, quantity: 100, reservedQuantity: 0 },
      ]),
    },
  };

  await withPatchedRepositories({
    findProductById: async () => buildProduct({ sourcingMethod: 'PRODUCTION_ONLY' }),
    findRecipeVersionById: async () => buildPlanningRecipeVersion(),
    findCompanyWarehousesByIds: async () => [{ id: 5n }, { id: 8n }],
    findActiveCompanyUserById: async () => ({ id: 34n, fullName: 'Operador', username: 'operador', status: 'ACTIVE' }),
    transaction: async (work) => work(tx),
    acquireCompanyInventoryAdvisoryLock: async () => {},
  }, async () => {
    await assert.rejects(
      () => productionService.createProductionOrder(validPayload, auth),
      (error) => {
        assert.equal(error?.statusCode, 409);
        assert.equal(error?.code, 'conflict');
        assert.equal(error?.subCode, 'insufficient_stock');
        assert.deepEqual(error?.missing, [
          { productId: 31n, requiredQuantity: 156.875, availableQuantity: 100, missingQuantity: 56.875, unit: 'KG' },
          { productId: 32n, requiredQuantity: 31.375, availableQuantity: 0, missingQuantity: 31.375, unit: 'L' },
        ]);
        return true;
      },
    );
  });
});

test('createProductionOrder allows stock override with justification, persists requirements, and records an audit event', async () => {
  const auditCalls = [];
  const persistedRequirementRows = [];
  const tx = {
    warehouseStock: {
      findMany: async () => ([]),
    },
  };

  await withPatchedRepositories({
    findProductById: async () => buildProduct({ sourcingMethod: 'PRODUCTION_ONLY' }),
    findRecipeVersionById: async () => buildPlanningRecipeVersion(),
    findCompanyWarehousesByIds: async () => [{ id: 5n }, { id: 8n }],
    findActiveCompanyUserById: async () => ({ id: 34n, fullName: 'Operador', username: 'operador', status: 'ACTIVE' }),
    transaction: async (work) => work(tx),
    acquireCompanyInventoryAdvisoryLock: async () => {},
    createProductionOrder: async (data) => ({
      id: 502n,
      companyId: 7n,
      orderId: null,
      productId: data.productId,
      recipeId: data.recipeId,
      recipeVersionId: data.recipeVersionId,
      originWarehouseId: data.originWarehouseId,
      destinationWarehouseId: data.destinationWarehouseId,
      responsibleUserId: data.responsibleUserId,
      quantity: data.quantity,
      status: data.status,
      priority: data.priority,
      responsible: data.responsible,
      productionLotCode: data.productionLotCode,
      plannedDate: data.plannedDate,
      productionDate: data.productionDate,
      expirationDate: data.expirationDate,
      submittedAt: null,
      approvedAt: null,
      startedAt: null,
      cancelledAt: null,
      overrideJustification: data.overrideJustification,
      recipeVersionSnapshot: data.recipeVersionSnapshot,
      createdAt: new Date('2026-08-20T10:00:00.000Z'),
      updatedAt: new Date('2026-08-20T10:00:00.000Z'),
      product: buildProduct({ sourcingMethod: 'PRODUCTION_ONLY' }),
      recipe: buildPlanningRecipeVersion().recipe,
      recipeVersion: { id: 21n, recipeId: 50n, versionNumber: 3, status: 'APPROVED', approvedAt: new Date('2026-08-13T09:00:00.000Z'), updatedAt: new Date('2026-08-13T09:00:00.000Z') },
      originWarehouse: { id: 5n, code: 'RAW', name: 'Raw', warehouseType: 'RAW_MATERIAL', isActive: true },
      destinationWarehouse: { id: 8n, code: 'FG', name: 'Finished', warehouseType: 'FINISHED_GOODS', isActive: true },
      responsibleUser: { id: 34n, fullName: 'Operador', username: 'operador', status: 'ACTIVE' },
      items: [],
      materialRequirements: [],
    }),
    createMaterialRequirements: async (_orderId, rows) => {
      persistedRequirementRows.push(...rows);
      return { count: rows.length };
    },
    recordAuditEventSafelyIfAvailable: async (payload) => {
      auditCalls.push(payload);
      return { id: 1n };
    },
  }, async () => {
    const result = await productionService.createProductionOrder({
      ...validPayload,
      overrideJustification: 'Autorizar producción piloto pese al faltante temporal de insumos críticos',
    }, {
      ...auth,
      permissions: ['production.create', 'production.override'],
    }, buildAuditRequestContext());

    assert.equal(result.status, 'DRAFT');
    assert.equal(persistedRequirementRows.length, 2);
    assert.deepEqual(result.recipeVersionSnapshot.override.violationCodes, ['insufficient_stock']);
    assert.equal(auditCalls.length, 1);
    assert.equal(auditCalls[0].action, 'PRODUCTION_ORDER_OVERRIDE_STOCK');
    assert.equal(auditCalls[0].reasonCode, 'insufficient_stock');
  });
});

test('approveProductionOrder recomputes and persists material requirements when the order has none', async () => {
  const persistedRequirementRows = [];
  const tx = {
    warehouseStock: {
      findMany: async () => ([
        { productId: 31n, quantity: 500, reservedQuantity: 10 },
        { productId: 32n, quantity: 100, reservedQuantity: 0 },
      ]),
    },
  };

  await withPatchedRepositories({
    transaction: async (work) => work(tx),
    acquireCompanyInventoryAdvisoryLock: async () => {},
    findProductionOrderById: async () => ({
      id: 601n,
      companyId: 7n,
      productId: 11n,
      recipeId: 50n,
      recipeVersionId: 21n,
      originWarehouseId: 5n,
      destinationWarehouseId: 8n,
      responsibleUserId: 34n,
      quantity: 125.5,
      status: 'PENDING_APPROVAL',
      priority: 2,
      overrideJustification: null,
      recipeVersionSnapshot: productionService.__private__.buildRecipeVersionSnapshot(buildPlanningRecipeVersion(), null),
      materialRequirements: [],
    }),
    findProductById: async () => buildProduct({ sourcingMethod: 'PRODUCTION_ONLY' }),
    findRecipeVersionById: async () => buildPlanningRecipeVersion(),
    createMaterialRequirements: async (_orderId, rows) => {
      persistedRequirementRows.push(...rows);
      return { count: rows.length };
    },
    updateProductionOrder: async (_id, _companyId, data) => ({
      id: 601n,
      companyId: 7n,
      productId: 11n,
      recipeId: 50n,
      recipeVersionId: 21n,
      originWarehouseId: 5n,
      destinationWarehouseId: 8n,
      responsibleUserId: 34n,
      quantity: 125.5,
      status: data.status,
      priority: 2,
      responsible: null,
      productionLotCode: 'LOT-PROD-001',
      plannedDate: null,
      productionDate: null,
      expirationDate: null,
      submittedAt: new Date('2026-08-20T09:00:00.000Z'),
      approvedAt: data.approvedAt,
      startedAt: null,
      cancelledAt: null,
      overrideJustification: data.overrideJustification,
      recipeVersionSnapshot: data.recipeVersionSnapshot,
      createdAt: new Date('2026-08-20T08:00:00.000Z'),
      updatedAt: new Date('2026-08-20T10:00:00.000Z'),
      product: buildProduct({ sourcingMethod: 'PRODUCTION_ONLY' }),
      recipe: buildPlanningRecipeVersion().recipe,
      recipeVersion: { id: 21n, recipeId: 50n, versionNumber: 3, status: 'APPROVED', approvedAt: new Date('2026-08-13T09:00:00.000Z'), updatedAt: new Date('2026-08-13T09:00:00.000Z') },
      originWarehouse: { id: 5n, code: 'RAW', name: 'Raw', warehouseType: 'RAW_MATERIAL', isActive: true },
      destinationWarehouse: { id: 8n, code: 'FG', name: 'Finished', warehouseType: 'FINISHED_GOODS', isActive: true },
      responsibleUser: { id: 34n, fullName: 'Operador', username: 'operador', status: 'ACTIVE' },
      items: [],
      materialRequirements: persistedRequirementRows,
    }),
  }, async () => {
    const result = await productionService.approveProductionOrder(601n, {}, { ...auth, permissions: ['production.approve'] });

    assert.equal(result.status, 'APPROVED');
    assert.equal(persistedRequirementRows.length, 2);
    assert.deepEqual(result.recipeVersionSnapshot.recipeVersion.materialRequirements, [
      { productId: '31', requiredQuantity: 156.875, availableQuantity: 490, missingQuantity: 0, unit: 'KG' },
      { productId: '32', requiredQuantity: 31.375, availableQuantity: 100, missingQuantity: 0, unit: 'L' },
    ]);
  });
});

test('approveProductionOrder returns 409 when stock falls below persisted requirements before approval', async () => {
  const tx = {
    warehouseStock: {
      findMany: async () => ([
        { productId: 31n, quantity: 100, reservedQuantity: 0 },
        { productId: 32n, quantity: 10, reservedQuantity: 0 },
      ]),
    },
  };

  await withPatchedRepositories({
    transaction: async (work) => work(tx),
    acquireCompanyInventoryAdvisoryLock: async () => {},
    findProductionOrderById: async () => ({
      id: 602n,
      companyId: 7n,
      productId: 11n,
      recipeId: 50n,
      recipeVersionId: 21n,
      originWarehouseId: 5n,
      destinationWarehouseId: 8n,
      responsibleUserId: 34n,
      quantity: 125.5,
      status: 'PENDING_APPROVAL',
      priority: 2,
      overrideJustification: null,
      recipeVersionSnapshot: productionService.__private__.buildRecipeVersionSnapshot(buildPlanningRecipeVersion(), null),
      materialRequirements: [
        { productId: 31n, requiredQuantity: 156.875, unit: 'KG' },
        { productId: 32n, requiredQuantity: 31.375, unit: 'L' },
      ],
    }),
    findProductById: async () => buildProduct({ sourcingMethod: 'PRODUCTION_ONLY' }),
    findRecipeVersionById: async () => buildPlanningRecipeVersion(),
  }, async () => {
    await assert.rejects(
      () => productionService.approveProductionOrder(602n, {}, { ...auth, permissions: ['production.approve'] }),
      (error) => {
        assert.equal(error?.statusCode, 409);
        assert.equal(error?.subCode, 'insufficient_stock');
        return true;
      },
    );
  });
});

test('getProductionOrder returns the stored frozen snapshot even if the recipe later changes elsewhere', async () => {
  const frozenSnapshot = productionService.__private__.buildRecipeVersionSnapshot(buildRecipeVersion(), null);

  await withPatchedRepositories({
    findProductionOrderById: async () => ({
      id: 401n,
      companyId: 7n,
      orderId: null,
      productId: 11n,
      recipeId: 50n,
      recipeVersionId: 21n,
      originWarehouseId: 5n,
      destinationWarehouseId: 8n,
      responsibleUserId: 34n,
      quantity: 125.5,
      status: 'APPROVED',
      priority: 2,
      responsible: null,
      productionLotCode: 'LOT-PROD-001',
      plannedDate: new Date('2026-08-13T10:00:00.000Z'),
      productionDate: new Date('2026-08-13T12:00:00.000Z'),
      expirationDate: new Date('2026-12-13T12:00:00.000Z'),
      submittedAt: new Date('2026-08-13T09:40:00.000Z'),
      approvedAt: new Date('2026-08-13T09:50:00.000Z'),
      startedAt: null,
      cancelledAt: null,
      overrideJustification: null,
      recipeVersionSnapshot: frozenSnapshot,
      createdAt: new Date('2026-08-13T09:30:00.000Z'),
      updatedAt: new Date('2026-08-13T09:50:00.000Z'),
      product: buildProduct({ sourcingMethod: 'PRODUCTION_ONLY' }),
      recipe: { id: 50n, code: 'REC-50', name: 'Formula cambiada después', recipeType: 'FINISHED_GOOD', isActive: true },
      recipeVersion: { id: 21n, recipeId: 50n, versionNumber: 3, status: 'APPROVED', approvedAt: new Date('2026-08-13T09:00:00.000Z'), updatedAt: new Date('2026-08-14T09:00:00.000Z') },
      originWarehouse: { id: 5n, code: 'RAW', name: 'Raw', warehouseType: 'RAW_MATERIAL', isActive: true },
      destinationWarehouse: { id: 8n, code: 'FG', name: 'Finished', warehouseType: 'FINISHED_GOODS', isActive: true },
      responsibleUser: { id: 34n, fullName: 'Operador', username: 'operador', status: 'ACTIVE' },
      items: [],
    }),
  }, async () => {
    const result = await productionService.getProductionOrder(401n, auth);
    assert.equal(result.recipeVersionSnapshot.recipe.name, 'Formula shampoo');
    assert.equal(result.recipe.name, 'Formula cambiada después');
  });
});

test('executeProductionStage records traceable consumption and waste using production-specific reason codes', async () => {
  const movements = [];
  const consumptions = [];
  const wastes = [];
  let stageExecutionId = null;
  let warehouseChangeCounter = 0;
  const order = {
    id: 401n,
    companyId: 7n,
    originWarehouseId: 5n,
    status: 'IN_PROGRESS',
    recipeVersionSnapshot: productionService.__private__.buildRecipeVersionSnapshot(buildRecipeVersion(), null),
  };

  await withPatchedRepositories({
    transaction: async (work) => work({ txId: 'stage-execution' }),
    acquireCompanyInventoryAdvisoryLock: async () => {},
    findProductionOrderById: async () => order,
    createProductionStageExecution: async (data) => {
      stageExecutionId = 990n;
      return { id: stageExecutionId, ...data, consumptions: [], wastes: [], returns: [], createdAt: new Date('2026-08-14T08:50:00.000Z'), updatedAt: new Date('2026-08-14T08:50:00.000Z') };
    },
    createProductionConsumption: async (data) => {
      consumptions.push(data);
      return data;
    },
    createProductionWaste: async (data) => {
      wastes.push(data);
      return data;
    },
    syncProductionItemConsumedQuantity: async () => ({ productionOrderId: 401n, totalConsumed: 5, updatedItemCount: 1 }),
    findProductionStageExecutionById: async () => ({
      id: stageExecutionId,
      productionOrderId: 401n,
      recipeStageId: 101n,
      stageOrder: 0,
      stageName: 'Mezcla',
      responsibleUserId: 99n,
      startedAt: new Date('2026-08-14T08:00:00.000Z'),
      endedAt: new Date('2026-08-14T08:45:00.000Z'),
      actualParameters: [{ name: 'temperature', value: 45.5, unit: 'C' }],
      evidence: [{ type: 'photo', reference: 'storage://photo-1.jpg' }],
      notes: 'Ejecución completada',
      movementGroupId: 'group-1',
      createdAt: new Date('2026-08-14T08:50:00.000Z'),
      updatedAt: new Date('2026-08-14T08:50:00.000Z'),
      consumptions,
      wastes,
      returns: [],
    }),
    getInventoryContext: async (_tx, _auth, warehouseId, productId) => ({
      companyId: 7n,
      warehouse: { id: warehouseId },
      product: { id: BigInt(productId), requiresLot: true },
    }),
    findLotForProduct: async (lotId, productId) => ({ id: BigInt(lotId), productId: BigInt(productId) }),
    changeWarehouseStock: async () => {
      warehouseChangeCounter += 1;
      return { before: 50 - (warehouseChangeCounter - 1) * 5, after: 45 - (warehouseChangeCounter - 1) * 5 };
    },
    changeLotStock: async () => ({ before: 50, after: 45 }),
    updateProductById: async () => ({}),
    updateLotById: async () => ({}),
    createMovement: async (_tx, _context, data) => {
      movements.push(data);
      return data;
    },
  }, async () => {
    const result = await productionService.executeProductionStage(401n, 101n, {
      startedAt: new Date('2026-08-14T08:00:00.000Z'),
      endedAt: new Date('2026-08-14T08:45:00.000Z'),
      actualParameters: [{ name: 'temperature', value: 45.5, unit: 'C' }],
      evidence: [{ type: 'photo', reference: 'storage://photo-1.jpg' }],
      consumptions: [{ productId: 31n, lotId: 700n, quantity: 5, note: 'Base líquida' }],
      waste: [{ productId: 31n, lotId: 700n, quantity: 0.5, note: 'Merma controlada' }],
      notes: 'Ejecución completada',
    }, auth);

    assert.equal(result.recipeStageId, 101n);
    assert.equal(consumptions.length, 1);
    assert.equal(wastes.length, 1);
    assert.equal(movements.length, 2);
    assert.equal(movements[0].reasonCode, 'PRODUCTION_CONSUMPTION');
    assert.equal(movements[1].reasonCode, 'PRODUCTION_WASTE');
    assert.equal(movements[0].sourceType, 'production_stage_execution');
    assert.equal(consumptions[0].stageExecutionId, 990n);
    assert.equal(wastes[0].stageExecutionId, 990n);
  });
});

test('executeProductionStage rejects raw-material consumption without lotId before persistence', async () => {
  await withPatchedRepositories({
    transaction: async (work) => work({ txId: 'stage-execution' }),
    acquireCompanyInventoryAdvisoryLock: async () => {},
    findProductionOrderById: async () => ({
      id: 401n,
      companyId: 7n,
      originWarehouseId: 5n,
      status: 'IN_PROGRESS',
      recipeVersionSnapshot: productionService.__private__.buildRecipeVersionSnapshot(buildRecipeVersion(), null),
    }),
    createProductionStageExecution: async (data) => ({
      id: 990n,
      ...data,
      consumptions: [],
      wastes: [],
      createdAt: new Date('2026-08-14T08:50:00.000Z'),
      updatedAt: new Date('2026-08-14T08:50:00.000Z'),
    }),
  }, async () => {
    await assert.rejects(
      () => productionService.executeProductionStage(401n, 101n, {
        startedAt: new Date('2026-08-14T08:00:00.000Z'),
        endedAt: new Date('2026-08-14T08:45:00.000Z'),
        consumptions: [{ productId: 31n, quantity: 5 }],
      }, auth),
      (error) => error?.statusCode === 400 && error?.code === 'validation_error',
    );
  });
});

test('executeProductionStage rejects raw-material waste without lotId before persistence', async () => {
  await withPatchedRepositories({
    transaction: async (work) => work({ txId: 'stage-execution' }),
    acquireCompanyInventoryAdvisoryLock: async () => {},
    findProductionOrderById: async () => ({
      id: 401n,
      companyId: 7n,
      originWarehouseId: 5n,
      status: 'IN_PROGRESS',
      recipeVersionSnapshot: productionService.__private__.buildRecipeVersionSnapshot(buildRecipeVersion(), null),
    }),
    createProductionStageExecution: async (data) => ({
      id: 990n,
      ...data,
      consumptions: [],
      wastes: [],
      createdAt: new Date('2026-08-14T08:50:00.000Z'),
      updatedAt: new Date('2026-08-14T08:50:00.000Z'),
    }),
  }, async () => {
    await assert.rejects(
      () => productionService.executeProductionStage(401n, 101n, {
        startedAt: new Date('2026-08-14T08:00:00.000Z'),
        endedAt: new Date('2026-08-14T08:45:00.000Z'),
        waste: [{ productId: 31n, quantity: 0.5 }],
      }, auth),
      (error) => error?.statusCode === 400
        && error?.code === 'validation_error'
        && error?.message === 'La merma de materia prima en producción requiere lote',
    );
  });
});

test('recordProductionReturn creates an explicit stage/product/lot return with controlled stock effect and audit linkage', async () => {
  const movements = [];
  const returns = [];
  let warehouseChangeCounter = 0;

  await withPatchedRepositories({
    transaction: async (work) => work({ txId: 'production-return' }),
    acquireCompanyInventoryAdvisoryLock: async () => {},
    findProductionOrderById: async () => ({
      id: 401n,
      companyId: 7n,
      originWarehouseId: 5n,
      status: 'IN_PROGRESS',
      recipeVersionSnapshot: productionService.__private__.buildRecipeVersionSnapshot(buildRecipeVersion(), null),
    }),
    findLatestProductionStageExecutionForOrderStage: async () => ({
      id: 990n,
      productionOrderId: 401n,
      recipeStageId: 101n,
      stageOrder: 0,
      stageName: 'Mezcla',
      consumptions: [],
      wastes: [],
      returns: [],
    }),
    createProductionReturn: async (data) => {
      const created = {
        id: 1201n,
        ...data,
        createdAt: new Date('2026-08-16T10:05:00.000Z'),
      };
      returns.push(created);
      return created;
    },
    getInventoryContext: async (_tx, _auth, warehouseId, productId) => ({
      companyId: 7n,
      warehouse: { id: warehouseId },
      product: { id: BigInt(productId), requiresLot: true },
    }),
    findLotForProduct: async (lotId, productId) => ({ id: BigInt(lotId), productId: BigInt(productId) }),
    changeWarehouseStock: async () => {
      warehouseChangeCounter += 1;
      return { before: 40 + (warehouseChangeCounter - 1), after: 42 + (warehouseChangeCounter - 1) };
    },
    changeLotStock: async () => ({ before: 40, after: 42 }),
    updateProductById: async () => ({}),
    updateLotById: async () => ({}),
    createMovement: async (_tx, _context, data) => {
      movements.push(data);
      return { id: 8801n, ...data };
    },
  }, async () => {
    const result = await productionService.recordProductionReturn(401n, 101n, {
      productId: 31n,
      lotId: 700n,
      quantity: 2,
      reasonCode: 'RETURN_UNUSED_RAW_MATERIAL',
      note: 'Excedente recuperado',
      returnedAt: new Date('2026-08-16T10:00:00.000Z'),
    }, auth);

    assert.equal(returns.length, 1);
    assert.equal(movements.length, 1);
    assert.equal(result.stageExecutionId, 990n);
    assert.equal(result.productId, 31n);
    assert.equal(result.lotId, 700n);
    assert.equal(result.reasonCode, 'RETURN_UNUSED_RAW_MATERIAL');
    assert.equal(result.responsibleUserId, 99n);
    assert.equal(movements[0].movementType, 'IN');
    assert.equal(movements[0].reasonCode, 'RETURN_UNUSED_RAW_MATERIAL');
    assert.equal(movements[0].sourceType, 'production_return');
    assert.equal(movements[0].sourceId, 1201n);
    assert.equal(typeof result.movementGroupId, 'string');
    assert.equal(result.movementGroupId, movements[0].movementGroupId);
  });
});

test('recordProductionReturn rejects raw-material return without lotId before persistence', async () => {
  await withPatchedRepositories({
    transaction: async (work) => work({ txId: 'production-return' }),
    acquireCompanyInventoryAdvisoryLock: async () => {},
    findProductionOrderById: async () => ({
      id: 401n,
      companyId: 7n,
      originWarehouseId: 5n,
      status: 'IN_PROGRESS',
      recipeVersionSnapshot: productionService.__private__.buildRecipeVersionSnapshot(buildRecipeVersion(), null),
    }),
    findLatestProductionStageExecutionForOrderStage: async () => ({
      id: 990n,
      productionOrderId: 401n,
      recipeStageId: 101n,
      stageOrder: 0,
      stageName: 'Mezcla',
      consumptions: [],
      wastes: [],
      returns: [],
    }),
  }, async () => {
    await assert.rejects(
      () => productionService.recordProductionReturn(401n, 101n, {
        productId: 31n,
        quantity: 1,
        reasonCode: 'RETURN_UNUSED_RAW_MATERIAL',
      }, auth),
      (error) => error?.statusCode === 400
        && error?.code === 'validation_error'
        && error?.message === 'La devolución de materia prima en producción requiere lote',
    );
  });
});

test('executeProductionStage synchronizes ProductionItem.consumedQuantity as auxiliary aggregate after consumption writes', async () => {
  const syncCalls = [];

  await withPatchedRepositories({
    transaction: async (work) => work({ txId: 'stage-execution' }),
    acquireCompanyInventoryAdvisoryLock: async () => {},
    findProductionOrderById: async () => ({
      id: 401n,
      companyId: 7n,
      originWarehouseId: 5n,
      status: 'IN_PROGRESS',
      recipeVersionSnapshot: productionService.__private__.buildRecipeVersionSnapshot(buildRecipeVersion(), null),
    }),
    createProductionStageExecution: async (data) => ({
      id: 990n,
      ...data,
      consumptions: [],
      wastes: [],
      returns: [],
      createdAt: new Date('2026-08-17T08:50:00.000Z'),
      updatedAt: new Date('2026-08-17T08:50:00.000Z'),
    }),
    createProductionConsumption: async (data) => data,
    createProductionWaste: async (data) => data,
    syncProductionItemConsumedQuantity: async (orderId) => {
      syncCalls.push({ orderId });
      return { productionOrderId: orderId, totalConsumed: 5, updatedItemCount: 1 };
    },
    findProductionStageExecutionById: async () => ({
      id: 990n,
      productionOrderId: 401n,
      recipeStageId: 101n,
      stageOrder: 0,
      stageName: 'Mezcla',
      consumptions: [],
      wastes: [],
      returns: [],
    }),
    getInventoryContext: async (_tx, _auth, warehouseId, productId) => ({
      companyId: 7n,
      warehouse: { id: warehouseId },
      product: { id: BigInt(productId), requiresLot: true },
    }),
    findLotForProduct: async (lotId, productId) => ({ id: BigInt(lotId), productId: BigInt(productId) }),
    changeWarehouseStock: async () => ({ before: 50, after: 45 }),
    changeLotStock: async () => ({ before: 50, after: 45 }),
    updateProductById: async () => ({}),
    updateLotById: async () => ({}),
    createMovement: async () => ({}),
  }, async () => {
    await productionService.executeProductionStage(401n, 101n, {
      startedAt: new Date('2026-08-17T08:00:00.000Z'),
      endedAt: new Date('2026-08-17T08:45:00.000Z'),
      consumptions: [{ productId: 31n, lotId: 700n, quantity: 5 }],
      waste: [{ productId: 31n, lotId: 700n, quantity: 0.5 }],
    }, auth);

    assert.equal(syncCalls.length, 1, 'syncProductionItemConsumedQuantity must be called once after consumption writes');
    assert.equal(syncCalls[0].orderId, 401n);
  });
});

test('executeProductionStage skips aggregate sync when no consumption entries are recorded', async () => {
  const syncCalls = [];

  await withPatchedRepositories({
    transaction: async (work) => work({ txId: 'stage-execution' }),
    acquireCompanyInventoryAdvisoryLock: async () => {},
    findProductionOrderById: async () => ({
      id: 401n,
      companyId: 7n,
      originWarehouseId: 5n,
      status: 'IN_PROGRESS',
      recipeVersionSnapshot: productionService.__private__.buildRecipeVersionSnapshot(buildRecipeVersion(), null),
    }),
    createProductionStageExecution: async (data) => ({
      id: 990n,
      ...data,
      consumptions: [],
      wastes: [],
      returns: [],
      createdAt: new Date('2026-08-17T08:50:00.000Z'),
      updatedAt: new Date('2026-08-17T08:50:00.000Z'),
    }),
    createProductionWaste: async (data) => data,
    syncProductionItemConsumedQuantity: async (orderId) => {
      syncCalls.push({ orderId });
      return { productionOrderId: orderId, totalConsumed: 0, updatedItemCount: 1 };
    },
    findProductionStageExecutionById: async () => ({
      id: 990n,
      productionOrderId: 401n,
      recipeStageId: 101n,
      stageOrder: 0,
      stageName: 'Mezcla',
      consumptions: [],
      wastes: [],
      returns: [],
    }),
    getInventoryContext: async (_tx, _auth, warehouseId, productId) => ({
      companyId: 7n,
      warehouse: { id: warehouseId },
      product: { id: BigInt(productId), requiresLot: true },
    }),
    findLotForProduct: async (lotId, productId) => ({ id: BigInt(lotId), productId: BigInt(productId) }),
    changeWarehouseStock: async () => ({ before: 50, after: 49.5 }),
    changeLotStock: async () => ({ before: 50, after: 49.5 }),
    updateProductById: async () => ({}),
    updateLotById: async () => ({}),
    createMovement: async () => ({}),
  }, async () => {
    await productionService.executeProductionStage(401n, 101n, {
      startedAt: new Date('2026-08-17T08:00:00.000Z'),
      endedAt: new Date('2026-08-17T08:45:00.000Z'),
      waste: [{ productId: 31n, lotId: 700n, quantity: 0.5 }],
    }, auth);

    assert.equal(syncCalls.length, 0, 'syncProductionItemConsumedQuantity must not be called when no consumption entries exist');
  });
});

test('reconcileProductionOrderAggregates detects and repairs aggregate mismatch from authoritative detail', async () => {
  await withPatchedRepositories({
    findProductionOrderById: async () => ({
      id: 401n,
      companyId: 7n,
      status: 'IN_PROGRESS',
      items: [{ id: 1n, productionOrderId: 401n, productId: 11n, consumedQuantity: 0 }],
    }),
    getProductionItemAggregateState: async () => ({
      productionOrderId: 401n,
      items: [{ id: 1n, productionOrderId: 401n, productId: 11n, consumedQuantity: 0 }],
      authoritativeTotal: 15.5,
      itemAggregateTotal: 0,
      isSynchronized: false,
    }),
    syncProductionItemConsumedQuantity: async () => ({
      productionOrderId: 401n,
      totalConsumed: 15.5,
      updatedItemCount: 1,
    }),
  }, async () => {
    const result = await productionService.reconcileProductionOrderAggregates(401n, auth);

    assert.equal(result.action, 'repaired');
    assert.equal(result.reason, 'aggregate_mismatch_detected_and_repaired');
    assert.equal(result.authoritativeTotalBefore, 15.5);
    assert.equal(result.itemAggregateTotalBefore, 0);
    assert.equal(result.authoritativeTotalAfter, 15.5);
    assert.equal(result.updatedItemCount, 1);
  });
});

test('reconcileProductionOrderAggregates returns no-op when aggregate is already synchronized', async () => {
  await withPatchedRepositories({
    findProductionOrderById: async () => ({
      id: 401n,
      companyId: 7n,
      status: 'IN_PROGRESS',
      items: [{ id: 1n, productionOrderId: 401n, productId: 11n, consumedQuantity: 15.5 }],
    }),
    getProductionItemAggregateState: async () => ({
      productionOrderId: 401n,
      items: [{ id: 1n, productionOrderId: 401n, productId: 11n, consumedQuantity: 15.5 }],
      authoritativeTotal: 15.5,
      itemAggregateTotal: 15.5,
      isSynchronized: true,
    }),
  }, async () => {
    const result = await productionService.reconcileProductionOrderAggregates(401n, auth);

    assert.equal(result.action, 'none');
    assert.equal(result.reason, 'aggregate_already_synchronized');
    assert.equal(result.authoritativeTotal, 15.5);
    assert.equal(result.itemAggregateTotal, 15.5);
  });
});

test('reconcileProductionOrderAggregates rejects non-existent production order', async () => {
  await withPatchedRepositories({
    findProductionOrderById: async () => null,
  }, async () => {
    await assert.rejects(
      () => productionService.reconcileProductionOrderAggregates(999n, auth),
      (error) => error?.statusCode === 404 && error?.code === 'not_found',
    );
  });
});

test('executeProductionStage rejects stage execution when the production order is not in progress', async () => {
  await withPatchedRepositories({
    transaction: async (work) => work({ txId: 'stage-execution' }),
    acquireCompanyInventoryAdvisoryLock: async () => {},
    findProductionOrderById: async () => ({
      id: 401n,
      companyId: 7n,
      originWarehouseId: 5n,
      status: 'APPROVED',
      recipeVersionSnapshot: productionService.__private__.buildRecipeVersionSnapshot(buildRecipeVersion(), null),
    }),
  }, async () => {
    await assert.rejects(
      () => productionService.executeProductionStage(401n, 101n, {
        startedAt: new Date('2026-08-14T08:00:00.000Z'),
        endedAt: new Date('2026-08-14T08:45:00.000Z'),
        consumptions: [{ productId: 31n, lotId: 700n, quantity: 5 }],
      }, auth),
      (error) => error?.statusCode === 409 && error?.code === 'conflict',
    );
  });
});
