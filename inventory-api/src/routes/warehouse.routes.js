const express = require('express');

const authenticate = require('../middlewares/authenticate');
const authorizePermission = require('../middlewares/authorizePermission');
const validate = require('../middlewares/validate');
const { parsePaginationQuery } = require('../lib/pagination');
const { createWarehouseSchema } = require('../schemas/warehouse.schema');
const warehouseService = require('../services/warehouse.service');

const router = express.Router();
router.use(authenticate);

router.get('/company', authorizePermission('inventory.view', 'inventory.manage'), async (req, res, next) => {
  try {
    return res.json(await warehouseService.listCompanyWarehouses(req.auth, parsePaginationQuery(req.query)));
  } catch (error) {
    return next(error);
  }
});

router.post('/company', authorizePermission('inventory.manage'), validate(createWarehouseSchema), async (req, res, next) => {
  try {
    return res.status(201).json(await warehouseService.createCompanyWarehouse(req.body, req.auth));
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
