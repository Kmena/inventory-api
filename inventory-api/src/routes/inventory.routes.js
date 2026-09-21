const express = require('express');

const authenticate = require('../middlewares/authenticate');
const { authorizeAccessPolicy } = require('../security/access-policies');
const validate = require('../middlewares/validate');
const { parseBigIntId } = require('../lib/parse');
const { parsePaginationQuery } = require('../lib/pagination');
const {
  createStockEntrySchema,
  updateLotQaSchema,
  adjustStockSchema,
  transferInventorySchema,
  createInitialInventorySchema,
  updateInventoryAlertStatusSchema,
  createInventoryRequestSchema,
  pickupTransferRequestSchema,
  cancelInventoryRequestSchema,
  confirmDeliveryRequestSchema,
  executeInventoryRequestSchema,
} = require('../schemas/inventory.schema');
const inventoryService = require('../services/inventory.service');
const inventoryRequestsService = require('../services/inventory-requests.service');

const router = express.Router();
router.use(authenticate);

function optionalBigInt(value, fieldName) {
  return value == null || value === '' ? undefined : parseBigIntId(value, fieldName);
}

function optionalDate(value) {
  return value == null || value === '' ? undefined : new Date(value);
}

function optionalBoolean(value) {
  if (value == null || value === '') return undefined;
  return value === true || value === 'true';
}

router.get('/alerts', authorizeAccessPolicy('inventory.alerts.list'), async (req, res, next) => {
  try {
    return res.json(await inventoryService.listInventoryAlerts(req.auth, {
      status: req.query.status || undefined,
      alertType: req.query.alertType || undefined,
      severity: req.query.severity || undefined,
      warehouseId: optionalBigInt(req.query.warehouseId, 'warehouseId'),
      productId: optionalBigInt(req.query.productId, 'productId'),
      lotId: optionalBigInt(req.query.lotId, 'lotId'),
    }, parsePaginationQuery(req.query)));
  } catch (error) { return next(error); }
});

router.get('/alerts/:id', authorizeAccessPolicy('inventory.alerts.detail'), async (req, res, next) => {
  try {
    return res.json(await inventoryService.getInventoryAlert(parseBigIntId(req.params.id), req.auth));
  } catch (error) { return next(error); }
});

router.patch('/alerts/:id/status', authorizeAccessPolicy('inventory.alerts.update-status'), validate(updateInventoryAlertStatusSchema), async (req, res, next) => {
  try {
    return res.json(await inventoryService.updateInventoryAlertStatus(parseBigIntId(req.params.id), req.body, req.auth, req));
  } catch (error) { return next(error); }
});

router.get('/stocks', authorizeAccessPolicy('inventory.stocks.list'), async (req, res, next) => {
  try {
    return res.json(await inventoryService.listStocks(req.auth, {
      warehouseId: optionalBigInt(req.query.warehouseId, 'warehouseId'),
      productId: optionalBigInt(req.query.productId, 'productId'),
      categoryId: optionalBigInt(req.query.categoryId, 'categoryId'),
      q: req.query.q?.trim() || undefined,
      stockStatus: req.query.stockStatus || undefined,
    }, parsePaginationQuery(req.query)));
  } catch (error) { return next(error); }
});

router.get('/lots', authorizeAccessPolicy('inventory.lots.list'), async (req, res, next) => {
  try {
    return res.json(await inventoryService.listLots(req.auth, {
      warehouseId: optionalBigInt(req.query.warehouseId, 'warehouseId'),
      productId: optionalBigInt(req.query.productId, 'productId'),
      q: req.query.q?.trim() || undefined,
      lotStatus: req.query.lotStatus || undefined,
      qaStatus: req.query.qaStatus || undefined,
      expirationFrom: optionalDate(req.query.expirationFrom),
      expirationTo: optionalDate(req.query.expirationTo),
      includeSystem: optionalBoolean(req.query.includeSystem),
    }, parsePaginationQuery(req.query)));
  } catch (error) { return next(error); }
});

router.get('/lots/:id', authorizeAccessPolicy('inventory.lots.list'), async (req, res, next) => {
  try {
    return res.json(await inventoryService.getLot(parseBigIntId(req.params.id), req.auth));
  } catch (error) { return next(error); }
});

