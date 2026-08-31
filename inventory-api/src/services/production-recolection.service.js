/**
 * production-recolection.service.js
 *
 * Feature: qa-rejection-disposition-and-continuation (original TASK-006)
 * Feature: qa-rejection-material-reconciliation-amendment (TASK-004, TASK-006)
 *
 * Handles recolection and replacement-recovery stages created when QA rejects
 * a stage execution with RECOLLECT dispositions or requires material replacement.
 *
 * AC-011: confirmation sets status=COMPLETED, records completedByUserId, completedAt.
 * TASK-004: createReplacementRecoveryStage — posterior dynamic replacement stage.
 * TASK-006: recordReconciliationOutcomes + computeReconciliationBalance.
 */
'use strict';

const { createHttpError } = require('../lib/errors');
const productionRepository = require('../repositories/production.repository');

// Terminal reconciliation outcomes (FR-012)
const RECONCILIATION_OUTCOMES = ['USED', 'RETURNED', 'DISCARDED'];

// ─────────────────────────────────────────────────────────────────────────────
// Auth helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Asserts the current user belongs to a company.
 * @param {object} auth
 * @returns {{companyId: bigint, userId: bigint}}
 */
function assertOperationalScope(auth) {
  if (!auth?.companyId || !auth?.sub) {
    throw createHttpError(403, 'Se requiere un usuario asociado a una empresa', 'forbidden');
  }

  return { companyId: BigInt(auth.companyId), userId: BigInt(auth.sub) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Serializers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Serializes a recolection stage for API responses.
 * @param {object} stage
 */
function serializeRecolectionStage(stage) {
  return {
    id: stage.id,
    productionOrderId: stage.productionOrderId,
    rejectedExecutionId: stage.rejectedExecutionId,
    recipeStageId: stage.recipeStageId,
    status: stage.status,
    recoveryType: stage.recoveryType ?? 'VIRTUAL_RECOLECTION',
    requiredItems: stage.requiredItems,
    entries: Array.isArray(stage.recolectionEntries)
      ? stage.recolectionEntries.map((entry) => ({
          id: entry.id,
          productId: entry.productId,
          lotId: entry.lotId,
          quantity: entry.quantity,
          unit: entry.unit ?? entry.product?.unit ?? null,
          product: entry.product ? { id: entry.product.id, name: entry.product.name, unit: entry.product.unit } : null,
          lot: entry.lot ? { id: entry.lot.id, internalLotNumber: entry.lot.internalLotNumber } : null,
          createdAt: entry.createdAt,
        }))
      : [],
    reconciliations: Array.isArray(stage.reconciliations)
      ? stage.reconciliations.map((record) => ({
          id: record.id,
          productId: record.productId,
          lotId: record.lotId,
          quantity: record.quantity,
          outcome: record.outcome,
          notes: record.notes ?? null,
          createdAt: record.createdAt,
        }))
      : [],
    completedByUserId: stage.completedByUserId ?? null,
    completedAt: stage.completedAt ?? null,
    notes: stage.notes ?? null,
    createdAt: stage.createdAt,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// confirmRecolection — legacy virtual recolection flow
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Confirms a recolection stage is complete, unblocking the re-execution gate.
 *
 * @param {bigint} orderId
 * @param {bigint} recolectionId
 * @param {{notes?: string|null}} payload
 * @param {object} auth
 */
/**
 * Confirms a recolection stage is complete, unblocking the re-execution gate.
 *
 * For REPLACEMENT_RECOVERY stages, optionally accepts lot-level entries declaring
 * exactly which material was gathered (AUD-001 fix — writes to production_recolection_entries).
 *
 * @param {bigint} orderId
 * @param {bigint} recolectionId
 * @param {{ notes?: string|null, entries?: Array<{productId:bigint, lotId:bigint, quantity:number, unit?:string|null}> }} payload
 * @param {object} auth
 */
async function confirmRecolection(orderId, recolectionId, payload, auth) {
  const scope = assertOperationalScope(auth);

  const order = await productionRepository.findProductionOrderById(orderId, scope.companyId);
  if (!order) {
    throw createHttpError(404, 'Orden de produccion no encontrada', 'not_found');
  }

  if (!['IN_PROGRESS', 'QA_HOLD'].includes(order.status)) {
    throw createHttpError(
      409,
      'La orden de produccion debe estar en progreso o en espera de QA para confirmar recolecciones',
      'conflict',
    );
  }

  const recolection = await productionRepository.findRecolectionStageById(recolectionId, scope.companyId);
  if (!recolection) {
    throw createHttpError(404, 'Etapa de recoleccion no encontrada', 'not_found');
  }

  if (String(recolection.productionOrderId) !== String(orderId)) {
    throw createHttpError(
      409,
      'La etapa de recoleccion no pertenece a esta orden de produccion',
      'conflict',
    );
  }

  if (recolection.status === 'COMPLETED') {
    throw createHttpError(
      409,
      'La etapa de recoleccion ya fue confirmada',
      'conflict',
    );
  }

  const completedAt = new Date();
  const notes = payload?.notes ? String(payload.notes).trim() || null : null;
  const lotEntries = Array.isArray(payload?.entries) ? payload.entries : [];

  const updated = await productionRepository.updateRecolectionStage(recolectionId, {
    status: 'COMPLETED',
    completedByUserId: scope.userId,
    completedAt,
    notes,
  });

  // AUD-001: persist lot-level entries when provided (REPLACEMENT_RECOVERY or VIRTUAL_RECOLECTION with lot info)
  if (lotEntries.length > 0) {
    await productionRepository.createRecolectionEntries(recolectionId, lotEntries);
  }

  return {
    id: updated.id,
    productionOrderId: updated.productionOrderId,
    rejectedExecutionId: updated.rejectedExecutionId,
    recipeStageId: updated.recipeStageId,
    status: updated.status,
    recoveryType: updated.recoveryType ?? 'VIRTUAL_RECOLECTION',
    requiredItems: updated.requiredItems,
    completedByUserId: updated.completedByUserId,
    completedAt: updated.completedAt,
    notes: updated.notes,
    createdAt: updated.createdAt,
    entriesRecorded: lotEntries.length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TASK-004: createReplacementRecoveryStage
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a posterior REPLACEMENT_RECOVERY stage after QA rejection.
 *
 * Created when the QA inspector determines that inputs were damaged or are
 * missing and must be replaced before re-execution can proceed.
 *
 * TASK-004 (qa-rejection-material-reconciliation-amendment)
 *
 * @param {object} tx - Prisma transaction client
 * @param {object} order - ProductionOrder
 * @param {bigint} rejectedExecutionId
 * @param {bigint} recipeStageId
 * @param {Array<{productId?:string|null, quantity:number, unit?:string|null, notes?:string|null}>} requiredItems
 * @returns {Promise<object>}
 */
async function createReplacementRecoveryStage(tx, order, rejectedExecutionId, recipeStageId, requiredItems) {
  const existing = await productionRepository.findRecolectionStageByExecutionId(rejectedExecutionId, tx);
  if (existing) {
    // Idempotency: if already exists, return it
    return existing;
  }

  return productionRepository.createRecolectionStage({
    companyId: order.companyId,
    productionOrderId: order.id,
    rejectedExecutionId,
    recipeStageId,
    status: 'PENDING',
    recoveryType: 'REPLACEMENT_RECOVERY',
    requiredItems: requiredItems || [],
  }, tx);
}

// ─────────────────────────────────────────────────────────────────────────────
// TASK-006: computeReconciliationBalance + recordReconciliationOutcomes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes recolected-vs-reconciled balance per (productId:lotId).
 *
 * TASK-006 (qa-rejection-material-reconciliation-amendment).
 *
 * @param {Array<{productId:any, lotId:any, quantity:any}>} recolectionEntries
 * @param {Array<{productId:any, lotId:any, quantity:any, outcome:string}>} reconciliationRecords
 * @returns {{ complete: boolean, remainingBalances: Array<{productId:string, lotId:string, remaining:number}> }}
 */
function computeReconciliationBalance(recolectionEntries, reconciliationRecords) {
  const recolectedMap = new Map();
  for (const entry of recolectionEntries || []) {
    const key = `${entry.productId}:${entry.lotId}`;
    recolectedMap.set(key, (recolectedMap.get(key) || 0) + Number(entry.quantity));
  }

  const reconciledMap = new Map();
  for (const record of reconciliationRecords || []) {
    const key = `${record.productId}:${record.lotId}`;
    reconciledMap.set(key, (reconciledMap.get(key) || 0) + Number(record.quantity));
  }

  const remainingBalances = [];
  for (const [key, recolected] of recolectedMap.entries()) {
    const reconciled = reconciledMap.get(key) || 0;
    const remaining = recolected - reconciled;
    if (remaining > 0.0001) {
      const [productId, lotId] = key.split(':');
      remainingBalances.push({ productId, lotId, remaining: Math.round(remaining * 1000) / 1000 });
    }
  }

  return { complete: remainingBalances.length === 0, remainingBalances };
}

/**
 * Records reconciliation outcomes for a recolection stage.
 * Validates outcome values and that outcomes don't exceed recolected quantities.
 *
 * TASK-006 (qa-rejection-material-reconciliation-amendment).
 *
 * @param {bigint} orderId
 * @param {bigint} recolectionId
 * @param {Array<{productId:bigint, lotId:bigint, quantity:number, outcome:string, notes?:string|null}>} outcomes
 * @param {object} auth
 */
async function recordReconciliationOutcomes(orderId, recolectionId, outcomes, auth) {
  const scope = assertOperationalScope(auth);

  const order = await productionRepository.findProductionOrderById(orderId, scope.companyId);
  if (!order) {
    throw createHttpError(404, 'Orden de produccion no encontrada', 'not_found');
  }

  const recolection = await productionRepository.findRecolectionStageById(recolectionId, scope.companyId);
  if (!recolection) {
    throw createHttpError(404, 'Etapa de recoleccion/recuperacion no encontrada', 'not_found');
  }

  if (String(recolection.productionOrderId) !== String(orderId)) {
    throw createHttpError(409, 'La etapa de recoleccion no pertenece a esta orden de produccion', 'conflict');
  }

  if (recolection.status === 'COMPLETED') {
    throw createHttpError(409, 'La etapa de recoleccion ya fue cerrada. No se pueden registrar mas conciliaciones.', 'conflict');
  }

  // Validate outcome values (FR-012)
  for (const outcome of outcomes || []) {
    if (!RECONCILIATION_OUTCOMES.includes(outcome.outcome)) {
      throw createHttpError(
        400,
        `Resultado de conciliacion invalido: "${outcome.outcome}". Valores aceptados: ${RECONCILIATION_OUTCOMES.join(', ')}`,
        'validation_error',
      );
    }
  }

  const [entries, existingReconciliations] = await Promise.all([
    productionRepository.findRecolectionEntriesByStageId(recolectionId),
    productionRepository.findRecolectionReconciliationsByStageId(recolectionId),
  ]);

  // Validate proposed outcomes don't exceed recolected quantities per lot (BR-006)
  for (const outcome of outcomes || []) {
    const key = `${outcome.productId}:${outcome.lotId}`;
    const entryTotal = entries
      .filter((e) => `${e.productId}:${e.lotId}` === key)
      .reduce((sum, e) => sum + Number(e.quantity), 0);

    const existingReconciled = existingReconciliations
      .filter((r) => `${r.productId}:${r.lotId}` === key)
      .reduce((sum, r) => sum + Number(r.quantity), 0);

    const proposedTotal = existingReconciled + Number(outcome.quantity);
    if (entryTotal > 0 && proposedTotal > entryTotal + 0.0001) {
      throw createHttpError(
        400,
        `La cantidad conciliada (${proposedTotal}) supera la recolectada (${entryTotal}) para el producto ${outcome.productId} lote ${outcome.lotId}.`,
        'validation_error',
      );
    }
  }

  await productionRepository.createRecolectionReconciliations(
    recolectionId,
    (outcomes || []).map((o) => ({
      productId: o.productId,
      lotId: o.lotId,
      quantity: o.quantity,
      outcome: o.outcome,
      notes: o.notes ?? null,
    })),
  );

  const updatedReconciliations = await productionRepository.findRecolectionReconciliationsByStageId(recolectionId);
  const finalBalance = computeReconciliationBalance(entries, updatedReconciliations);

  return {
    recolectionId: String(recolectionId),
    recordedCount: (outcomes || []).length,
    balance: finalBalance,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  confirmRecolection,
  createReplacementRecoveryStage,
  serializeRecolectionStage,
  computeReconciliationBalance,
  recordReconciliationOutcomes,
  RECONCILIATION_OUTCOMES,
};
