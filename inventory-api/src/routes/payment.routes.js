const express = require('express');

const authenticate = require('../middlewares/authenticate');
const { authorizeAccessPolicy } = require('../security/access-policies');
const validate = require('../middlewares/validate');
const { parseBigIntId } = require('../lib/parse');
const { parsePaginationQuery } = require('../lib/pagination');
const {
  createPaymentSchema,
  updatePaymentSchema,
  approvePaymentSchema,
  markPaymentUnderReviewSchema,
  rejectPaymentSchema,
  reversePaymentSchema,
} = require('../schemas/payment.schema');
const paymentService = require('../services/payment.service');
const { highPayloadParsers } = require('../middlewares/request-payload');

const router = express.Router();
router.use(authenticate);

router.get('/', authorizeAccessPolicy('payment.list'), async (req, res, next) => {
  try { return res.json(await paymentService.listPayments(req.auth, parsePaginationQuery(req.query))); } catch (error) { return next(error); }
});

router.get('/:id', authorizeAccessPolicy('payment.detail'), async (req, res, next) => {
  try { return res.json(await paymentService.getPayment(parseBigIntId(req.params.id), req.auth)); } catch (error) { return next(error); }
});

router.post('/', ...highPayloadParsers, authorizeAccessPolicy('payment.create'), validate(createPaymentSchema), async (req, res, next) => {
  try { return res.status(201).json(await paymentService.createPayment(req.body, req.auth, req)); } catch (error) { return next(error); }
});

router.put('/:id', ...highPayloadParsers, authorizeAccessPolicy('payment.update'), validate(updatePaymentSchema), async (req, res, next) => {
  try { return res.json(await paymentService.updatePayment(parseBigIntId(req.params.id), req.body, req.auth, req)); } catch (error) { return next(error); }
});

router.post('/:id/under-review', authorizeAccessPolicy('payment.review'), validate(markPaymentUnderReviewSchema), async (req, res, next) => {
  try { return res.json(await paymentService.markPaymentUnderReview(parseBigIntId(req.params.id), req.body, req.auth, req)); } catch (error) { return next(error); }
});

router.post('/:id/approve', authorizeAccessPolicy('payment.approve'), validate(approvePaymentSchema), async (req, res, next) => {
  try { return res.json(await paymentService.approvePayment(parseBigIntId(req.params.id), req.body, req.auth, req)); } catch (error) { return next(error); }
});

router.post('/:id/reject', authorizeAccessPolicy('payment.reject'), validate(rejectPaymentSchema), async (req, res, next) => {
  try { return res.json(await paymentService.rejectPayment(parseBigIntId(req.params.id), req.body, req.auth, req)); } catch (error) { return next(error); }
});

router.post('/:id/reverse', authorizeAccessPolicy('payment.reverse'), validate(reversePaymentSchema), async (req, res, next) => {
  try { return res.json(await paymentService.reversePayment(parseBigIntId(req.params.id), req.auth, req.body.reason, req)); } catch (error) { return next(error); }
});

router.get('/:id/receipts/:receiptId/download', authorizeAccessPolicy('payment.receipt-download'), async (req, res, next) => {
  try {
    const download = await paymentService.getPaymentReceiptDownload(
      parseBigIntId(req.params.id),
      parseBigIntId(req.params.receiptId),
      req.auth,
    );
    res.type(download.mimeType);
    return res.download(download.absolutePath, download.fileName);
  } catch (error) { return next(error); }
});

router.delete('/:id', authorizeAccessPolicy('payment.delete'), async (req, res, next) => {
  try {
    await paymentService.removePayment(parseBigIntId(req.params.id), req.auth, req);
    return res.status(204).send();
  } catch (error) { return next(error); }
});

module.exports = router;
