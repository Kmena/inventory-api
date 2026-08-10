const express = require('express');

const authenticate = require('../middlewares/authenticate');
const { authorizeAccessPolicy } = require('../security/access-policies');
const {
  LOOKUP_THROTTLE_WINDOW_MS,
  GEOCODING_THROTTLE_MAX_REQUESTS,
  createRequestThrottle,
} = require('../middlewares/request-throttle');
const geocodingService = require('../services/geocoding.service');

const geocodingLookupThrottle = createRequestThrottle({
  scope: 'geocoding.lookup',
  maxRequests: GEOCODING_THROTTLE_MAX_REQUESTS,
  windowMs: LOOKUP_THROTTLE_WINDOW_MS,
  message: 'Demasiadas consultas de geocodificación en poco tiempo. Intente de nuevo más tarde.',
});

const router = express.Router();
router.use(authenticate);

router.get('/search', authorizeAccessPolicy('integration.geocoding.search'), geocodingLookupThrottle, async (req, res, next) => {
  try {
    const places = await geocodingService.searchPlaces(req.query.q);
    return res.json(places);
  } catch (error) {
    return next(error);
  }
});

router.get('/reverse', authorizeAccessPolicy('integration.geocoding.reverse'), geocodingLookupThrottle, async (req, res, next) => {
  try {
    const result = await geocodingService.reverseGeocode(req.query.lat, req.query.lon);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
