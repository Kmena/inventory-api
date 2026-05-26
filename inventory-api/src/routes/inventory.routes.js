const express = require('express');

const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const validate = require('../middlewares/validate');
const { createStockEntrySchema, adjustStockSchema } = require('../schemas/inventory.schema');
const inventoryService = require('../services/inventory.service');

const router = express.Router();
router.use(authenticate);

router.get('/movements', authorize('admin', 'warehouse'), async (_req, res, next) => {
  try { return res.json(await inventoryService.listMovements()); } catch (error) { return next(error); }
});

router.post('/entries', authorize('admin', 'warehouse'), validate(createStockEntrySchema), async (req, res, next) => {
  try { return res.status(201).json(await inventoryService.registerStockEntry(req.body)); } catch (error) { return next(error); }
});

router.post('/adjustments', authorize('admin', 'warehouse'), validate(adjustStockSchema), async (req, res, next) => {
  try { return res.status(201).json(await inventoryService.adjustStock(req.body)); } catch (error) { return next(error); }
});

module.exports = router;
