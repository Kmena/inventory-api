'use strict';

/**
 * Receiver Fiscal Readiness Service — Wave 3
 *
 * Responsibilities:
 *   - resolveReceiverFiscalReadiness()  — pure function, no side-effects, no DB
 *   - loadOrderWithLegalEntities()      — minimal order query (fiscal context only)
 *   - resolveOrderReceiverFiscalData()  — loads DB state, calls pure resolver
 *   - buildFiscalReadinessPreviewDto()  — builds API §A response DTO
 *
 * Invariants:
 *   - ZERO live Hacienda calls (reads only persisted Wave 2 state)
 *   - ZERO mutations
 *   - ZERO Billing calls
 *   - RFR-TASK-802: eligibleActivities filtered to code.length === 6 (XSD constraint)
 */

const prisma = require('../lib/prisma');

// ─── OQ-010 RESOLVED: Hacienda active status contract ────────────────────────
//
// Confirmed by taxpayer.service.js normalization + taxpayer-normalization-activities.test.js:
//   Hacienda JSON field 'estado' is preserved as-is into haciendaStatus.
//   'A' (from estado: 'A') = Active  — eligible for new fiscal approvals.
//   'I' (from estado: 'I') = Inactive — NOT eligible for new fiscal approvals.
//   null  — status not returned by Hacienda — NOT eligible (conservative default).
//
// This constant is the SINGLE authoritative source for the active-status check.
// Exported so inventory.service.js can use the same value in the in-transaction
// re-validation (race-condition protection).
const HACIENDA_ACTIVE_STATUS = 'A';

// ─── Pure: receiver fiscal readiness resolver ─────────────────────────────────
// Design spec §4.2 — no DB, no I/O, deterministic given entity + activities.
// RFR-TASK-802: activity codes must be exactly 6 chars (XSD minLength=maxLength=6).
// Reference: FacturaElectronica.xsd v4.4 lines 38-49; NO numeric-only restriction.

/**
 * Determine readiness state from persisted entity + activity data.
 * Called with the ClientLegalEntity record and its ClientEconomicActivity[].
 * Safe to call with entity=null (returns IDENTITY_INCOMPLETE).
 *
 * @param {object|null} entity — ClientLegalEntity or null
 * @param {Array<object>} activities — ClientEconomicActivity[]
 * @returns {{ state: string, eligibleActivities: Array<object>, blockingReasons: Array<object> }}
 */
function resolveReceiverFiscalReadiness(entity, activities) {
  // Identity check first — null entity or missing required fields
  if (!isCompleteFiscalEntity(entity)) {
    return { state: 'IDENTITY_INCOMPLETE', eligibleActivities: [], blockingReasons: buildBlockingReasons('IDENTITY_INCOMPLETE', entity) };
  }

  const vs = entity.verificationStatus || 'UNVERIFIED';

  if (vs === 'UNVERIFIED') return { state: 'UNVERIFIED', eligibleActivities: [], blockingReasons: buildBlockingReasons('UNVERIFIED', entity) };
  if (vs === 'NOT_FOUND') return { state: 'NOT_FOUND', eligibleActivities: [], blockingReasons: buildBlockingReasons('NOT_FOUND', entity) };
  if (vs === 'INVALID') return { state: 'IDENTITY_INVALID', eligibleActivities: [], blockingReasons: buildBlockingReasons('IDENTITY_INVALID', entity) };
  if (vs === 'VERIFICATION_UNAVAILABLE') return { state: 'VERIFICATION_UNAVAILABLE', eligibleActivities: [], blockingReasons: buildBlockingReasons('VERIFICATION_UNAVAILABLE', entity) };

  // vs === 'VERIFIED' — filter to currently-returned, XSD-length-valid, ACTIVE activities
  // Predicates must match in priority order:
  //   1. isCurrentlyReturned === true    — returned by latest verification (sync semantics)
  //   2. code.length === 6               — RFR-TASK-802 XSD constraint (minLength=maxLength=6)
  //   3. haciendaStatus === 'A'          — OQ-010: only ACTIVE activities are eligible;
  //                                        'I' (inactive) and null are NOT eligible
  // The same predicate is applied at preview time and re-applied inside the approval
  // prisma.$transaction (see inventory.service.js) for race-condition protection.
  const eligible = (activities || [])
    .filter((a) => a.isCurrentlyReturned === true)
    .filter((a) => typeof a.code === 'string' && a.code.length === 6)
    .filter((a) => a.haciendaStatus === HACIENDA_ACTIVE_STATUS);

  if (eligible.length === 0) {
    return { state: 'ACTIVITIES_MISSING', eligibleActivities: [], blockingReasons: buildBlockingReasons('ACTIVITIES_MISSING', entity) };
  }

  return { state: 'READY', eligibleActivities: eligible, blockingReasons: [] };
}

