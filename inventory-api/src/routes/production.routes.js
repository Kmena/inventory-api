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
} = require('../schemas/production.schema');
const { qualityInspectionSchema } = require('../schemas/quality.schema');
const productionService = require('../services/production.service');
const qualityService = require('../services/quality.service');

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
    return res.status(201).json(await productionService.createProductionOrder(req.body, req.auth));
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

router.post('/orders/:id/submit', authorizeAccessPolicy('production.create'), async (req, res, next) => {
  try {
    return res.json(await productionService.submitProductionOrder(parseBigIntId(req.params.id), req.auth));
  } catch (error) {
    return next(error);
  }
});

router.post('/orders/:id/approve', authorizeAccessPolicy('production.approve'), validate(productionApprovalSchema), async (req, res, next) => {
  try {
    return res.json(await productionService.approveProductionOrder(parseBigIntId(req.params.id), req.body, req.auth));
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

router.post('/orders/:id/stages/:stageId/execute', authorizeAccessPolicy('production.execute'), validate(productionStageExecutionSchema), async (req, res, next) => {
  try {
    return res.json(await productionService.executeProductionStage(
      parseBigIntId(req.params.id),
      parseBigIntId(req.params.stageId),
      req.body,
      req.auth,
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
    return res.status(201).json(await qualityService.createInspectionForStage(
      parseBigIntId(req.params.id),
      parseBigIntId(req.params.stageId),
      req.body,
      req.auth,
    ));
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

router.post('/orders/:id/cancel', authorizeAccessPolicy('production.cancel'), async (req, res, next) => {
  try {
    return res.json(await productionService.cancelProductionOrder(parseBigIntId(req.params.id), req.auth));
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
