'use strict';

/**
 * Client Legal Entity fiscal routes.
 *
 * Spec: specs/inventori-receiver-fiscal-readiness/ Wave 2
 * Tasks: RFR-TASK-203, RFR-TASK-204
 *
 * Routes:
 *   POST /:id/verify     — trigger receiver fiscal verification (calls Hacienda)
 *   GET  /:id/activities — list persisted receiver economic activities (no Hacienda call)
 *
 * Security:
 *   - All routes require authentication via authenticate middleware
 *   - POST verify: requires clients.edit permission (OQ-008 resolved → Option A)
 *   - GET activities: requires clients.view or clients.view.all permission
 *   - Tenant isolation enforced in service layer (companyId from req.auth, never from body)
 *   - POST verify: rate-limited via taxpayerLookupThrottle (SEC-009)
 *   - No raw Hacienda responses exposed to client
 *   - No identification numbers in error messages
 */

const express = require('express');

const authenticate = require('../middlewares/authenticate');
const { authorizeAccessPolicy } = require('../security/access-policies');
const { parseBigIntId } = require('../lib/parse');
const {
  LOOKUP_THROTTLE_WINDOW_MS,
  TAXPAYER_THROTTLE_MAX_REQUESTS,
  createRequestThrottle,
} = require('../middlewares/request-throttle');
const audit = require('../lib/audit');
const {
  createVerificationService,
} = require('../services/client-legal-entity-verification.service');

const taxpayerLookupThrottle = createRequestThrottle({
  scope: 'client-legal-entity.verify',
  maxRequests: TAXPAYER_THROTTLE_MAX_REQUESTS,
  windowMs: LOOKUP_THROTTLE_WINDOW_MS,
  message: 'Demasiadas verificaciones fiscales en poco tiempo. Intente de nuevo más tarde.',
});

const verificationService = createVerificationService();

const router = express.Router();
router.use(authenticate);

// ─── POST /:id/verify ─────────────────────────────────────────────────────────
//
// Triggers a live Hacienda taxpayer lookup for the ClientLegalEntity and
// synchronizes all returned activities.
//
// Permission: clients.edit (OQ-008 resolved — Option A)
// Rate limit: taxpayerLookupThrottle (SEC-009)
// Hacienda contact: YES
// Billing contact: NO
//
// Response:
//   200 → VERIFIED or INVALID — full entity DTO with activities
//   404 → NOT_FOUND (hacienda_not_found) — Hacienda returned 404
//   502 → VERIFICATION_UNAVAILABLE — Hacienda temporarily unreachable
//   400 → IDENTITY_INCOMPLETE — entity has no identification to look up
//   404 → entity not found in company scope
//   429 → throttle limit hit
router.post(
  '/:id/verify',
  authorizeAccessPolicy('client-legal-entity.verify'),
  taxpayerLookupThrottle,
  async (req, res, next) => {
    try {
      const entityId = parseBigIntId(req.params.id);
      const companyId = BigInt(req.auth.companyId);

      const result = await verificationService.verifyClientLegalEntityFiscalIdentity(entityId, companyId);

      // Audit regardless of outcome (SEC-011) — no identification numbers in payload
      await audit.recordAuditEventSafelyIfAvailable({
        req,
        action: 'client_legal_entities.verify',
        resourceType: 'client_legal_entity',
        resourceId: entityId,
        outcome: result.status === 'VERIFIED' ? 'SUCCESS' : 'FAILURE',
        afterState: {
          verificationStatus: result.entity.verificationStatus,
          activityCount: result.activities.length,
        },
      });

      if (result.status === 'NOT_FOUND') {
        // Hacienda definitively returned 404 — state persisted as NOT_FOUND
        return res.status(404).json({
          error: 'hacienda_not_found',
          message: 'Hacienda no encontró datos para la identificación de este receptor.',
        });
      }

      if (result.status === 'VERIFICATION_UNAVAILABLE') {
        // Temporary Hacienda failure — existing data preserved (SEC-010 inverse)
        return res.status(502).json(buildVerifyDto(result.entity, result.activities));
      }

      // VERIFIED or INVALID — 200 with entity state
      return res.json(buildVerifyDto(result.entity, result.activities));
    } catch (error) {
      return next(error);
    }
  },
);

// ─── GET /:id/activities ──────────────────────────────────────────────────────
//
// Returns persisted ClientEconomicActivity records for a ClientLegalEntity.
// DOES NOT call Hacienda. Pure local read.
//
// Permission: clients.view (or clients.view.all)
// Hacienda contact: NO
// Billing contact: NO
router.get(
  '/:id/activities',
  authorizeAccessPolicy('client-legal-entity.activities'),
  async (req, res, next) => {
    try {
      const entityId = parseBigIntId(req.params.id);
      const companyId = BigInt(req.auth.companyId);
      const result = await verificationService.listClientLegalEntityActivities(entityId, companyId);
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  },
);

// ─── DTO builder ──────────────────────────────────────────────────────────────

function buildVerifyDto(entity, activities) {
  return {
    id: entity.id.toString(),
    verificationStatus: entity.verificationStatus,
    lastVerifiedAt: entity.lastVerifiedAt || null,
    taxpayerName: entity.taxpayerName || null,
    activities: (activities || []).map((a) => ({
      id: a.id.toString(),
      code: a.code,
      description: a.description || null,
      haciendaStatus: a.haciendaStatus || null,
      haciendaType: a.haciendaType || null,
      isCurrentlyReturned: a.isCurrentlyReturned,
      verifiedAt: a.verifiedAt,
    })),
  };
}

module.exports = router;