const FISCAL_IDENTITY_FIELD_LABELS = Object.freeze({
  legalName: 'Razón social',
  identificationType: 'Tipo de identificación',
  identificationNumber: 'Identificación',
  email: 'Correo electrónico para facturas',
});

function getFiscalIdentityMissingFields(entity) {
  if (!entity) {
    return Object.keys(FISCAL_IDENTITY_FIELD_LABELS);
  }
  return Object.keys(FISCAL_IDENTITY_FIELD_LABELS)
    .filter((fieldName) => !hasText(entity[fieldName]));
}

function buildBlockingReasons(state, entity) {
  if (state === 'IDENTITY_INCOMPLETE') {
    return getFiscalIdentityMissingFields(entity).map((fieldName) => ({
      code: `MISSING_${fieldName.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`,
      field: fieldName,
      label: FISCAL_IDENTITY_FIELD_LABELS[fieldName] || fieldName,
      message: `Falta ${FISCAL_IDENTITY_FIELD_LABELS[fieldName] || fieldName}.`,
    }));
  }

  if (state === 'UNVERIFIED') {
    return [{ code: 'RECEIVER_NOT_VERIFIED', message: 'Verifica la identificación del cliente con Hacienda.' }];
  }
  if (state === 'NOT_FOUND') {
    return [{ code: 'RECEIVER_NOT_FOUND', message: 'La identificación no existe en Hacienda; corrígela en el cliente.' }];
  }
  if (state === 'IDENTITY_INVALID') {
    return [{ code: 'RECEIVER_IDENTITY_INVALID', message: 'La identificación del cliente es inválida; corrígela en el cliente.' }];
  }
  if (state === 'VERIFICATION_UNAVAILABLE') {
    return [{ code: 'RECEIVER_VERIFICATION_UNAVAILABLE', message: 'Hacienda no devolvió verificación utilizable; intenta verificar el cliente de nuevo.' }];
  }
  if (state === 'ACTIVITIES_MISSING') {
    return [{ code: 'RECEIVER_ACTIVITIES_MISSING', message: 'El cliente no tiene actividades económicas activas verificadas.' }];
  }

  return [];
}

/**
 * A ClientLegalEntity is complete for fiscal operations when it has:
 * legalName, identificationType, identificationNumber and billing email.
 */
function isCompleteFiscalEntity(entity) {
  return getFiscalIdentityMissingFields(entity).length === 0;
}

