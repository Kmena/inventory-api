const test = require('node:test');
const assert = require('node:assert/strict');

const productRepository = require('../src/repositories/product.repository');
const recipeRepository = require('../src/repositories/recipe.repository');
const recipeService = require('../src/services/recipe.service');

function withModuleStubs(moduleStubs, run) {
  const originals = [];

  for (const [moduleRef, stubs] of moduleStubs) {
    for (const [key, value] of Object.entries(stubs)) {
      originals.push([moduleRef, key, moduleRef[key]]);
      moduleRef[key] = value;
    }
  }

  return Promise.resolve()
    .then(run)
    .finally(() => {
      for (const [moduleRef, key, value] of originals) {
        moduleRef[key] = value;
      }
    });
}

const auth = {
  companyId: '7',
  sub: '15',
  permissions: ['recipes.manage', 'recipes.approve'],
};

test('createRecipeVersion rejects stage-input product references outside the authenticated company', async () => {
  await withModuleStubs([
    [recipeRepository, {
      findRecipeById: async (recipeId, companyId) => ({ id: recipeId, companyId, versions: [] }),
    }],
    [productRepository, {
      findProductsByIds: async () => [{ id: 11n, name: 'Base', unit: 'KG' }],
    }],
  ], async () => {
    await assert.rejects(
      () => recipeService.createRecipeVersion(33n, {
        stages: [{
          name: 'Preparacion',
          stageInputs: [
            { productId: 11n, name: 'Base', quantity: 5, unit: 'KG' },
            { productId: 99n, name: 'Desconocido', quantity: 1, unit: 'KG' },
          ],
        }],
      }, auth),
      (error) => {
        assert.equal(error?.statusCode, 400);
        assert.equal(error?.code, 'validation_error');
        assert.match(error?.message || '', /deben pertenecer a la empresa autenticada/i);
        return true;
      },
    );
  });
});

test('createRecipeVersion rejects stage input units that differ from the catalog product unit', async () => {
  await withModuleStubs([
    [recipeRepository, {
      findRecipeById: async (recipeId, companyId) => ({ id: recipeId, companyId, versions: [] }),
    }],
    [productRepository, {
      findProductsByIds: async () => [{ id: 11n, name: 'Base', unit: 'KG' }],
    }],
  ], async () => {
    await assert.rejects(
      () => recipeService.createRecipeVersion(33n, {
        stages: [{
          name: 'Preparacion',
          stageInputs: [{ productId: 11n, name: 'Base', quantity: 5, unit: 'LB' }],
        }],
      }, auth),
      (error) => {
        assert.equal(error?.statusCode, 400);
        assert.equal(error?.code, 'validation_error');
        assert.match(error?.message || '', /debe coincidir con la unidad del producto/i);
        assert.match(error?.message || '', /esperada: KG/i);
        return true;
      },
    );
  });
});

test('assertStageInputsUnitConsistency ignores descriptive stage inputs without productId', async () => {
  await assert.doesNotReject(() => recipeService.assertStageInputsUnitConsistency({
    stages: [{
      name: 'Preparacion',
      stageInputs: [{ name: 'Nota operativa', quantity: 1, unit: null }],
    }],
  }, 7n));
});

