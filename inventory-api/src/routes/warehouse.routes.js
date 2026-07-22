const express = require('express');

const authenticate = require('../middlewares/authenticate');
const { authorizeAccessPolicy } = require('../security/access-policies');
const validate = require('../middlewares/validate');
const { parsePaginationQuery } = require('../lib/pagination');
const { createWarehouseSchema } = require('../schemas/warehouse.schema');
const warehouseService = require('../services/warehouse.service');

const router = express.Router();
router.use(authenticate);

router.get('/company', authorizeAccessPolicy('warehouse.company.list'), async (req, res, next) => {
  try {
    return res.json(await warehouseService.listCompanyWarehouses(req.auth, parsePaginationQuery(req.query)));
  } catch (error) {
    return next(error);
  }
});

router.post('/company', authorizeAccessPolicy('warehouse.company.create'), validate(createWarehouseSchema), async (req, res, next) => {
  try {
    return res.status(201).json(await warehouseService.createCompanyWarehouse(req.body, req.auth));
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
