const express = require('express');

const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const economicActivityService = require('../services/economic-activity.service');

const router = express.Router();
router.use(authenticate);

router.get('/', authorize('admin', 'sales'), async (req, res) => {
  return res.json(economicActivityService.searchActivities(req.query.q));
});

module.exports = router;