test('createRecipeVersion creates the next draft version with stages and derives ingredients from stage inputs', async () => {
  const observed = {
    createPayload: null,
  };

  const createdVersion = {
    id: 91n,
    companyId: 7n,
    recipeId: 33n,
    versionNumber: 3,
    status: 'DRAFT',
    effectiveFrom: null,
    effectiveTo: null,
    expectedYield: 100,
    expectedWaste: 2,
    yieldTolerancePercent: 1.5,
    wasteTolerancePercent: 3,
    instructions: 'Mezclar de forma homogénea',
    notes: 'Borrador operativo',
    approvedAt: null,
    createdAt: new Date('2026-08-12T10:00:00.000Z'),
    updatedAt: new Date('2026-08-12T10:00:00.000Z'),
    createdByUser: { id: 15n, fullName: 'Admin', username: 'admin' },
    approvedByUser: null,
    stages: [{
      id: 2n,
      stageOrder: 0,
      name: 'Preparacion',
      instructions: 'Tamizar',
      responsibleRoleCode: 'production_operator',
      expectedParameters: [],
      parameterTolerances: [],
      requiredEvidence: [],
      qaMandatory: true,
      stageInputs: [{
        id: 3n,
        productId: 11n,
        name: 'Base',
        quantity: 25,
        unit: 'KG',
        sortOrder: 0,
        notes: null,
        product: { id: 11n, code: 'MAT-11', name: 'Base', unit: 'KG', isActive: true },
      }],
    }],
    recipe: { id: 33n, name: 'Shampoo base' },
  };

  const result = await withModuleStubs([
    [recipeRepository, {
      findRecipeById: async (recipeId, companyId) => ({ id: recipeId, companyId, versions: [] }),
      findLatestRecipeVersion: async () => ({ id: 90n, versionNumber: 2 }),
      createRecipeVersion: async (payload) => {
        observed.createPayload = payload;
        return createdVersion;
      },
    }],
    [productRepository, {
      findProductsByIds: async () => [{ id: 11n, name: 'Base', unit: 'KG' }],
    }],
  ], () => recipeService.createRecipeVersion(33n, {
    expectedYield: 100,
    expectedWaste: 2,
    yieldTolerancePercent: 1.5,
    wasteTolerancePercent: 3,
    instructions: 'Mezclar de forma homogénea',
    notes: 'Borrador operativo',
    stages: [{
      name: 'Preparacion',
      instructions: 'Tamizar',
      responsibleRoleCode: 'production_operator',
      qaMandatory: true,
      stageInputs: [{ productId: 11n, name: 'Base', quantity: 25, unit: 'KG' }],
    }],
  }, auth));

  assert.equal(observed.createPayload.recipeId, 33n);
  assert.equal(observed.createPayload.companyId, 7n);
  assert.equal(observed.createPayload.versionNumber, 3);
  assert.equal(observed.createPayload.createdByUserId, 15n);
  assert.equal(observed.createPayload.stages.create[0].stageInputs.create[0].name, 'Base');
  assert.equal(result.versionNumber, 3);
  assert.equal(result.status, 'DRAFT');
  assert.equal(result.stages[0].qaMandatory, true);
  // Ingredients are now derived from stage inputs
  assert.equal(result.ingredients.length, 1);
  assert.equal(result.ingredients[0].productId, 11n);
  assert.equal(result.ingredients[0].quantity, 25);
});

test('approveRecipeVersion records approval metadata and marks the version immutable', async () => {
  const observed = {
    updatePayload: null,
  };

  const approvedVersion = {
    id: 91n,
    companyId: 7n,
    recipeId: 33n,
    versionNumber: 3,
    status: 'APPROVED',
    effectiveFrom: new Date('2026-08-15T00:00:00.000Z'),
    effectiveTo: null,
    expectedYield: 100,
    expectedWaste: 2,
    yieldTolerancePercent: 1.5,
    wasteTolerancePercent: 3,
    instructions: 'Mezclar de forma homogénea',
    notes: 'Aprobada',
    approvedAt: new Date('2026-08-12T12:00:00.000Z'),
    createdAt: new Date('2026-08-12T10:00:00.000Z'),
    updatedAt: new Date('2026-08-12T12:00:00.000Z'),
    createdByUser: { id: 15n, fullName: 'Admin', username: 'admin' },
    approvedByUser: { id: 15n, fullName: 'Admin', username: 'admin' },
    stages: [],
    recipe: { id: 33n, name: 'Shampoo base' },
  };

  const result = await withModuleStubs([
    [recipeRepository, {
      findRecipeVersionById: async () => ({ id: 91n, companyId: 7n, status: 'DRAFT' }),
      updateRecipeVersion: async (_id, _companyId, payload) => {
        observed.updatePayload = payload;
        return approvedVersion;
      },
    }],
  ], () => recipeService.approveRecipeVersion(91n, {
    effectiveFrom: new Date('2026-08-15T00:00:00.000Z'),
  }, auth));

  assert.equal(observed.updatePayload.status, 'APPROVED');
  assert.equal(observed.updatePayload.approvedByUserId, 15n);
  assert.ok(observed.updatePayload.approvedAt instanceof Date);
  assert.equal(result.status, 'APPROVED');
  assert.equal(result.approvedByUser.username, 'admin');
});

