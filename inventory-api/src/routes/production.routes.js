const express = require('express');

const authenticate = require('../middlewares/authenticate');
const { authorizeAccessPolicy } = require('../security/access-policies');
const validate = require('../middlewares/validate');
const { parseBigIntId } = require('../lib/parse');
const { parsePaginationQuery } = require('../lib/pagination');
const {
  createProductionOrderSchema,
  productionApprovalSchema,
  productionStageExecutionSchema,
  productionStageReturnSchema,
  productionCompletionSchema,
  stageLossSchema,
  cancelWithReturnsSchema,
  recolectionConfirmSchema,
  recordReconciliationOutcomesSchema,
} = require('../schemas/production.schema');
const { qualityInspectionSchema } = require('../schemas/quality.schema');
const productionService = require('../services/production.service');
const productionMaterialAvailabilityService = require('../services/production-material-availability.service');
const qualityService = require('../services/quality.service');
// TASK-006: stage loss service (production-stage-rejection-and-reexecution)
const productionStageLossService = require('../services/production-stage-loss.service');
// TASK-006: recolection confirmation service (qa-rejection-disposition-and-continuation)
const productionRecolectionService = require('../services/production-recolection.service');

const router = express.Router();
router.use(authenticate);

router.get('/orders', authorizeAccessPolicy('production.view'), async (req, res, next) => {
  try {
    return res.json(await productionService.listProductionOrders(req.auth, parsePaginationQuery(req.query)));
  } catch (error) {
    return next(error);
  }
});

router.post('/orders', authorizeAccessPolicy('production.create'), validate(createProductionOrderSchema), async (req, res, next) => {
  try {
    return res.status(201).json(await productionService.createProductionOrder(req.body, req.auth, req));
  } catch (error) {
    return next(error);
  }
});

router.get('/orders/:id', authorizeAccessPolicy('production.view'), async (req, res, next) => {
  try {
    return res.json(await productionService.getProductionOrder(parseBigIntId(req.params.id), req.auth));
  } catch (error) {
    return next(error);
  }
});

router.get('/orders/:id/material-requirements', authorizeAccessPolicy('production.view'), async (req, res, next) => {
  try {
    return res.json(await productionMaterialAvailabilityService.getMaterialRequirementsWithAvailability(
      parseBigIntId(req.params.id),
      req.auth,
    ));
  } catch (error) {
    return next(error);
  }
});

router.get('/orders/:id/stages/:stageId/available-lots', authorizeAccessPolicy('production.execute'), async (req, res, next) => {
  try {
    return res.json(await productionMaterialAvailabilityService.getAvailableLotsForStage(
      parseBigIntId(req.params.id),
      parseBigIntId(req.params.stageId),
      req.auth,
    ));
  } catch (error) {
    return next(error);
  }
});

router.post('/orders/:id/submit', authorizeAccessPolicy('production.create'), async (req, res, next) => {
  try {
    return res.json(await productionService.submitProductionOrder(parseBigIntId(req.params.id), req.auth));
  } catch (error) {
    return next(error);
  }
});

router.post('/orders/:id/approve', authorizeAccessPolicy('production.approve'), validate(productionApprovalSchema), async (req, res, next) => {
  try {
    return res.json(await productionService.approveProductionOrder(parseBigIntId(req.params.id), req.body, req.auth, req));
  } catch (error) {
    return next(error);
  }
});

router.post('/orders/:id/start', authorizeAccessPolicy('production.execute'), async (req, res, next) => {
  try {
    return res.json(await productionService.startProductionOrder(parseBigIntId(req.params.id), req.auth));
  } catch (error) {
    return next(error);
  }
});

// ─── TASK-006: Stage loss endpoints (production-stage-rejection-and-reexecution) ─────────────

