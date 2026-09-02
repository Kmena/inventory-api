const express = require('express');

const authenticate = require('../middlewares/authenticate');
const { authorizeAccessPolicy } = require('../security/access-policies');
const validate = require('../middlewares/validate');
const { parseBigIntId } = require('../lib/parse');
const {
  createPurchaseRequestSchema,
  createSupplierQuotationSchema,
  createAssistedQuotationRequestSchema,
  selectSupplierQuotationSchema,
  approveSupplierSelectionSchema,
  createPurchaseOrderSchema,
  selectMixedItemsSchema,
  createMixedPurchaseOrdersSchema,
} = require('../schemas/procurement.schema');
const procurementService = require('../services/procurement.service');

const router = express.Router();
router.use(authenticate);

router.get('/quotable-products', authorizeAccessPolicy('procurement.view'), async (req, res, next) => {
  try {
    return res.json(await procurementService.listQuotableProducts(req.auth));
  } catch (error) {
    return next(error);
  }
});

router.get('/products/:id/suppliers-pricing', authorizeAccessPolicy('procurement.view'), async (req, res, next) => {
  try {
    return res.json(await procurementService.getProductSuppliersPricing(parseBigIntId(req.params.id), req.auth));
  } catch (error) {
    return next(error);
  }
});

router.post('/products/:id/request-quotations', authorizeAccessPolicy('procurement.manage'), validate(createAssistedQuotationRequestSchema), async (req, res, next) => {
  try {
    return res.status(201).json(await procurementService.createAssistedQuotationRequest(req.body, req.auth));
  } catch (error) {
    return next(error);
  }
});

router.get('/requests', authorizeAccessPolicy('procurement.view'), async (req, res, next) => {
  try {
    return res.json(await procurementService.listPurchaseRequests(req.auth));
  } catch (error) {
    return next(error);
  }
});

router.post('/requests', authorizeAccessPolicy('procurement.manage'), validate(createPurchaseRequestSchema), async (req, res, next) => {
  try {
    return res.status(201).json(await procurementService.createPurchaseRequest(req.body, req.auth));
  } catch (error) {
    return next(error);
  }
});

router.get('/requests/:id', authorizeAccessPolicy('procurement.view'), async (req, res, next) => {
  try {
    return res.json(await procurementService.getPurchaseRequest(parseBigIntId(req.params.id), req.auth));
  } catch (error) {
    return next(error);
  }
});

router.post('/requests/:id/quotations', authorizeAccessPolicy('procurement.manage'), validate(createSupplierQuotationSchema), async (req, res, next) => {
  try {
    return res.status(201).json(await procurementService.createSupplierQuotation(parseBigIntId(req.params.id), req.body, req.auth));
  } catch (error) {
    return next(error);
  }
});

router.get('/requests/:id/comparison', authorizeAccessPolicy('procurement.view'), async (req, res, next) => {
  try {
    return res.json(await procurementService.compareSupplierQuotations(parseBigIntId(req.params.id), req.auth));
  } catch (error) {
    return next(error);
  }
});

router.post('/requests/:id/select-items', authorizeAccessPolicy('procurement.manage'), validate(selectMixedItemsSchema), async (req, res, next) => {
  try {
    return res.status(201).json(await procurementService.selectMixedSupplierItems(parseBigIntId(req.params.id), req.body, req.auth));
  } catch (error) {
    return next(error);
  }
});

router.post('/requests/:id/select-quotation', authorizeAccessPolicy('procurement.manage'), validate(selectSupplierQuotationSchema), async (req, res, next) => {
  try {
    return res.json(await procurementService.selectSupplierQuotation(parseBigIntId(req.params.id), req.body, req.auth));
  } catch (error) {
    return next(error);
  }
});

router.post('/selections/:id/approve', authorizeAccessPolicy('procurement.approve'), validate(approveSupplierSelectionSchema), async (req, res, next) => {
  try {
    return res.json(await procurementService.approveSupplierSelection(parseBigIntId(req.params.id), req.body, req.auth));
  } catch (error) {
    return next(error);
  }
});

router.post('/requests/:id/cancel', authorizeAccessPolicy('procurement.manage'), async (req, res, next) => {
  try {
    return res.json(await procurementService.cancelPurchaseRequest(parseBigIntId(req.params.id), req.auth));
  } catch (error) {
    return next(error);
  }
});

router.post('/requests/:id/purchase-orders-batch', authorizeAccessPolicy('procurement.manage'), validate(createMixedPurchaseOrdersSchema), async (req, res, next) => {
  try {
    return res.status(201).json(await procurementService.createPurchaseOrdersFromMixedSelections(parseBigIntId(req.params.id), req.body, req.auth));
  } catch (error) {
    return next(error);
  }
});

router.post('/requests/:id/purchase-orders', authorizeAccessPolicy('procurement.manage'), validate(createPurchaseOrderSchema), async (req, res, next) => {
  try {
    return res.status(201).json(await procurementService.createPurchaseOrderFromSelection(parseBigIntId(req.params.id), req.body, req.auth));
  } catch (error) {
    return next(error);
  }
});

router.post('/orders/:id/issue', authorizeAccessPolicy('procurement.manage'), async (req, res, next) => {
  try {
    return res.json(await procurementService.issuePurchaseOrder(parseBigIntId(req.params.id), req.auth));
  } catch (error) {
    return next(error);
  }
});

router.get('/orders', authorizeAccessPolicy('procurement.view'), async (req, res, next) => {
  try {
    return res.json(await procurementService.listPurchaseOrders(req.auth));
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
