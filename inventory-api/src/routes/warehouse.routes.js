const express = require('express');

const authenticate = require('../middlewares/authenticate');
const { authorizeAccessPolicy } = require('../security/access-policies');
const validate = require('../middlewares/validate');
const { parsePaginationQuery } = require('../lib/pagination');
const { parseBigIntId } = require('../lib/parse');
const { createWarehouseSchema, updateWarehouseSchema, updateWarehouseStatusSchema } = require('../schemas/warehouse.schema');
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

router.get('/company/:id', authorizeAccessPolicy('warehouse.company.list'), async (req, res, next) => {
  try {
    return res.json(await warehouseService.getCompanyWarehouse(parseBigIntId(req.params.id), req.auth));
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

router.put('/company/:id', authorizeAccessPolicy('warehouse.company.create'), validate(updateWarehouseSchema), async (req, res, next) => {
  try {
    return res.json(await warehouseService.updateCompanyWarehouse(parseBigIntId(req.params.id), req.body, req.auth));
  } catch (error) {
    return next(error);
  }
});

router.patch('/company/:id/status', authorizeAccessPolicy('warehouse.company.create'), validate(updateWarehouseStatusSchema), async (req, res, next) => {
  try {
    return res.json(await warehouseService.updateCompanyWarehouseStatus(parseBigIntId(req.params.id), req.body, req.auth));
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
