const express = require('express');

const authenticate = require('../middlewares/authenticate');
const { authorizeAccessPolicy } = require('../security/access-policies');
const validate = require('../middlewares/validate');
const { parseBigIntId } = require('../lib/parse');
const { parsePaginationQuery } = require('../lib/pagination');
const { createOrderSchema, updateOrderSchema } = require('../schemas/order.schema');
const orderService = require('../services/order.service');

const router = express.Router();
router.use(authenticate);

router.get('/', authorizeAccessPolicy('order.list'), async (req, res, next) => {
  try { return res.json(await orderService.listOrders(req.auth, parsePaginationQuery(req.query))); } catch (error) { return next(error); }
});

// Delivered (dispatched) orders — root admin dispatch history
router.get('/dispatched', authorizeAccessPolicy('order.list'), async (req, res, next) => {
  try { return res.json(await orderService.listDeliveredOrders(req.auth)); } catch (error) { return next(error); }
});

router.get('/:id', authorizeAccessPolicy('order.detail'), async (req, res, next) => {
  try { return res.json(await orderService.getOrder(parseBigIntId(req.params.id), req.auth)); } catch (error) { return next(error); }
});

router.post('/', authorizeAccessPolicy('order.create'), validate(createOrderSchema), async (req, res, next) => {
  try { return res.status(201).json(await orderService.createOrder(req.body, req.auth, req)); } catch (error) { return next(error); }
});

router.put('/:id', authorizeAccessPolicy('order.update'), validate(updateOrderSchema), async (req, res, next) => {
  try { return res.json(await orderService.updateOrder(parseBigIntId(req.params.id), req.body, req.auth, req)); } catch (error) { return next(error); }
});

router.post('/:id/approve', authorizeAccessPolicy('order.approve'), async (req, res, next) => {
  try { return res.json(await orderService.approveOrder(parseBigIntId(req.params.id), req.auth, req)); } catch (error) { return next(error); }
});

router.post('/:id/cancel', authorizeAccessPolicy('order.cancel'), async (req, res, next) => {
  try { return res.json(await orderService.cancelOrder(parseBigIntId(req.params.id), req.auth, req)); } catch (error) { return next(error); }
});

router.post('/:id/dispatch', authorizeAccessPolicy('order.dispatch'), async (req, res, next) => {
  try { return res.json(await orderService.dispatchOrder(parseBigIntId(req.params.id), req.auth, req.body || null, req)); } catch (error) { return next(error); }
});

router.delete('/:id', authorizeAccessPolicy('order.delete'), async (req, res, next) => {
  try {
    await orderService.removeOrder(parseBigIntId(req.params.id), req.auth, req);
    return res.status(204).send();
  } catch (error) { return next(error); }
});

module.exports = router;
