const express = require('express');

const authenticate = require('../middlewares/authenticate');
const authorizePermission = require('../middlewares/authorizePermission');
const validate = require('../middlewares/validate');
const { createStockEntrySchema, adjustStockSchema } = require('../schemas/inventory.schema');
const inventoryService = require('../services/inventory.service');

const router = express.Router();
router.use(authenticate);

router.get('/movements', authorizePermission('inventory.view', 'inventory.manage'), async (_req, res, next) => {
  try { return res.json(await inventoryService.listMovements()); } catch (error) { return next(error); }
});

router.post('/entries', authorizePermission('inventory.manage'), validate(createStockEntrySchema), async (req, res, next) => {
  try { return res.status(201).json(await inventoryService.registerStockEntry(req.body)); } catch (error) { return next(error); }
});

router.post('/adjustments', authorizePermission('inventory.manage'), validate(adjustStockSchema), async (req, res, next) => {
  try { return res.status(201).json(await inventoryService.adjustStock(req.body)); } catch (error) { return next(error); }
});

module.exports = router;
