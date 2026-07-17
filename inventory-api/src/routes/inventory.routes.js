const express = require('express');

const authenticate = require('../middlewares/authenticate');
const authorizePermission = require('../middlewares/authorizePermission');
const validate = require('../middlewares/validate');
const { parseBigIntId } = require('../lib/parse');
const { parsePaginationQuery } = require('../lib/pagination');
const { createStockEntrySchema, updateLotQaSchema, adjustStockSchema } = require('../schemas/inventory.schema');
const inventoryService = require('../services/inventory.service');

const router = express.Router();
router.use(authenticate);

function optionalBigInt(value, fieldName) {
  return value == null || value === '' ? undefined : parseBigIntId(value, fieldName);
}

router.get('/stocks', authorizePermission('inventory.view', 'inventory.manage'), async (req, res, next) => {
  try {
    return res.json(await inventoryService.listStocks(req.auth, {
      warehouseId: optionalBigInt(req.query.warehouseId, 'warehouseId'),
      productId: optionalBigInt(req.query.productId, 'productId'),
    }));
  } catch (error) { return next(error); }
});

router.get('/movements', authorizePermission('inventory.view', 'inventory.manage'), async (req, res, next) => {
  try {
    return res.json(await inventoryService.listMovements(req.auth, {
      warehouseId: optionalBigInt(req.query.warehouseId, 'warehouseId'),
      productId: optionalBigInt(req.query.productId, 'productId'),
      lotId: optionalBigInt(req.query.lotId, 'lotId'),
    }, parsePaginationQuery(req.query)));
  } catch (error) { return next(error); }
});

router.post('/entries', authorizePermission('inventory.manage'), validate(createStockEntrySchema), async (req, res, next) => {
  try { return res.status(201).json(await inventoryService.registerStockEntry(req.body, req.auth, req)); } catch (error) { return next(error); }
});
router.patch('/lots/:id/qa', authorizePermission('inventory.qa.manage'), validate(updateLotQaSchema), async (req, res, next) => {
  try {
    return res.json(await inventoryService.updateLotQa(parseBigIntId(req.params.id), req.body, req.auth, req));
  } catch (error) { return next(error); }
});

router.post('/adjustments', authorizePermission('inventory.manage'), validate(adjustStockSchema), async (req, res, next) => {
  try { return res.status(201).json(await inventoryService.adjustStock(req.body, req.auth, req)); } catch (error) { return next(error); }
});

module.exports = router;
