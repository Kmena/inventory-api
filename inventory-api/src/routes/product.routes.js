const express = require('express');

const authenticate = require('../middlewares/authenticate');
const { authorizeAccessPolicy } = require('../security/access-policies');
const validate = require('../middlewares/validate');
const { parseBigIntId } = require('../lib/parse');
const { parsePaginationQuery } = require('../lib/pagination');
const { createProductSchema, updateProductSchema, importProductsSchema } = require('../schemas/product.schema');
const productService = require('../services/product.service');
const { highPayloadParsers } = require('../middlewares/request-payload');

const router = express.Router();
router.use(authenticate);

router.get('/', authorizeAccessPolicy('product.list'), async (req, res, next) => {
  try { return res.json(await productService.listProducts(req.auth, parsePaginationQuery(req.query))); } catch (error) { return next(error); }
});

router.get('/:id', authorizeAccessPolicy('product.detail'), async (req, res, next) => {
  try { return res.json(await productService.getProduct(parseBigIntId(req.params.id), req.auth)); } catch (error) { return next(error); }
});

router.post('/', authorizeAccessPolicy('product.create'), validate(createProductSchema), async (req, res, next) => {
  try { return res.status(201).json(await productService.createProduct(req.body, req.auth)); } catch (error) { return next(error); }
});

router.post('/import', ...highPayloadParsers, authorizeAccessPolicy('product.import'), validate(importProductsSchema), async (req, res, next) => {
  try {
    return res.status(200).json(await productService.importProducts(req.body.rows, req.auth));
  } catch (error) {
    return next(error);
  }
});

router.put('/:id', authorizeAccessPolicy('product.update'), validate(updateProductSchema), async (req, res, next) => {
  try { return res.json(await productService.updateProduct(parseBigIntId(req.params.id), req.body, req.auth)); } catch (error) { return next(error); }
});

router.delete('/:id', authorizeAccessPolicy('product.delete'), async (req, res, next) => {
  try {
    await productService.removeProduct(parseBigIntId(req.params.id), req.auth);
    return res.status(204).send();
  } catch (error) { return next(error); }
});

module.exports = router;
