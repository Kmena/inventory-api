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
  // Una etapa qaMandatory siempre requiere una inspeccion formal aprobada,
  // sin importar si los parametros quedaron dentro de tolerancia.
  // Esto es consistente con el gate del backend (executionHasApprovedQa).
  const inspections = Array.isArray(execution.qualityInspections) ? execution.qualityInspections : [];
  return inspections.some((i) => i.result === 'APPROVED' || i.result === 'CONDITIONALLY_ACCEPTED');
}

/**
 * TASK-007: Returns the most recent finished execution for a stage
 * (ordered by createdAt DESC). Returns null if none.
 * @param {any} order
 * @param {any} snapshotStage
 */
function findLatestFinishedExecution(order, snapshotStage) {
  const executions = Array.isArray(order?.stageExecutions) ? order.stageExecutions : [];
  const stageId = String(snapshotStage?.id ?? '');
  const finished = executions
    .filter((ex) => String(ex.recipeStageId) === stageId && ex.endedAt)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return finished[0] || null;
}

/**
 * TASK-007: Returns the latest execution with status=QA_REJECTED for a stage.
 * Used by renderers to pre-populate the loss form with consumed items.
 * @param {any} order
 * @param {any} snapshotStage
 */
function findLatestRejectedExecution(order, snapshotStage) {
  const latest = findLatestFinishedExecution(order, snapshotStage);
  return (latest && latest.status === 'QA_REJECTED') ? latest : null;
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

  // TASK-007: use the LATEST finished execution (sort by createdAt DESC)
  // to correctly handle multiple executions after rejection+re-execution cycles.
  const finished = findLatestFinishedExecution(order, snapshotStage);
  if (finished) {
    // TASK-007: QA_REJECTED status — two sub-states based on lossesAcknowledged
    if (finished.status === 'QA_REJECTED') {
      if (!finished.lossesAcknowledged) { return 'QA_REJECTED_PENDING_LOSSES'; }
      // TASK-007 (qa-rejection-disposition): check for pending recolection (DEC-003)
      // TASK-006 (qa-rejection-material-reconciliation-amendment): distinguish REPLACEMENT_RECOVERY
      const pendingRecol = findPendingRecolectionForExecution(order, finished.id);
      if (pendingRecol) {
        if (pendingRecol.recoveryType === 'REPLACEMENT_RECOVERY') { return 'REPLACEMENT_RECOVERY_PENDING'; }
        return 'RECOLECTION_PENDING';
      }
      return 'QA_REJECTED_LOSSES_DONE';
    }
    // Si la etapa es qaMandatory y aun no hay inspeccion formal aprobada -> WAITING_QA
    if (!qaIsCleared(snapshotStage, finished)) { return 'WAITING_QA'; }
    return 'COMPLETED';
  }

  // Check for a non-finished (active) execution
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
    // TASK-007: BR-005 — gate uses COMPLETED execution only (not QA_REJECTED)
    const priorExec = findLatestFinishedExecution(order, prior);
    // Bloqueado si etapa previa no tiene ejecucion
    if (!priorExec) { return 'BLOCKED'; }
    // Bloqueado si la ejecucion mas reciente de la etapa previa no esta COMPLETED
    if (priorExec.status === 'QA_REJECTED') { return 'BLOCKED'; }
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
    // TASK-007: QA_REJECTED_LOSSES_DONE is also executable (re-execution)
    if (status === 'QA_REJECTED_LOSSES_DONE') { return stage; }
    // RECOLECTION_PENDING and REPLACEMENT_RECOVERY_PENDING block execution until operator confirms
    if (
      status === 'BLOCKED' ||
      status === 'QA_REJECTED_PENDING_LOSSES' ||
      status === 'WAITING_QA' ||
      status === 'RECOLECTION_PENDING' ||
      status === 'REPLACEMENT_RECOVERY_PENDING'
    ) { return null; }
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
    const status = deriveStageStatus(order, stage);
    // TASK-007: use findLatestFinishedExecution instead of find() to handle multi-execution
    const execution = findLatestFinishedExecution(order, stage);
    const stageId = String(stage?.id ?? ''); // was missing — caused ReferenceError → blank page

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
 * TASK-007 (qa-rejection-disposition): Returns the pending recolection stage for a
 * given rejected execution id, or null if none / already completed.
 * @param {any} order
 * @param {any} rejectedExecutionId
 * @returns {any|null}
 */
function findPendingRecolectionForExecution(order, rejectedExecutionId) {
  const stages = Array.isArray(order?.recolectionStages) ? order.recolectionStages : [];
  const found = stages.find(
    (r) => String(r.rejectedExecutionId) === String(rejectedExecutionId) && r.status === 'PENDING',
  );
  return found || null;
}

/**
 * TASK-007 (qa-rejection-disposition): Returns the recolection stage for a given
 * rejected execution (any status), or null if none.
 * @param {any} order
 * @param {any} rejectedExecutionId
 * @returns {any|null}
 */
function findRecolectionForExecution(order, rejectedExecutionId) {
  const stages = Array.isArray(order?.recolectionStages) ? order.recolectionStages : [];
  return stages.find(
    (r) => String(r.rejectedExecutionId) === String(rejectedExecutionId),
  ) || null;
}

/**
 * Builds the virtual recolection stage view-model entry to be inserted in the
 * stages list between the rejected stage and the continuation point.
 * Returns null when there is no recolection stage linked to this execution.
 * @param {any} order
 * @param {any} rejectedExecution
 * @returns {{stage:any, status:string, execution:null, stageRequirements:[], recolection:any}|null}
 */
function buildRecolectionStageViewModel(order, rejectedExecution) {
  if (!rejectedExecution) { return null; }
  const recolection = findRecolectionForExecution(order, rejectedExecution.id);
  if (!recolection) { return null; }
  const isReplacement = recolection.recoveryType === 'REPLACEMENT_RECOVERY';
  const stageName = isReplacement ? 'Reposición de materiales' : 'Recolección de material';
  const doneStatus = isReplacement ? 'REPLACEMENT_RECOVERY_DONE' : 'RECOLECTION_DONE';
  const pendingStatus = isReplacement ? 'REPLACEMENT_RECOVERY_PENDING' : 'RECOLECTION_PENDING';
  return {
    stage: {
      id: `recolection-${String(rejectedExecution.id)}`,
      name: stageName,
      isVirtual: true,
      recipeStageId: rejectedExecution.recipeStageId,
      rejectedExecutionId: rejectedExecution.id,
    },
    status: recolection.status === 'COMPLETED' ? doneStatus : pendingStatus,
    execution: null,
    stageRequirements: [],
    recolection,
  };
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
  // WAITING_QA, QA_REJECTED and RECOLECTION_PENDING do not count as completed.
  return snapshotStages.every((stage) => deriveStageStatus(order, stage) === 'COMPLETED');
}

WarehouseShell.register('views.productionState', {
  allSnapshotStagesCompleted,
  buildLotPickerModel,
  buildStagesViewModel,
  deriveStageStatus,
  resolveNextExecutableStage,
  qaIsCleared,
  // TASK-007: rejection helpers
  findLatestFinishedExecution,
  findLatestRejectedExecution,
  // TASK-007 (qa-rejection-disposition): recolection helpers
  findPendingRecolectionForExecution,
  findRecolectionForExecution,
  buildRecolectionStageViewModel,
});
})();
