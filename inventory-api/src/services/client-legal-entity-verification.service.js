'use strict';

/**
 * Receiver fiscal identity verification service.
 *
 * Spec: specs/inventori-receiver-fiscal-readiness/ Wave 2
 * Tasks: RFR-TASK-202
 *
 * Responsibilities:
 *   - Local identification validation (no Hacienda call on INVALID)
 *   - Taxpayer lookup via taxpayer.service.js (→ Hacienda /fe/ae)
 *   - Activity synchronization into ClientEconomicActivity
 *   - Persisting verification result on ClientLegalEntity
 *   - Tenant isolation: every operation is scoped to companyId
 *
 * Security invariant: companyId is NEVER taken from browser input.
 * It is always derived from the authenticated session (req.auth.companyId)
 * and validated against the entity's stored companyId.
 *
 * OQ-008 resolved: permission for verify endpoint = clients.edit (Option A)
 * OQ-001 resolved: identification types 01/02/03/04 with local length policy
 */

const { createHttpError } = require('../lib/errors');

// ─── Identification type normalization ───────────────────────────────────────
//
// OQ-001: Costa Rica identification types.
// Both canonical codes (01-04) and common string aliases are accepted since
// existing Inventori clients store documentType as freeform strings.
// The resolved canonical code is used for length validation only — the raw
// type stored on the entity is NOT modified by verification.
const TYPE_ALIASES = {
  '01': '01', fisica: '01', cedula: '01', cedula_fisica: '01',
  '02': '02', juridica: '02', cedula_juridica: '02',
  '03': '03', dimex: '03',
  '04': '04', nite: '04',
};

// Expected digit counts per canonical type code
const TYPE_DIGIT_LENGTHS = {
  '01': [9],        // Física: exactly 9
  '02': [10],       // Jurídica: exactly 10
  '03': [11, 12],   // DIMEX: 11 or 12
  '04': [10],       // NITE: exactly 10
};

/**
 * Normalizes a raw identificationType string to a canonical code ('01'–'04').
 * Returns null if the type is unrecognized.
 * @param {string|null|undefined} rawType
 * @returns {'01'|'02'|'03'|'04'|null}
 */
function normalizeIdentificationTypeCode(rawType) {
  const normalized = String(rawType || '').trim().toLowerCase().replace(/[\s-]/g, '_');
  return TYPE_ALIASES[normalized] || null;
}

/**
 * Validates an identification number against the local length policy for its type.
 * Does NOT call Hacienda. Does NOT validate check digits.
 *
 * @param {string|null|undefined} identificationType
 * @param {string|null|undefined} identificationNumber
 * @returns {{ ok: boolean, digits?: string, reason?: string }}
 */
function validateReceiverIdentification(identificationType, identificationNumber) {
  const typeCode = normalizeIdentificationTypeCode(identificationType);
  if (!typeCode) {
    return { ok: false, reason: 'UNKNOWN_TYPE' };
  }

  const digits = String(identificationNumber || '').replace(/\D/g, '');
  if (!digits) {
    return { ok: false, reason: 'NON_NUMERIC' };
  }

  const allowedLengths = TYPE_DIGIT_LENGTHS[typeCode];
  if (!allowedLengths.includes(digits.length)) {
    return { ok: false, reason: 'WRONG_LENGTH' };
  }

  return { ok: true, digits };
}

// ─── Activity DTO builder ─────────────────────────────────────────────────────

function buildActivityDto(activity) {
  return {
    id: activity.id.toString(),
    code: activity.code,
    description: activity.description || null,
    haciendaStatus: activity.haciendaStatus || null,
    haciendaType: activity.haciendaType || null,
    isCurrentlyReturned: activity.isCurrentlyReturned,
    verifiedAt: activity.verifiedAt,
  };
}

function buildEntityDto(entity, activities) {
  return {
    id: entity.id.toString(),
    verificationStatus: entity.verificationStatus,
    lastVerifiedAt: entity.lastVerifiedAt || null,
    taxpayerName: entity.taxpayerName || null,
    activities: (activities || []).map(buildActivityDto),
  };
}

// ─── Service factory ──────────────────────────────────────────────────────────
//
// Factory pattern: allows test injection of mock prisma/taxpayerService.
// Production code uses the default instance exported at the bottom.

