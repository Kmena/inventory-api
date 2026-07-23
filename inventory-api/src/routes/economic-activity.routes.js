const express = require('express');

const authenticate = require('../middlewares/authenticate');
const { authorizeAccessPolicy } = require('../security/access-policies');
const economicActivityService = require('../services/economic-activity.service');

const router = express.Router();
router.use(authenticate);

router.get('/', authorizeAccessPolicy('integration.economic-activities.list'), async (req, res) => {
  return res.json(economicActivityService.searchActivities(req.query.q));
});

module.exports = router;