// TASK-010 / DEC-005: Idempotencia por guarda natural — no Idempotency-Key header.
// approveRecipeVersion retorna 409 si la versión ya está APPROVED.
// La segunda llamada es fácilmente detectable por el cliente (409 conflict).
test('approveRecipeVersion returns 409 when version is already APPROVED (natural idempotency guard) (TASK-010)', async () => {
  await withModuleStubs([
    [recipeRepository, {
      findRecipeVersionById: async () => ({ id: 91n, companyId: 7n, status: 'APPROVED' }),
    }],
  ], async () => {
    await assert.rejects(
      () => recipeService.approveRecipeVersion(91n, {}, auth),
      (error) => {
        assert.equal(error?.statusCode, 409, 'Must return 409 for already-approved version');
        assert.equal(error?.code, 'conflict');
        // No Idempotency-Key logic — guard is natural (status check before DB write)
        return true;
      },
    );
  });
});

test('updateRecipeVersion rejects in-place mutation of an approved version', async () => {
  await withModuleStubs([
    [recipeRepository, {
      findRecipeVersionById: async () => ({ id: 91n, companyId: 7n, status: 'APPROVED' }),
    }],
  ], async () => {
    await assert.rejects(
      () => recipeService.updateRecipeVersion(91n, { notes: 'No permitido' }, auth),
      (error) => {
        assert.equal(error?.statusCode, 409);
        assert.equal(error?.code, 'conflict');
        assert.match(error?.message || '', /inmutables/i);
        return true;
      },
    );
  });
});

test('aggregateIngredientsFromStages merges quantities by product across stages', () => {
  const stages = [
    {
      stageInputs: [
        { productId: 11n, quantity: 10, product: { id: 11n, code: 'A', name: 'Base', unit: 'KG', isActive: true } },
        { productId: 12n, quantity: 5, product: { id: 12n, code: 'B', name: 'Fragancia', unit: 'KG', isActive: true } },
        { name: 'Temperatura', quantity: null, productId: null },
      ],
    },
    {
      stageInputs: [
        { productId: 11n, quantity: 15, product: { id: 11n, code: 'A', name: 'Base', unit: 'KG', isActive: true } },
      ],
    },
  ];

  const result = recipeService.aggregateIngredientsFromStages(stages);

  assert.equal(result.length, 2);
  const base = result.find((i) => String(i.productId) === '11');
  const fragrance = result.find((i) => String(i.productId) === '12');
  assert.equal(base.quantity, 25);
  assert.equal(fragrance.quantity, 5);
});

// ─── TASK-004: quantityBasis persistence and serialization ───────────────────

test('createRecipeVersion persists PER_OUTPUT_KG quantityBasis from payload (TASK-004)', async () => {
  const observed = { createPayload: null };

  const createdVersion = {
    id: 92n, companyId: 7n, recipeId: 33n, versionNumber: 1,
    status: 'DRAFT', quantityBasis: 'PER_OUTPUT_KG',
    effectiveFrom: null, effectiveTo: null,
    expectedYield: null, expectedWaste: null,
    yieldTolerancePercent: null, wasteTolerancePercent: null,
    instructions: null, notes: null,
    approvedAt: null, createdAt: new Date(), updatedAt: new Date(),
    createdByUser: null, approvedByUser: null, stages: [],
    recipe: { id: 33n, name: 'Test' },
  };

  await withModuleStubs(
    [
      [recipeRepository, {
        findRecipeById: async (id, companyId) => ({ id, companyId, versions: [] }),
        findLatestRecipeVersion: async () => null,
        createRecipeVersion: async (payload) => { observed.createPayload = payload; return createdVersion; },
      }],
      [productRepository, { findProductsByIds: async () => [] }],
    ],
    () => recipeService.createRecipeVersion(33n, {
      quantityBasis: 'PER_OUTPUT_KG',
      stages: [{ name: 'Mezcla', stageInputs: [] }],
    }, auth),
  );

  assert.equal(observed.createPayload.quantityBasis, 'PER_OUTPUT_KG');
});

