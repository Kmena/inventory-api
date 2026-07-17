const express = require('express');

const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const authorizePermission = require('../middlewares/authorizePermission');
const validate = require('../middlewares/validate');
const { parseBigIntId } = require('../lib/parse');
const { createOrderSchema, updateOrderSchema } = require('../schemas/order.schema');
const orderService = require('../services/order.service');

const router = express.Router();
router.use(authenticate);

router.get('/', authorize('admin', 'sales', 'warehouse'), async (req, res, next) => {
  try { return res.json(await orderService.listOrders(req.auth)); } catch (error) { return next(error); }
});

router.get('/:id', authorize('admin', 'sales', 'warehouse'), async (req, res, next) => {
  try { return res.json(await orderService.getOrder(parseBigIntId(req.params.id), req.auth)); } catch (error) { return next(error); }
});

router.post('/', authorizePermission('sales.manage', 'sales.orders.create'), validate(createOrderSchema), async (req, res, next) => {
  try { return res.status(201).json(await orderService.createOrder(req.body, req.auth, req)); } catch (error) { return next(error); }
});

router.put('/:id', authorizePermission('sales.manage', 'sales.orders.create'), validate(updateOrderSchema), async (req, res, next) => {
  try { return res.json(await orderService.updateOrder(parseBigIntId(req.params.id), req.body, req.auth, req)); } catch (error) { return next(error); }
});

router.post('/:id/approve', authorize('admin', 'sales'), async (req, res, next) => {
  try { return res.json(await orderService.approveOrder(parseBigIntId(req.params.id), req.auth, req)); } catch (error) { return next(error); }
});

router.post('/:id/cancel', authorize('admin', 'sales'), async (req, res, next) => {
  try { return res.json(await orderService.cancelOrder(parseBigIntId(req.params.id), req.auth, req)); } catch (error) { return next(error); }
});

router.post('/:id/dispatch', authorize('admin', 'warehouse'), async (req, res, next) => {
  try { return res.json(await orderService.dispatchOrder(parseBigIntId(req.params.id), req.auth, req)); } catch (error) { return next(error); }
});

router.delete('/:id', authorize('admin'), async (req, res, next) => {
  try {
    await orderService.removeOrder(parseBigIntId(req.params.id), req.auth, req);
    return res.status(204).send();
  } catch (error) { return next(error); }
});

module.exports = router;
