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
  updateInventoryAlertStatusSchema,
} = require('../schemas/inventory.schema');
const inventoryService = require('../services/inventory.service');

const router = express.Router();
router.use(authenticate);

function optionalBigInt(value, fieldName) {
  return value == null || value === '' ? undefined : parseBigIntId(value, fieldName);
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
    }));
  } catch (error) { return next(error); }
});

router.get('/movements', authorizeAccessPolicy('inventory.movements.list'), async (req, res, next) => {
  try {
    return res.json(await inventoryService.listMovements(req.auth, {
      warehouseId: optionalBigInt(req.query.warehouseId, 'warehouseId'),
      productId: optionalBigInt(req.query.productId, 'productId'),
      lotId: optionalBigInt(req.query.lotId, 'lotId'),
    }, parsePaginationQuery(req.query)));
  } catch (error) { return next(error); }
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

module.exports = router;