test('createRecipeVersion defaults quantityBasis to PER_OUTPUT_KG when omitted (TASK-004)', async () => {
  const observed = { createPayload: null };

  const createdVersion = {
    id: 93n, companyId: 7n, recipeId: 33n, versionNumber: 1,
    status: 'DRAFT', quantityBasis: 'PER_OUTPUT_KG',
    effectiveFrom: null, effectiveTo: null,
    expectedYield: null, expectedWaste: null,
    yieldTolerancePercent: null, wasteTolerancePercent: null,
    instructions: null, notes: null,
    approvedAt: null, createdAt: new Date(), updatedAt: new Date(),
    createdByUser: null, approvedByUser: null, stages: [],
    recipe: { id: 33n, name: 'Test' },
  };

  await withModuleStubs(
    [
      [recipeRepository, {
        findRecipeById: async (id, companyId) => ({ id, companyId, versions: [] }),
        findLatestRecipeVersion: async () => null,
        createRecipeVersion: async (payload) => { observed.createPayload = payload; return createdVersion; },
      }],
      [productRepository, { findProductsByIds: async () => [] }],
    ],
    () => recipeService.createRecipeVersion(33n, {
      stages: [{ name: 'Mezcla', stageInputs: [] }],
    }, auth),
  );

  // Basis must default to PER_OUTPUT_KG even when not supplied in payload.
  assert.equal(observed.createPayload.quantityBasis, 'PER_OUTPUT_KG');
});

test('serializeRecipeVersion exposes quantityBasis from the DB record (TASK-004)', () => {
  const version = {
    id: 91n, recipeId: 33n, companyId: 7n, versionNumber: 1,
    status: 'DRAFT', quantityBasis: 'PER_OUTPUT_KG',
    effectiveFrom: null, effectiveTo: null,
    expectedYield: null, expectedWaste: null,
    yieldTolerancePercent: null, wasteTolerancePercent: null,
    instructions: null, notes: null,
    approvedAt: null, createdAt: new Date(), updatedAt: new Date(),
    createdByUser: null, approvedByUser: null, stages: [],
  };

  const serialized = recipeService.serializeRecipeVersion(version);

  assert.equal(serialized.quantityBasis, 'PER_OUTPUT_KG');
});

// ─── recipe-stage-lineage-validation ─────────────────────────────────────────
// Shared helpers for lineage tests

function makeMinimalDraftVersion(overrides = {}) {
  return {
    id: 91n, companyId: 7n, recipeId: 33n, versionNumber: 1,
    status: 'DRAFT', quantityBasis: 'PER_OUTPUT_KG',
    effectiveFrom: null, effectiveTo: null,
    expectedYield: null, expectedWaste: null,
    yieldTolerancePercent: null, wasteTolerancePercent: null,
    instructions: null, notes: null,
    approvedAt: null, createdAt: new Date(), updatedAt: new Date(),
    createdByUser: null, approvedByUser: null,
    stages: [],
    recipe: { id: 33n, name: 'Test' },
    ...overrides,
  };
}

const lineageStubs = (extraRepoStubs = {}) => [
  [recipeRepository, {
    findRecipeById: async (id, companyId) => ({ id, companyId, versions: [] }),
    findLatestRecipeVersion: async () => null,
    createRecipeVersion: async () => makeMinimalDraftVersion(),
    ...extraRepoStubs,
  }],
  [productRepository, {
    findProductsByIds: async (ids) => ids.map((id) => ({ id, name: `Producto-${id}`, unit: 'KG' })),
  }],
];

test('createRecipeVersion rejects PROCESSING stage referencing a product not in any prior RECOLLECTION stage (AC-005, BR-001)', async () => {
  await withModuleStubs(lineageStubs(), async () => {
    await assert.rejects(
      () => recipeService.createRecipeVersion(33n, {
        stages: [
          {
            name: 'Mezclado inicial',
            stageType: 'PROCESSING',
            processCode: 'MIXING',
            stageInputs: [{ productId: 20n, name: 'Agua', quantity: 5, unit: 'KG' }],
          },
        ],
      }, auth),
      (error) => {
        assert.equal(error?.statusCode, 400);
        assert.equal(error?.code, 'validation_error');
        assert.match(error?.message || '', /recolect/i);
        return true;
      },
    );
  });
});

