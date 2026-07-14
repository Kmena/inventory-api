const express = require('express');

const authenticate = require('../middlewares/authenticate');
const validate = require('../middlewares/validate');
const { parseBigIntId } = require('../lib/parse');
const {
  createAgentVisitSchema,
  createAgentOrderSchema,
} = require('../schemas/agent-workspace.schema');
const agentWorkspaceService = require('../services/agent-workspace.service');

const router = express.Router();
router.use(authenticate);

router.get('/dashboard', async (req, res, next) => {
  try {
    return res.json(await agentWorkspaceService.listAgentDashboard(req.auth));
  } catch (error) {
    return next(error);
  }
});

router.get('/stores', async (req, res, next) => {
  try {
    return res.json(await agentWorkspaceService.listAgentStores(req.query, req.auth));
  } catch (error) {
    return next(error);
  }
});

router.get('/stores/:storeId', async (req, res, next) => {
  try {
    return res.json(await agentWorkspaceService.getAgentStoreDetail(parseBigIntId(req.params.storeId, 'storeId'), req.auth));
  } catch (error) {
    return next(error);
  }
});

router.get('/stores/:storeId/purchase-history', async (req, res, next) => {
  try {
    return res.json(await agentWorkspaceService.getAgentStorePurchaseHistory(parseBigIntId(req.params.storeId, 'storeId'), req.auth));
  } catch (error) {
    return next(error);
  }
});

router.get('/stores/:storeId/sellable-products', async (req, res, next) => {
  try {
    return res.json(await agentWorkspaceService.getAgentStoreSellableProducts(parseBigIntId(req.params.storeId, 'storeId'), req.auth));
  } catch (error) {
    return next(error);
  }
});

router.get('/stores/:storeId/order-context', async (req, res, next) => {
  try {
    return res.json(await agentWorkspaceService.getAgentStoreOrderContext(parseBigIntId(req.params.storeId, 'storeId'), req.auth));
  } catch (error) {
    return next(error);
  }
});

router.get('/goals', async (req, res, next) => {
  try {
    return res.json(await agentWorkspaceService.listAgentGoals(req.auth));
  } catch (error) {
    return next(error);
  }
});

router.post('/visits', validate(createAgentVisitSchema), async (req, res, next) => {
  try {
    return res.status(201).json(await agentWorkspaceService.createAgentVisit(req.body, req.auth));
  } catch (error) {
    return next(error);
  }
});

router.get('/visits', async (req, res, next) => {
  try {
    return res.json(await agentWorkspaceService.listAgentVisits(req.auth));
  } catch (error) {
    return next(error);
  }
});

router.post('/stores/:storeId/orders', validate(createAgentOrderSchema), async (req, res, next) => {
  try {
    return res.status(201).json(await agentWorkspaceService.createAgentStoreOrder(parseBigIntId(req.params.storeId, 'storeId'), req.body, req.auth));
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
