const express = require('express');

const authenticate = require('../middlewares/authenticate');
const { authorizeAccessPolicy } = require('../security/access-policies');
const validate = require('../middlewares/validate');
const { parseBigIntId } = require('../lib/parse');
const { createPurchaseReceiptSchema, createReceiptInspectionSchema } = require('../schemas/receipt.schema');
const { createFiscalDocumentReferenceSchema } = require('../schemas/fiscal-reference.schema');
const receiptService = require('../services/receipt.service');
const fiscalReferenceService = require('../services/fiscal-reference.service');

const router = express.Router();
router.use(authenticate);

router.get('/', authorizeAccessPolicy('receipt.view'), async (req, res, next) => {
  try {
    return res.json(await receiptService.listPurchaseReceipts(req.auth));
  } catch (error) {
    return next(error);
  }
});

router.post('/', authorizeAccessPolicy('receipt.inspect'), validate(createPurchaseReceiptSchema), async (req, res, next) => {
  try {
    return res.status(201).json(await receiptService.createPurchaseReceipt(req.body, req.auth));
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', authorizeAccessPolicy('receipt.view'), async (req, res, next) => {
  try {
    return res.json(await receiptService.getPurchaseReceipt(parseBigIntId(req.params.id), req.auth));
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/items/:itemId/inspections', authorizeAccessPolicy('receipt.inspect'), validate(createReceiptInspectionSchema), async (req, res, next) => {
  try {
    return res.status(201).json(await receiptService.inspectPurchaseReceiptItem(
      parseBigIntId(req.params.id),
      parseBigIntId(req.params.itemId),
      req.body,
      req.auth,
    ));
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/confirm', authorizeAccessPolicy('receipt.confirm'), async (req, res, next) => {
  try {
    return res.json(await receiptService.confirmPurchaseReceipt(parseBigIntId(req.params.id), req.auth));
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/reverse', authorizeAccessPolicy('receipt.reverse'), async (req, res, next) => {
  try {
    return res.json(await receiptService.reversePurchaseReceipt(parseBigIntId(req.params.id), req.auth));
  } catch (error) {
    return next(error);
  }
});

router.get('/:id/fiscal-references', authorizeAccessPolicy('receipt.view'), async (req, res, next) => {
  try {
    return res.json(await fiscalReferenceService.listFiscalReferencesForReceipt(parseBigIntId(req.params.id), req.auth));
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/fiscal-references', authorizeAccessPolicy('receipt.confirm'), validate(createFiscalDocumentReferenceSchema), async (req, res, next) => {
  try {
    return res.status(201).json(await fiscalReferenceService.createFiscalReferenceForReceipt(parseBigIntId(req.params.id), req.body, req.auth));
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