test('createRecipeVersion rejects PROCESSING stage that over-consumes recollected quantity (AC-006, BR-005)', async () => {
  await withModuleStubs(lineageStubs(), async () => {
    await assert.rejects(
      () => recipeService.createRecipeVersion(33n, {
        stages: [
          {
            name: 'Recoleccion',
            stageType: 'RECOLLECTION',
            stageInputs: [{ productId: 20n, name: 'Agua', quantity: 10, unit: 'KG' }],
          },
          {
            name: 'Mezclado',
            stageType: 'PROCESSING',
            processCode: 'MIXING',
            stageInputs: [{ productId: 20n, name: 'Agua', quantity: 11, unit: 'KG' }],
          },
        ],
      }, auth),
      (error) => {
        assert.equal(error?.statusCode, 400);
        assert.equal(error?.code, 'validation_error');
        assert.match(error?.message || '', /excede|disponible|recolect/i);
        return true;
      },
    );
  });
});

test('createRecipeVersion rejects PROCESSING stage using product from a LATER recollection (AC-011, BR-002)', async () => {
  // PROCESSING first (index 0), RECOLLECTION after (index 1) → product not available
  await withModuleStubs(lineageStubs(), async () => {
    await assert.rejects(
      () => recipeService.createRecipeVersion(33n, {
        stages: [
          {
            name: 'Procesamiento inicial',
            stageType: 'PROCESSING',
            processCode: 'MIXING',
            stageInputs: [{ productId: 20n, name: 'Agua', quantity: 5, unit: 'KG' }],
          },
          {
            name: 'Recoleccion posterior',
            stageType: 'RECOLLECTION',
            stageInputs: [{ productId: 20n, name: 'Agua', quantity: 10, unit: 'KG' }],
          },
        ],
      }, auth),
      (error) => {
        assert.equal(error?.statusCode, 400);
        assert.equal(error?.code, 'validation_error');
        return true;
      },
    );
  });
});

test('createRecipeVersion allows PROCESSING stage with zero catalog-product inputs (AC-004, BR-010)', async () => {
  const result = await withModuleStubs(lineageStubs(), () =>
    recipeService.createRecipeVersion(33n, {
      stages: [
        {
          name: 'Esterilizacion inicial',
          stageType: 'PROCESSING',
          processCode: 'STERILIZATION',
          stageInputs: [],
        },
      ],
    }, auth),
  );
  assert.ok(result);
});

test('createRecipeVersion allows descriptive stageInputs without productId in PROCESSING without prior recollection (BR-009)', async () => {
  const result = await withModuleStubs(lineageStubs(), () =>
    recipeService.createRecipeVersion(33n, {
      stages: [
        {
          name: 'Limpieza',
          stageType: 'PROCESSING',
          processCode: 'STERILIZATION',
          stageInputs: [{ name: 'Nota operativa de limpieza', quantity: null }],
        },
      ],
    }, auth),
  );
  assert.ok(result);
});

test('createRecipeVersion allows under-allocation in DRAFT (AC-007, BR-007)', async () => {
  // 10 recollected, only 8 used — draft save must succeed
  const result = await withModuleStubs(lineageStubs(), () =>
    recipeService.createRecipeVersion(33n, {
      stages: [
        {
          name: 'Recoleccion',
          stageType: 'RECOLLECTION',
          stageInputs: [{ productId: 20n, name: 'Agua', quantity: 10, unit: 'KG' }],
        },
        {
          name: 'Mezclado',
          stageType: 'PROCESSING',
          processCode: 'MIXING',
          stageInputs: [{ productId: 20n, name: 'Agua', quantity: 8, unit: 'KG' }],
        },
      ],
    }, auth),
  );
  assert.ok(result);
});

