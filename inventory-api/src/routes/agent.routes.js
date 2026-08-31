const express = require('express');

const authenticate = require('../middlewares/authenticate');
const { authorizeAccessPolicy } = require('../security/access-policies');
const validate = require('../middlewares/validate');
const { parseBigIntId } = require('../lib/parse');
const {
  createAgentVisitSchema,
  createAgentOrderSchema,
  createAgentPaymentSchema,
} = require('../schemas/agent-workspace.schema');
const { highPayloadParsers } = require('../middlewares/request-payload');
const agentWorkspaceService = require('../services/agent-workspace.service');

const router = express.Router();
router.use(authenticate);

router.get('/dashboard', authorizeAccessPolicy('agent.workspace.access'), async (req, res, next) => {
  try {
    return res.json(await agentWorkspaceService.listAgentDashboard(req.auth));
  } catch (error) {
    return next(error);
  }
});

router.get('/stores', authorizeAccessPolicy('agent.workspace.access'), async (req, res, next) => {
  try {
    return res.json(await agentWorkspaceService.listAgentStores(req.query, req.auth));
  } catch (error) {
    return next(error);
  }
});

router.get('/stores/:storeId', authorizeAccessPolicy('agent.workspace.access'), async (req, res, next) => {
  try {
    return res.json(await agentWorkspaceService.getAgentStoreDetail(parseBigIntId(req.params.storeId, 'storeId'), req.auth));
  } catch (error) {
    return next(error);
  }
});

router.get('/stores/:storeId/purchase-history', authorizeAccessPolicy('agent.workspace.access'), async (req, res, next) => {
  try {
    return res.json(await agentWorkspaceService.getAgentStorePurchaseHistory(parseBigIntId(req.params.storeId, 'storeId'), req.auth));
  } catch (error) {
    return next(error);
  }
});

router.get('/stores/:storeId/sellable-products', authorizeAccessPolicy('agent.workspace.access'), async (req, res, next) => {
  try {
    return res.json(await agentWorkspaceService.getAgentStoreSellableProducts(parseBigIntId(req.params.storeId, 'storeId'), req.auth));
  } catch (error) {
    return next(error);
  }
});

router.get('/stores/:storeId/order-context', authorizeAccessPolicy('agent.workspace.access'), async (req, res, next) => {
  try {
    return res.json(await agentWorkspaceService.getAgentStoreOrderContext(parseBigIntId(req.params.storeId, 'storeId'), req.auth));
  } catch (error) {
    return next(error);
  }
});

router.get('/goals', authorizeAccessPolicy('agent.workspace.access'), async (req, res, next) => {
  try {
    return res.json(await agentWorkspaceService.listAgentGoals(req.auth));
  } catch (error) {
    return next(error);
  }
});

router.post('/visits', authorizeAccessPolicy('agent.workspace.access'), validate(createAgentVisitSchema), async (req, res, next) => {
  try {
    return res.status(201).json(await agentWorkspaceService.createAgentVisit(req.body, req.auth));
  } catch (error) {
    return next(error);
  }
});

router.get('/visits', authorizeAccessPolicy('agent.workspace.access'), async (req, res, next) => {
  try {
    return res.json(await agentWorkspaceService.listAgentVisits(req.auth));
  } catch (error) {
    return next(error);
  }
});

router.get('/orders', authorizeAccessPolicy('agent.workspace.access'), async (req, res, next) => {
  try {
    return res.json(await agentWorkspaceService.listAgentOrders(req.auth));
  } catch (error) {
    return next(error);
  }
});

router.post('/stores/:storeId/orders', authorizeAccessPolicy('agent.workspace.access'), validate(createAgentOrderSchema), async (req, res, next) => {
  try {
    return res.status(201).json(await agentWorkspaceService.createAgentStoreOrder(parseBigIntId(req.params.storeId, 'storeId'), req.body, req.auth));
  } catch (error) {
    return next(error);
  }
});

// Register a payment collected from a client store
router.post(
  '/stores/:storeId/payments',
  ...highPayloadParsers,
  authorizeAccessPolicy('agent.workspace.access'),
  validate(createAgentPaymentSchema),
  async (req, res, next) => {
    try {
      return res.status(201).json(
        await agentWorkspaceService.createAgentPayment(
          parseBigIntId(req.params.storeId, 'storeId'),
          req.body,
          req.auth,
          req,
        ),
      );
    } catch (error) {
      return next(error);
    }
  },
);

module.exports = router;
