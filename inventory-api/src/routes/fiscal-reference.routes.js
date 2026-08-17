const express = require('express');

const authenticate = require('../middlewares/authenticate');
const { authorizeAccessPolicy } = require('../security/access-policies');
const fiscalReferenceService = require('../services/fiscal-reference.service');

const router = express.Router();
router.use(authenticate);

router.get('/', authorizeAccessPolicy('receipt.view'), async (req, res, next) => {
  try {
    return res.json(await fiscalReferenceService.listAllFiscalReferences(req.auth));
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
