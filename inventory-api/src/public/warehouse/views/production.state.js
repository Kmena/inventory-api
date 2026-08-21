/**
 * Warehouse SPA — Production pure state helpers.
 *
 * All functions are pure: no DOM, no API calls, no side effects.
 * Depends only on WarehouseShell.register().
 */
(() => {
const WarehouseShell = /** @type {any} */ (window).WarehouseShell;

/**
 * Retorna true si la etapa no requiere QA o si ya tiene una inspeccion aprobada.
 * @param {any} snapshotStage
 * @param {any} execution
 */
function qaIsCleared(snapshotStage, execution) {
  if (!snapshotStage?.qaMandatory) { return true; }
  if (!execution) { return false; }
  const inspections = Array.isArray(execution.qualityInspections) ? execution.qualityInspections : [];
  return inspections.some((i) => i.result === 'APPROVED' || i.result === 'CONDITIONALLY_ACCEPTED');
}

/**
 * Derives the display status for a snapshot stage given the current order.
 * @param {any} order
 * @param {any} snapshotStage  - stage object from recipeVersionSnapshot
 * @returns {'COMPLETED'|'WAITING_QA'|'IN_PROGRESS'|'BLOCKED'|'PENDING'}
 */
function deriveStageStatus(order, snapshotStage) {
  const executions = Array.isArray(order?.stageExecutions) ? order.stageExecutions : [];
  const stageId = String(snapshotStage?.id ?? '');

  const finished = executions.find(
    (ex) => String(ex.recipeStageId) === stageId && ex.endedAt,
  );
  if (finished) {
    // Si requiere QA y aun no hay inspeccion aprobada -> WAITING_QA
    if (!qaIsCleared(snapshotStage, finished)) { return 'WAITING_QA'; }
    return 'COMPLETED';
  }

  const active = executions.find(
    (ex) => String(ex.recipeStageId) === stageId && !ex.endedAt,
  );
  if (active) { return 'IN_PROGRESS'; }

  // Check if all prior stages are completed (incluyendo su gate QA)
  const snapshotStages = Array.isArray(order?.recipeVersionSnapshot?.recipeVersion?.stages)
    ? [...order.recipeVersionSnapshot.recipeVersion.stages].sort(
        (a, b) => Number(a.stageOrder ?? 0) - Number(b.stageOrder ?? 0),
      )
    : [];

  const currentOrder = Number(snapshotStage?.stageOrder ?? 0);
  for (const prior of snapshotStages) {
    if (Number(prior.stageOrder ?? 0) >= currentOrder) { break; }
    const priorExec = executions.find(
      (ex) => String(ex.recipeStageId) === String(prior.id) && ex.endedAt,
    );
    // Bloqueado si etapa previa no tiene ejecucion
    if (!priorExec) { return 'BLOCKED'; }
    // Bloqueado si etapa previa con qaMandatory aun no tiene QA aprobado
    if (!qaIsCleared(prior, priorExec)) { return 'BLOCKED'; }
  }

  return 'PENDING';
}

/**
 * Returns the first executable snapshot stage (PENDING, all priors complete).
 * @param {any} order
 * @returns {any|null}
 */
function resolveNextExecutableStage(order) {
  const snapshotStages = Array.isArray(order?.recipeVersionSnapshot?.recipeVersion?.stages)
    ? [...order.recipeVersionSnapshot.recipeVersion.stages].sort(
        (a, b) => Number(a.stageOrder ?? 0) - Number(b.stageOrder ?? 0),
      )
    : [];

  for (const stage of snapshotStages) {
    const status = deriveStageStatus(order, stage);
    if (status === 'PENDING') { return stage; }
    if (status === 'BLOCKED') { return null; }
  }
  return null;
}

/**
 * Builds a view-model array for rendering the stage list.
 * @param {any} order
 * @param {any[]} [requirements]
 * @returns {Array<{stage:any, status:string, execution:any|null}>}
 */
function buildStagesViewModel(order, requirements) {
  const snapshotStages = Array.isArray(order?.recipeVersionSnapshot?.recipeVersion?.stages)
    ? [...order.recipeVersionSnapshot.recipeVersion.stages].sort(
        (a, b) => Number(a.stageOrder ?? 0) - Number(b.stageOrder ?? 0),
      )
    : [];

  return snapshotStages.map((stage) => {
    const stageId = String(stage?.id ?? '');
    const status = deriveStageStatus(order, stage);
    const execution = (order?.stageExecutions || []).find(
      (ex) => String(ex.recipeStageId) === stageId && ex.endedAt,
    ) || null;

    const stageRequirements = (requirements || []).filter(
      (r) => String(r.stageId ?? r.recipeStageId ?? '') === stageId,
    );

    return { stage, status, execution, stageRequirements };
  });
}

/**
 * Builds a lot-picker model from the available-lots API response.
 * @param {any} availableLotsResponse
 * @param {Record<string,number>} requiredByProduct - { [productId]: quantity }
 * @returns {Array<{productId:string, productName:string, unit:string, requiredQuantity:number, lots:any[], suggested:any[]}>}
 */
function buildLotPickerModel(availableLotsResponse, requiredByProduct) {
  const products = Array.isArray(availableLotsResponse?.products)
    ? availableLotsResponse.products
    : [];

  return products.map((p) => ({
    productId: String(p.productId ?? ''),
    productCode: String(p.productCode ?? ''),
    productName: String(p.productName ?? ''),
    unit: String(p.unit ?? ''),
    requiredQuantity: Number(p.requiredQuantity ?? requiredByProduct[String(p.productId)] ?? 0),
    toleranceDefaultPercent: Number(p.toleranceDefaultPercent ?? 5),
    lots: Array.isArray(p.lots) ? p.lots : [],
    suggested: Array.isArray(p.suggested) ? p.suggested : [],
  }));
}

/**
 * Derives whether all snapshot stages are completed (for complete-order gate).
 * @param {any} order
 * @returns {boolean}
 */
function allSnapshotStagesCompleted(order) {
  const snapshotStages = Array.isArray(order?.recipeVersionSnapshot?.recipeVersion?.stages)
    ? order.recipeVersionSnapshot.recipeVersion.stages
    : [];
  if (!snapshotStages.length) { return false; }
  // WAITING_QA no cuenta como completado; el inspector debe aprobar primero.
  return snapshotStages.every((stage) => deriveStageStatus(order, stage) === 'COMPLETED');
}

WarehouseShell.register('views.productionState', {
  allSnapshotStagesCompleted,
  buildLotPickerModel,
  buildStagesViewModel,
  deriveStageStatus,
  resolveNextExecutableStage,
  qaIsCleared,
});
})();
