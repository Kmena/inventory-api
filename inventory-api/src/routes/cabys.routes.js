const express = require('express');

const authenticate = require('../middlewares/authenticate');
const { authorizeAccessPolicy } = require('../security/access-policies');
const cabysCatalogService = require('../services/cabys-catalog.service');

const router = express.Router();
router.use(authenticate);

router.get('/search', authorizeAccessPolicy('product.update'), async (req, res, next) => {
  try {
    const result = await cabysCatalogService.fetchHaciendaCabys(req.query.query?.toString() || '');
    return res.json({ items: result.items });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