function createVerificationService(deps) {
  const _injectedPrisma = deps && deps.prisma ? deps.prisma : null;
  const _injectedTaxpayer = deps && deps.taxpayerService ? deps.taxpayerService : null;
  // Lazy-load defaults to avoid circular-require issues at module load time
  const getPrisma = () => _injectedPrisma || require('../lib/prisma');
  const getTaxpayerService = () => _injectedTaxpayer || require('./taxpayer.service');

  /**
   * Verifies the fiscal identity of a ClientLegalEntity against Hacienda.
   *
   * Flow:
   *   1. Load entity (validates companyId tenant scope)
   *   2. Assert identification fields present → 400 IDENTITY_INCOMPLETE
   *   3. Local validation → if fails: persist INVALID, return result (no Hacienda call)
   *   4. Call Hacienda via taxpayerService
   *   5. On success: atomic sync of activities + entity update
   *   6. On 404 from Hacienda: persist NOT_FOUND, mark activities not-returned
   *   7. On network/502: persist VERIFICATION_UNAVAILABLE, preserve activities
   *
   * @param {bigint} clientLegalEntityId
   * @param {bigint} companyId - from authenticated session (never from request body)
   * @returns {Promise<{ status: string, entity: object, activities: object[] }>}
   */
  async function verifyClientLegalEntityFiscalIdentity(clientLegalEntityId, companyId) {
    const prisma = getPrisma();
    const taxpayerSvc = getTaxpayerService();

    // ── 1. Load + tenant-scope entity ────────────────────────────────────────
    const entity = await prisma.clientLegalEntity.findFirst({
      where: { id: clientLegalEntityId, companyId },
    });

    if (!entity) {
      throw createHttpError(404, 'Entidad fiscal no encontrada', 'not_found');
    }

    // ── 2. Assert identification fields present ───────────────────────────────
    const hasType = entity.identificationType && String(entity.identificationType).trim();
    const hasNumber = entity.identificationNumber && String(entity.identificationNumber).trim();

    if (!hasType || !hasNumber) {
      throw createHttpError(
        400,
        'La entidad no tiene identificación fiscal completa para verificar',
        'IDENTITY_INCOMPLETE',
      );
    }

    // ── 3. Local validation ───────────────────────────────────────────────────
    const validation = validateReceiverIdentification(entity.identificationType, entity.identificationNumber);

    if (!validation.ok) {
      // Persist INVALID — do NOT call Hacienda
      const updatedEntity = await prisma.clientLegalEntity.update({
        where: { id: entity.id },
        data: { verificationStatus: 'INVALID' },
      });
      return { status: 'INVALID', entity: updatedEntity, activities: [] };
    }

    // ── 4. Call Hacienda ──────────────────────────────────────────────────────
    let taxpayerResult;
    try {
      taxpayerResult = await taxpayerSvc.lookupTaxpayer({
        identification: validation.digits,
        documentType: entity.identificationType,
      });
    } catch (err) {
      if (err?.code === 'not_found') {
        // ── 6. NOT_FOUND: mark activities + update entity ─────────────────────
        const { updatedEntity, finalActivities } = await prisma.$transaction(async (tx) => {
          await tx.clientEconomicActivity.updateMany({
            where: { clientLegalEntityId: entity.id },
            data: { isCurrentlyReturned: false },
          });

          const updated = await tx.clientLegalEntity.update({
            where: { id: entity.id },
            data: { verificationStatus: 'NOT_FOUND' },
          });

          const activities = await tx.clientEconomicActivity.findMany({
            where: { clientLegalEntityId: entity.id },
            orderBy: [{ isCurrentlyReturned: 'desc' }, { code: 'asc' }],
          });

          return { updatedEntity: updated, finalActivities: activities };
        });

        return { status: 'NOT_FOUND', entity: updatedEntity, activities: finalActivities };
      }

      // ── 7. VERIFICATION_UNAVAILABLE: preserve existing, update status ──────
      // CRITICAL: lastVerifiedAt MUST NOT be overwritten.
      // Existing activities remain unchanged — Hacienda was temporarily unreachable.
      const updatedEntity = await prisma.clientLegalEntity.update({
        where: { id: entity.id },
        data: { verificationStatus: 'VERIFICATION_UNAVAILABLE' },
        // NOTE: intentionally NO update to lastVerifiedAt or taxpayerName
      });

      const existingActivities = await prisma.clientEconomicActivity.findMany({
        where: { clientLegalEntityId: entity.id },
        orderBy: [{ isCurrentlyReturned: 'desc' }, { code: 'asc' }],
      });

      return { status: 'VERIFICATION_UNAVAILABLE', entity: updatedEntity, activities: existingActivities };
    }

    // ── 5. Success: atomic sync ───────────────────────────────────────────────
    const returnedActivities = taxpayerResult.activities || [];
    const returnedCodes = new Set(returnedActivities.map((a) => a.code));
    const verifiedAt = new Date();

    const { updatedEntity, finalActivities } = await prisma.$transaction(async (tx) => {
      // 5a. Upsert each returned activity
      for (const act of returnedActivities) {
        await tx.clientEconomicActivity.upsert({
          where: {
            client_economic_activities_entity_code_unique: {
              clientLegalEntityId: entity.id,
              code: act.code,
            },
          },
          create: {
            companyId: entity.companyId,
            clientLegalEntityId: entity.id,
            code: act.code,
            description: act.description || null,
            haciendaStatus: act.haciendaStatus || null,
            haciendaType: act.haciendaType || null,
            isCurrentlyReturned: true,
            verifiedAt,
          },
          update: {
            description: act.description || null,
            haciendaStatus: act.haciendaStatus || null,
            haciendaType: act.haciendaType || null,
            isCurrentlyReturned: true,
            verifiedAt,
          },
        });
      }

      // 5b. Mark previously known activities NOT returned this time
      if (returnedCodes.size > 0) {
        await tx.clientEconomicActivity.updateMany({
          where: {
            clientLegalEntityId: entity.id,
            code: { notIn: [...returnedCodes] },
          },
          data: { isCurrentlyReturned: false },
        });
      } else {
        // Zero activities returned — mark ALL as not currently returned
        await tx.clientEconomicActivity.updateMany({
          where: { clientLegalEntityId: entity.id },
          data: { isCurrentlyReturned: false },
        });
      }

      // 5c. Update entity
      const updated = await tx.clientLegalEntity.update({
        where: { id: entity.id },
        data: {
          verificationStatus: 'VERIFIED',
          lastVerifiedAt: verifiedAt,
          taxpayerName: taxpayerResult.name || null,
        },
      });

      // 5d. Fetch final activity state (consistent within transaction)
      const activities = await tx.clientEconomicActivity.findMany({
        where: { clientLegalEntityId: entity.id },
        orderBy: [{ isCurrentlyReturned: 'desc' }, { code: 'asc' }],
      });

      return { updatedEntity: updated, finalActivities: activities };
    });

    return { status: 'VERIFIED', entity: updatedEntity, activities: finalActivities };
  }

  /**
   * Lists persisted ClientEconomicActivity records for a ClientLegalEntity.
   * DOES NOT call Hacienda — pure DB read.
   * Scoped to authenticated company (tenant isolation).
   *
   * @param {bigint} clientLegalEntityId
   * @param {bigint} companyId - from authenticated session
   * @returns {Promise<{ clientLegalEntityId: string, verificationStatus: string, lastVerifiedAt: Date|null, activities: object[] }>}
   */
  async function listClientLegalEntityActivities(clientLegalEntityId, companyId) {
    const prisma = getPrisma();

    const entity = await prisma.clientLegalEntity.findFirst({
      where: { id: clientLegalEntityId, companyId },
    });

    if (!entity) {
      throw createHttpError(404, 'Entidad fiscal no encontrada', 'not_found');
    }

    const activities = await prisma.clientEconomicActivity.findMany({
      where: { clientLegalEntityId: entity.id },
      orderBy: [{ isCurrentlyReturned: 'desc' }, { code: 'asc' }],
    });

    return {
      clientLegalEntityId: entity.id.toString(),
      verificationStatus: entity.verificationStatus,
      lastVerifiedAt: entity.lastVerifiedAt || null,
      activities: activities.map(buildActivityDto),
    };
  }

  return {
    verifyClientLegalEntityFiscalIdentity,
    listClientLegalEntityActivities,
    // Exported for unit testing of pure validation logic
    _normalizeIdentificationTypeCode: normalizeIdentificationTypeCode,
    _validateReceiverIdentification: validateReceiverIdentification,
    _buildEntityDto: buildEntityDto,
  };
}

// ─── Default instance (production) ───────────────────────────────────────────
const defaultService = createVerificationService();

module.exports = {
  createVerificationService,
  verifyClientLegalEntityFiscalIdentity: defaultService.verifyClientLegalEntityFiscalIdentity,
  listClientLegalEntityActivities: defaultService.listClientLegalEntityActivities,
  // Pure functions (also exported from default for convenience)
  normalizeIdentificationTypeCode: defaultService._normalizeIdentificationTypeCode,
  validateReceiverIdentification: defaultService._validateReceiverIdentification,
};
