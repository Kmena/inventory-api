const express = require('express');

const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const geocodingService = require('../services/geocoding.service');

const router = express.Router();
router.use(authenticate);

router.get('/search', authorize('admin', 'sales'), async (req, res, next) => {
  try {
    const places = await geocodingService.searchPlaces(req.query.q);
    return res.json(places);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