router.get('/movements', authorizeAccessPolicy('inventory.movements.list'), async (req, res, next) => {
  try {
    return res.json(await inventoryService.listMovements(req.auth, {
      warehouseId: optionalBigInt(req.query.warehouseId, 'warehouseId'),
      productId: optionalBigInt(req.query.productId, 'productId'),
      lotId: optionalBigInt(req.query.lotId, 'lotId'),
      sourceId: optionalBigInt(req.query.sourceId, 'sourceId'),
      movementType: req.query.movementType || undefined,
      reasonCode: req.query.reasonCode || undefined,
      sourceType: req.query.sourceType || undefined,
      q: req.query.q?.trim() || undefined,
      dateFrom: optionalDate(req.query.dateFrom),
      dateTo: optionalDate(req.query.dateTo),
    }, parsePaginationQuery(req.query)));
  } catch (error) { return next(error); }
});

router.post('/initial-inventory', authorizeAccessPolicy('inventory.initial-inventory.create'), validate(createInitialInventorySchema), async (req, res, next) => {
  try { return res.status(201).json(await inventoryService.createInitialInventory(req.body, req.auth, req)); } catch (error) { return next(error); }
});

router.post('/entries', authorizeAccessPolicy('inventory.entries.create'), validate(createStockEntrySchema), async (req, res, next) => {
  try { return res.status(201).json(await inventoryService.registerStockEntry(req.body, req.auth, req)); } catch (error) { return next(error); }
});
router.patch('/lots/:id/qa', authorizeAccessPolicy('inventory.lot-qa.update'), validate(updateLotQaSchema), async (req, res, next) => {
  try {
    return res.json(await inventoryService.updateLotQa(parseBigIntId(req.params.id), req.body, req.auth, req));
  } catch (error) { return next(error); }
});

router.post('/adjustments', authorizeAccessPolicy('inventory.adjustments.create'), validate(adjustStockSchema), async (req, res, next) => {
  try { return res.status(201).json(await inventoryService.adjustStock(req.body, req.auth, req)); } catch (error) { return next(error); }
});

router.post('/transfers', authorizeAccessPolicy('inventory.transfers.create'), validate(transferInventorySchema), async (req, res, next) => {
  try { return res.status(201).json(await inventoryService.transferInventory(req.body, req.auth, req)); } catch (error) { return next(error); }
});

// ── Inventory Requests ───────────────────────────────────────────────────────
router.post('/requests', authorizeAccessPolicy('inventory.requests.create'), validate(createInventoryRequestSchema), async (req, res, next) => {
  try { return res.status(201).json(await inventoryRequestsService.createInventoryRequest(req.body, req.auth, req)); } catch (error) { return next(error); }
});

router.get('/requests', authorizeAccessPolicy('inventory.requests.list'), async (req, res, next) => {
  try {
    return res.json(await inventoryRequestsService.listInventoryRequests(req.auth, {
      status: req.query.status || undefined,
      type: req.query.type || undefined,
      lotId: optionalBigInt(req.query.lotId, 'lotId'),
      productId: optionalBigInt(req.query.productId, 'productId'),
    }, parsePaginationQuery(req.query)));
  } catch (error) { return next(error); }
});

router.get('/requests/:id', authorizeAccessPolicy('inventory.requests.list'), async (req, res, next) => {
  try { return res.json(await inventoryRequestsService.getInventoryRequest(parseBigIntId(req.params.id), req.auth)); } catch (error) { return next(error); }
});

router.post('/requests/:id/cancel', authorizeAccessPolicy('inventory.requests.cancel'), validate(cancelInventoryRequestSchema), async (req, res, next) => {
  try { return res.json(await inventoryRequestsService.cancelInventoryRequest(parseBigIntId(req.params.id), req.body, req.auth, req)); } catch (error) { return next(error); }
});

router.post('/requests/:id/pickup', authorizeAccessPolicy('inventory.requests.execute'), validate(pickupTransferRequestSchema), async (req, res, next) => {
  try { return res.json(await inventoryRequestsService.pickupTransferRequest(parseBigIntId(req.params.id), req.body, req.auth, req)); } catch (error) { return next(error); }
});

router.post('/requests/:id/confirm-delivery', authorizeAccessPolicy('inventory.requests.execute'), validate(confirmDeliveryRequestSchema), async (req, res, next) => {
  try { return res.json(await inventoryRequestsService.confirmDeliveryRequest(parseBigIntId(req.params.id), req.body, req.auth, req)); } catch (error) { return next(error); }
});

router.post('/requests/:id/execute', authorizeAccessPolicy('inventory.requests.execute'), validate(executeInventoryRequestSchema), async (req, res, next) => {
  // Route-level schema sanitizes all possible fields; service validates semantics by request type
  try { return res.json(await inventoryRequestsService.executeInventoryRequest(parseBigIntId(req.params.id), req.body, req.auth, req)); } catch (error) { return next(error); }
});

module.exports = router;