function hasText(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

/**
 * Load order with only the fields needed for fiscal receiver resolution.
 * Minimal query — does NOT include items/warehouse/subregion.
 */
function loadOrderWithLegalEntities(orderId, companyId, db = prisma) {
  return db.order.findFirst({
    where: { id: orderId, companyId },
    include: {
      client: { include: { legalEntity: true } },
      clientStore: { include: { legalEntity: true } },
    },
  });
}

/**
 * Load ClientLegalEntity by ID scoped to the authenticated company.
 */
function loadClientLegalEntity(entityId, companyId, db = prisma) {
  return db.clientLegalEntity.findFirst({
    where: { id: entityId, companyId },
  });
}

/**
 * Load all ClientEconomicActivity records for a given entity.
 * Returns only currently-returned ones for efficiency; caller filters further.
 */
function loadClientEconomicActivities(clientLegalEntityId, companyId, db = prisma) {
  return db.clientEconomicActivity.findMany({
    where: { clientLegalEntityId, companyId },
    orderBy: [{ isCurrentlyReturned: 'desc' }, { code: 'asc' }],
  });
}

// ─── Orchestrator: resolve order receiver fiscal data ─────────────────────────

/**
 * Select the persisted legal entity used for approval-time receiver readiness.
 * Store-specific legal entity wins; inherited store config naturally falls back to
 * the client legal entity when store.legalEntity is null, or uses the same entity
 * when the store points at the client's legalEntityId.
 *
 * @param {object} order
 * @returns {{ sourceType: string, entity: object } | null}
 */
function selectOrderReceiverLegalEntity(order) {
  if (order?.clientStore?.legalEntity) {
    return { sourceType: 'CLIENT_STORE_LEGAL_ENTITY', entity: order.clientStore.legalEntity };
  }
  if (order?.client?.legalEntity) {
    return { sourceType: 'CLIENT_LEGAL_ENTITY', entity: order.client.legalEntity };
  }
  return null;
}

/**
 * Given an order (loaded with client.legalEntity + clientStore.legalEntity),
 * resolve receiver fiscal readiness from persisted state.
 *
 * Returns:
 *   { state, entity, eligibleActivities, allActivities }
 *
 * Does NOT call Hacienda. Does NOT mutate. Does NOT create OrderFiscalApproval.
 *
 * When no ClientLegalEntity is available: returns IDENTITY_INCOMPLETE — per spec,
 * only ClientLegalEntity can participate in the new fiscal verification flow.
 *
 * Approval readiness intentionally does NOT call resolveFiscalReceiver(): that
 * dispatch-time resolver requires email, while approval readiness only requires
 * persisted legal identity + verification + eligible activities.
 *
 * @param {object} order — order with client.legalEntity + clientStore.legalEntity
 * @param {bigint} companyId
 * @param {object} [db]
 * @returns {Promise<{ state: string, entity: object|null, eligibleActivities: Array<object>, allActivities: Array<object>, blockingReasons: Array<object> }> }
 */
async function resolveOrderReceiverFiscalData(order, companyId, db = prisma) {
  const selected = selectOrderReceiverLegalEntity(order);
  if (!selected) {
    return { state: 'IDENTITY_INCOMPLETE', entity: null, eligibleActivities: [], allActivities: [], blockingReasons: buildBlockingReasons('IDENTITY_INCOMPLETE', null) };
  }

  const entityId = BigInt(selected.entity.id);

  // Load entity + activities from persisted Wave 2 state
  const [entity, activities] = await Promise.all([
    loadClientLegalEntity(entityId, companyId, db),
    loadClientEconomicActivities(entityId, companyId, db),
  ]);

  // entity should always exist (sourceId comes from order's relation), but guard anyway
  const readiness = resolveReceiverFiscalReadiness(entity, activities);

  return {
    state: readiness.state,
    entity: entity || null,
    eligibleActivities: readiness.eligibleActivities,
    allActivities: activities,
    blockingReasons: readiness.blockingReasons || [],
  };
}

// ─── DTO builder (API §A contract) ───────────────────────────────────────────

/**
 * Build the GET /api/orders/:id/fiscal-readiness-preview response.
 *
 * @param {bigint} orderId
 * @param {object} resolvedData — from resolveOrderReceiverFiscalData()
 * @returns {object}
 */
function buildFiscalReadinessPreviewDto(orderId, resolvedData) {
  const { state, entity, eligibleActivities, blockingReasons = [] } = resolvedData;

  const receiver = entity ? {
    legalName: entity.legalName || null,
    identificationType: entity.identificationType || null,
    identificationNumber: entity.identificationNumber || null,
    verificationStatus: entity.verificationStatus || 'UNVERIFIED',
    lastVerifiedAt: entity.lastVerifiedAt || null,
  } : null;

  const activities = eligibleActivities.map((a) => ({
    code: a.code,
    description: a.description || null,
    haciendaStatus: a.haciendaStatus || null,
    haciendaType: a.haciendaType || null,
  }));

  return {
    orderId: orderId.toString(),
    fiscalBillingEnabled: true,
    receiverState: state,
    receiver,
    eligibleActivities: activities,
    blockingReasons,
    // autoSelectedCode: set when exactly 1 eligible activity exists (RFR-ACT-004)
    autoSelectedCode: eligibleActivities.length === 1 ? eligibleActivities[0].code : null,
  };
}

/** Billing-disabled preview DTO — fast-path when billing is off. */
function buildBillingDisabledPreviewDto(orderId) {
  return {
    orderId: orderId.toString(),
    fiscalBillingEnabled: false,
    receiverState: null,
    receiver: null,
    eligibleActivities: [],
    blockingReasons: [],
    autoSelectedCode: null,
  };
}

module.exports = {
  // OQ-010 canonical active-status constant (used by inventory.service.js in-tx re-validation)
  HACIENDA_ACTIVE_STATUS,
  // Pure (exported for testing)
  resolveReceiverFiscalReadiness,
  isCompleteFiscalEntity,
  getFiscalIdentityMissingFields,
  buildBlockingReasons,
  selectOrderReceiverLegalEntity,
  // DB helpers (exported for testing via injection)
  loadOrderWithLegalEntities,
  loadClientLegalEntity,
  loadClientEconomicActivities,
  // Orchestrators
  resolveOrderReceiverFiscalData,
  // DTO builders
  buildFiscalReadinessPreviewDto,
  buildBillingDisabledPreviewDto,
};
