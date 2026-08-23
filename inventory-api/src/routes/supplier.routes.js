const express = require('express');

const authenticate = require('../middlewares/authenticate');
const { authorizeAccessPolicy } = require('../security/access-policies');
const validate = require('../middlewares/validate');
const { parseBigIntId } = require('../lib/parse');
const {
  createSupplierSchema,
  updateSupplierSchema,
  addProductToSupplierSchema,
} = require('../schemas/supplier.schema');
const supplierService = require('../services/supplier.service');

const router = express.Router();
router.use(authenticate);

router.get('/company', authorizeAccessPolicy('supplier.view'), async (req, res, next) => {
  try {
    return res.json(await supplierService.listSuppliers(req.auth));
  } catch (error) {
    return next(error);
  }
});

router.post('/company', authorizeAccessPolicy('supplier.manage'), validate(createSupplierSchema), async (req, res, next) => {
  try {
    return res.status(201).json(await supplierService.createSupplier(req.body, req.auth));
  } catch (error) {
    return next(error);
  }
});

router.get('/company/:id', authorizeAccessPolicy('supplier.view'), async (req, res, next) => {
  try {
    return res.json(await supplierService.getSupplier(parseBigIntId(req.params.id), req.auth));
  } catch (error) {
    return next(error);
  }
});

router.put('/company/:id', authorizeAccessPolicy('supplier.manage'), validate(updateSupplierSchema), async (req, res, next) => {
  try {
    return res.json(await supplierService.updateSupplier(parseBigIntId(req.params.id), req.body, req.auth));
  } catch (error) {
    return next(error);
  }
});

router.delete('/company/:id', authorizeAccessPolicy('supplier.manage'), async (req, res, next) => {
  try {
    await supplierService.deleteSupplier(parseBigIntId(req.params.id), req.auth);
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});

router.post('/company/:id/products', authorizeAccessPolicy('supplier.manage'), validate(addProductToSupplierSchema), async (req, res, next) => {
  try {
    return res.status(201).json(await supplierService.addProduct(parseBigIntId(req.params.id), req.body, req.auth));
  } catch (error) {
    return next(error);
  }
});

router.delete('/company/:id/products/:productId', authorizeAccessPolicy('supplier.manage'), async (req, res, next) => {
  try {
    await supplierService.removeProduct(parseBigIntId(req.params.id), parseBigIntId(req.params.productId, 'productId'), req.auth);
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