test('createRecipeVersion aggregates multiple RECOLLECTION stages for the same product (AC-010)', async () => {
  // Two RECOLLECTION stages: 5 + 5 = 10 available; PROCESSING uses 9 → OK
  const result = await withModuleStubs(lineageStubs(), () =>
    recipeService.createRecipeVersion(33n, {
      stages: [
        {
          name: 'Recoleccion A',
          stageType: 'RECOLLECTION',
          stageInputs: [{ productId: 20n, name: 'Agua', quantity: 5, unit: 'KG' }],
        },
        {
          name: 'Recoleccion B',
          stageType: 'RECOLLECTION',
          stageInputs: [{ productId: 20n, name: 'Agua', quantity: 5, unit: 'KG' }],
        },
        {
          name: 'Mezclado',
          stageType: 'PROCESSING',
          processCode: 'MIXING',
          stageInputs: [{ productId: 20n, name: 'Agua', quantity: 9, unit: 'KG' }],
        },
      ],
    }, auth),
  );
  assert.ok(result);
});

test('createRecipeVersion allows the same recollected product split across multiple PROCESSING stages (BR-012)', async () => {
  // 10 recollected; processing1 uses 4, processing2 uses 6 → total 10 → OK
  const result = await withModuleStubs(lineageStubs(), () =>
    recipeService.createRecipeVersion(33n, {
      stages: [
        {
          name: 'Recoleccion',
          stageType: 'RECOLLECTION',
          stageInputs: [{ productId: 20n, name: 'Agua', quantity: 10, unit: 'KG' }],
        },
        {
          name: 'Mezclado parcial',
          stageType: 'PROCESSING',
          processCode: 'MIXING',
          stageInputs: [{ productId: 20n, name: 'Agua', quantity: 4, unit: 'KG' }],
        },
        {
          name: 'Dilución',
          stageType: 'PROCESSING',
          processCode: 'DILUTION',
          stageInputs: [{ productId: 20n, name: 'Agua', quantity: 6, unit: 'KG' }],
        },
      ],
    }, auth),
  );
  assert.ok(result);
});

test('approveRecipeVersion rejects under-allocated draft — recollected product not fully used (AC-008, BR-008)', async () => {
  // Version in DB: 10 recollected, 8 used → approval must be rejected
  const versionWithStages = makeMinimalDraftVersion({
    stages: [
      {
        id: 1n, stageOrder: 0, stageType: 'RECOLLECTION', name: 'Recoleccion',
        instructions: null, responsibleRoleCode: null,
        expectedParameters: [], parameterTolerances: [], requiredEvidence: [],
        qaMandatory: false, processCode: null, processLabel: null,
        stageInputs: [{ id: 1n, productId: 20n, name: 'Agua', quantity: 10, unit: 'KG', sortOrder: 0, notes: null }],
      },
      {
        id: 2n, stageOrder: 1, stageType: 'PROCESSING', name: 'Mezclado',
        processCode: 'MIXING', processLabel: null,
        instructions: null, responsibleRoleCode: null,
        expectedParameters: [], parameterTolerances: [], requiredEvidence: [],
        qaMandatory: false,
        stageInputs: [{ id: 2n, productId: 20n, name: 'Agua', quantity: 8, unit: 'KG', sortOrder: 0, notes: null }],
      },
    ],
  });

  await withModuleStubs([[recipeRepository, {
    findRecipeVersionById: async () => versionWithStages,
  }]], async () => {
    await assert.rejects(
      () => recipeService.approveRecipeVersion(91n, {}, auth),
      (error) => {
        assert.equal(error?.statusCode, 400);
        assert.equal(error?.code, 'validation_error');
        assert.match(error?.message || '', /asign|aloc|complet|sin asignar/i);
        return true;
      },
    );
  });
});

