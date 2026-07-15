const express = require('express');

const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const taxpayerService = require('../services/taxpayer.service');

const router = express.Router();
router.use(authenticate);

router.get('/lookup', authorize('admin', 'sales'), async (req, res, next) => {
  try {
    const taxpayer = await taxpayerService.lookupTaxpayer({
      identification: req.query.identification?.toString() || '',
      documentType: req.query.documentType?.toString(),
    });
    return res.json(taxpayer);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
