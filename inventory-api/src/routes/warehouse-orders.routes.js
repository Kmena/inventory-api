/**
 * Warehouse order endpoints — used by the warehouse SPA for dispatch workflow.
 *
 * GET  /api/warehouse-orders          → list APPROVED orders for this company
 * GET  /api/warehouse-orders/:id      → single order with lots detail
 * POST /api/warehouse-orders/:id/dispatch → confirm dispatch with transport info
 */
const express = require('express');

const authenticate = require('../middlewares/authenticate');
const { authorizeAccessPolicy } = require('../security/access-policies');
const { parseBigIntId } = require('../lib/parse');
const orderService = require('../services/order.service');
const inventoryService = require('../services/inventory.service');

const router = express.Router();
router.use(authenticate);

// List APPROVED orders — bodega can see what's pending dispatch
router.get('/', authorizeAccessPolicy('warehouse.orders.view'), async (req, res, next) => {
  try {
    return res.json(await orderService.listOrdersForDispatch(req.auth));
  } catch (error) {
    return next(error);
  }
});

// Single order detail with stock-movement allocations (lots info)
router.get('/:id', authorizeAccessPolicy('warehouse.orders.view'), async (req, res, next) => {
  try {
    return res.json(await orderService.getOrderForDispatch(parseBigIntId(req.params.id), req.auth));
  } catch (error) {
    return next(error);
  }
});

// Bodega dispatches the order — accepts transport payload
router.post('/:id/dispatch', authorizeAccessPolicy('warehouse.orders.dispatch'), async (req, res, next) => {
  try {
    return res.json(
      await inventoryService.dispatchOrder(parseBigIntId(req.params.id), req.auth, req.body || null, req),
    );
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