test('approveRecipeVersion succeeds when every recollected product is fully allocated (AC-009, BR-008)', async () => {
  // Version in DB: 10 recollected, exactly 10 used → approval must succeed
  const versionWithStages = makeMinimalDraftVersion({
    stages: [
      {
        id: 1n, stageOrder: 0, stageType: 'RECOLLECTION', name: 'Recoleccion',
        instructions: null, responsibleRoleCode: null,
        expectedParameters: [], parameterTolerances: [], requiredEvidence: [],
        qaMandatory: false, processCode: null, processLabel: null,
        stageInputs: [{ id: 1n, productId: 20n, name: 'Agua', quantity: 10, unit: 'KG', sortOrder: 0, notes: null }],
      },
      {
        id: 2n, stageOrder: 1, stageType: 'PROCESSING', name: 'Mezclado',
        processCode: 'MIXING', processLabel: null,
        instructions: null, responsibleRoleCode: null,
        expectedParameters: [], parameterTolerances: [], requiredEvidence: [],
        qaMandatory: false,
        stageInputs: [{ id: 2n, productId: 20n, name: 'Agua', quantity: 10, unit: 'KG', sortOrder: 0, notes: null }],
      },
    ],
  });

  const approvedVersion = { ...versionWithStages, status: 'APPROVED', approvedAt: new Date() };

  await withModuleStubs([[recipeRepository, {
    findRecipeVersionById: async () => versionWithStages,
    updateRecipeVersion: async () => approvedVersion,
  }]], async () => {
    const result = await recipeService.approveRecipeVersion(91n, {}, auth);
    assert.equal(result.status, 'APPROVED');
  });
});

test('updateRecipeVersion rejects PROCESSING stage referencing a product not in any prior RECOLLECTION stage (AC-005, updateRecipeVersion path)', async () => {
  // Ensures assertRecipeStageLineageAndAllocation is also called on the update path
  const existingDraft = makeMinimalDraftVersion();

  await withModuleStubs([
    [recipeRepository, {
      findRecipeVersionById: async () => existingDraft,
    }],
    [productRepository, {
      findProductsByIds: async (ids) => ids.map((id) => ({ id, name: `Producto-${id}`, unit: 'KG' })),
    }],
  ], async () => {
    await assert.rejects(
      () => recipeService.updateRecipeVersion(91n, {
        stages: [
          {
            name: 'Procesamiento sin recoleccion previa',
            stageType: 'PROCESSING',
            processCode: 'MIXING',
            stageInputs: [{ productId: 20n, name: 'Agua', quantity: 5, unit: 'KG' }],
          },
        ],
      }, auth),
      (error) => {
        assert.equal(error?.statusCode, 400);
        assert.equal(error?.code, 'validation_error');
        assert.match(error?.message || '', /recolect/i);
        return true;
      },
    );
  });
});

test('approveRecipeVersion rejects when PROCESSING stage references product not recollected (AC-005 on approval path)', async () => {
  // Version in DB: PROCESSING uses productId=20 but no RECOLLECTION stage
  const versionInvalid = makeMinimalDraftVersion({
    stages: [
      {
        id: 1n, stageOrder: 0, stageType: 'PROCESSING', name: 'Mezclado',
        processCode: 'MIXING', processLabel: null,
        instructions: null, responsibleRoleCode: null,
        expectedParameters: [], parameterTolerances: [], requiredEvidence: [],
        qaMandatory: false,
        stageInputs: [{ id: 1n, productId: 20n, name: 'Agua', quantity: 5, unit: 'KG', sortOrder: 0, notes: null }],
      },
    ],
  });

  await withModuleStubs([[recipeRepository, {
    findRecipeVersionById: async () => versionInvalid,
  }]], async () => {
    await assert.rejects(
      () => recipeService.approveRecipeVersion(91n, {}, auth),
      (error) => {
        assert.equal(error?.statusCode, 400);
        assert.equal(error?.code, 'validation_error');
        return true;
      },
    );
  });
});

test('serializeRecipeVersion defaults quantityBasis to PER_OUTPUT_KG for legacy records without the field (TASK-004)', () => {
  const version = {
    id: 91n, recipeId: 33n, companyId: 7n, versionNumber: 1,
    status: 'DRAFT',
    // No quantityBasis — simulates a record created before TASK-004
    effectiveFrom: null, effectiveTo: null,
    expectedYield: null, expectedWaste: null,
    yieldTolerancePercent: null, wasteTolerancePercent: null,
    instructions: null, notes: null,
    approvedAt: null, createdAt: new Date(), updatedAt: new Date(),
    createdByUser: null, approvedByUser: null, stages: [],
  };

  const serialized = recipeService.serializeRecipeVersion(version);

  assert.equal(serialized.quantityBasis, 'PER_OUTPUT_KG');
});