// POST .../losses — register post-rejection losses (or declare zero losses)
// Permission: production.manage
// Note: losses:[] is valid (explicit "no losses" declaration — DEC-003)
router.post('/orders/:id/stages/:stageId/losses', authorizeAccessPolicy('production.manage'), validate(stageLossSchema), async (req, res, next) => {
  try {
    const result = await productionStageLossService.registerStageLosses(
      parseBigIntId(req.params.id),
      parseBigIntId(req.params.stageId),
      req.body,
      req.auth,
    );
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
});

// GET .../losses — query losses history for a stage (all executions)
// Permission: production.view
router.get('/orders/:id/stages/:stageId/losses', authorizeAccessPolicy('production.view'), async (req, res, next) => {
  try {
    return res.json(await productionStageLossService.listStageLosses(
      parseBigIntId(req.params.id),
      parseBigIntId(req.params.stageId),
      req.auth,
    ));
  } catch (error) {
    return next(error);
  }
});

router.post('/orders/:id/stages/:stageId/execute', authorizeAccessPolicy('production.execute'), validate(productionStageExecutionSchema), async (req, res, next) => {
  try {
    return res.json(await productionService.executeProductionStage(
      parseBigIntId(req.params.id),
      parseBigIntId(req.params.stageId),
      req.body,
      req.auth,
      req,
    ));
  } catch (error) {
    return next(error);
  }
});

router.post('/orders/:id/stages/:stageId/returns', authorizeAccessPolicy('production.execute'), validate(productionStageReturnSchema), async (req, res, next) => {
  try {
    return res.status(201).json(await productionService.recordProductionReturn(
      parseBigIntId(req.params.id),
      parseBigIntId(req.params.stageId),
      req.body,
      req.auth,
    ));
  } catch (error) {
    return next(error);
  }
});

router.post('/orders/:id/stages/:stageId/inspections', authorizeAccessPolicy('quality.inspect'), validate(qualityInspectionSchema), async (req, res, next) => {
  try {
    const result = await qualityService.createInspectionForStage(
      parseBigIntId(req.params.id),
      parseBigIntId(req.params.stageId),
      req.body,
      req.auth,
    );
    // Backward compat: when no dispositionsSummary and no relevantInputScope, return just the inspection object.
    // When dispositions or relevant input scope are present, return the envelope.
    if (!Array.isArray(result) && result && typeof result === 'object' && 'inspection' in result) {
      const hasRelevantInputScope = Object.prototype.hasOwnProperty.call(result, 'relevantInputScope');
      const body = (result.dispositionsSummary !== null || hasRelevantInputScope)
        ? result
        : result.inspection;
      return res.status(201).json(body);
    }
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
});

router.get('/orders/:id/inspections', authorizeAccessPolicy('quality.view'), async (req, res, next) => {
  try {
    return res.json(await qualityService.listInspectionsForOrder(
      parseBigIntId(req.params.id),
      req.auth,
    ));
  } catch (error) {
    return next(error);
  }
});

router.post('/orders/:id/complete', authorizeAccessPolicy('production.complete'), validate(productionCompletionSchema), async (req, res, next) => {
  try {
    return res.json(await productionService.completeProductionOrder(
      parseBigIntId(req.params.id),
      req.body,
      req.auth,
    ));
  } catch (error) {
    return next(error);
  }
});

router.post(
  '/orders/:id/cancel',
  authorizeAccessPolicy('production.cancel'),
  validate(cancelWithReturnsSchema),
  async (req, res, next) => {
    try {
      return res.json(
        await productionService.cancelProductionOrder(
          parseBigIntId(req.params.id),
          req.body,
          req.auth,
        ),
      );
    } catch (error) {
      return next(error);
    }
  },
);

// TASK-006: POST /orders/:id/recolections/:recolectionId/confirm
router.post(
  '/orders/:id/recolections/:recolectionId/confirm',
  authorizeAccessPolicy('production.execute'),
  validate(recolectionConfirmSchema),
  async (req, res, next) => {
    try {
      return res.json(
        await productionRecolectionService.confirmRecolection(
          parseBigIntId(req.params.id),
          parseBigIntId(req.params.recolectionId),
          req.body,
          req.auth,
        ),
      );
    } catch (error) {
      return next(error);
    }
  },
);

// TASK-006 (qa-rejection-material-reconciliation-amendment):
// POST /orders/:id/recolections/:recolectionId/reconciliation
router.post(
  '/orders/:id/recolections/:recolectionId/reconciliation',
  authorizeAccessPolicy('production.execute'),
  validate(recordReconciliationOutcomesSchema),
  async (req, res, next) => {
    try {
      return res.json(
        await productionRecolectionService.recordReconciliationOutcomes(
          parseBigIntId(req.params.id),
          parseBigIntId(req.params.recolectionId),
          req.body.outcomes,
          req.auth,
        ),
      );
    } catch (error) {
      return next(error);
    }
  },
);

module.exports = router;
