const express = require('express');

const authenticate = require('../middlewares/authenticate');
const { authorizeAccessPolicy } = require('../security/access-policies');
const {
  LOOKUP_THROTTLE_WINDOW_MS,
  TAXPAYER_THROTTLE_MAX_REQUESTS,
  createRequestThrottle,
} = require('../middlewares/request-throttle');
const taxpayerService = require('../services/taxpayer.service');

const taxpayerLookupThrottle = createRequestThrottle({
  scope: 'taxpayer.lookup',
  maxRequests: TAXPAYER_THROTTLE_MAX_REQUESTS,
  windowMs: LOOKUP_THROTTLE_WINDOW_MS,
  message: 'Demasiadas consultas tributarias en poco tiempo. Intente de nuevo más tarde.',
});

const router = express.Router();
router.use(authenticate);

router.get('/lookup', authorizeAccessPolicy('integration.taxpayer.lookup'), taxpayerLookupThrottle, async (req, res, next) => {
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
