const express = require('express');

const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const validate = require('../middlewares/validate');
const { parseBigIntId } = require('../lib/parse');
const { createProductSchema, updateProductSchema, importProductsSchema } = require('../schemas/product.schema');
const productService = require('../services/product.service');

const router = express.Router();
router.use(authenticate);

router.get('/', authorize('admin', 'sales', 'warehouse'), async (_req, res, next) => {
  try { return res.json(await productService.listProducts()); } catch (error) { return next(error); }
});

router.get('/:id', authorize('admin', 'sales', 'warehouse'), async (req, res, next) => {
  try { return res.json(await productService.getProduct(parseBigIntId(req.params.id))); } catch (error) { return next(error); }
});

router.post('/', authorize('admin', 'warehouse'), validate(createProductSchema), async (req, res, next) => {
  try { return res.status(201).json(await productService.createProduct(req.body)); } catch (error) { return next(error); }
});

router.post('/import', authorize('admin', 'warehouse'), validate(importProductsSchema), async (req, res, next) => {
  try {
    return res.status(200).json(await productService.importProducts(req.body.rows, req.auth));
  } catch (error) {
    return next(error);
  }
});

router.put('/:id', authorize('admin', 'warehouse'), validate(updateProductSchema), async (req, res, next) => {
  try { return res.json(await productService.updateProduct(parseBigIntId(req.params.id), req.body)); } catch (error) { return next(error); }
});

router.delete('/:id', authorize('admin'), async (req, res, next) => {
  try {
    await productService.removeProduct(parseBigIntId(req.params.id));
    return res.status(204).send();
  } catch (error) { return next(error); }
});

module.exports = router;
