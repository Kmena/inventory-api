const express = require('express');

const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const validate = require('../middlewares/validate');
const { parseBigIntId } = require('../lib/parse');
const { parsePaginationQuery } = require('../lib/pagination');
const { createPaymentSchema, updatePaymentSchema } = require('../schemas/payment.schema');
const paymentService = require('../services/payment.service');

const router = express.Router();
router.use(authenticate);

router.get('/', authorize('admin', 'sales'), async (req, res, next) => {
  try { return res.json(await paymentService.listPayments(req.auth, parsePaginationQuery(req.query))); } catch (error) { return next(error); }
});

router.get('/:id', authorize('admin', 'sales'), async (req, res, next) => {
  try { return res.json(await paymentService.getPayment(parseBigIntId(req.params.id), req.auth)); } catch (error) { return next(error); }
});

router.post('/', authorize('admin', 'sales'), validate(createPaymentSchema), async (req, res, next) => {
  try { return res.status(201).json(await paymentService.createPayment(req.body, req.auth, req)); } catch (error) { return next(error); }
});

router.put('/:id', authorize('admin', 'sales'), validate(updatePaymentSchema), async (req, res, next) => {
  try { return res.json(await paymentService.updatePayment(parseBigIntId(req.params.id), req.body, req.auth, req)); } catch (error) { return next(error); }
});

router.delete('/:id', authorize('admin'), async (req, res, next) => {
  try {
    await paymentService.removePayment(parseBigIntId(req.params.id), req.auth, req);
    return res.status(204).send();
  } catch (error) { return next(error); }
});

module.exports = router;
