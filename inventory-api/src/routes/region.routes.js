const express = require('express');

const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const validate = require('../middlewares/validate');
const { createRegionSchema, createSubregionSchema } = require('../schemas/region.schema');
const regionService = require('../services/region.service');

const router = express.Router();
router.use(authenticate);
router.use(authorize('admin'));

router.get('/company', async (req, res, next) => {
  try {
    const regions = await regionService.listCompanyRegions(req.auth);
    return res.json(regions);
  } catch (error) {
    return next(error);
  }
});

router.post('/company', validate(createRegionSchema), async (req, res, next) => {
  try {
    const region = await regionService.createCompanyRegion(req.body, req.auth);
    return res.status(201).json(region);
  } catch (error) {
    return next(error);
  }
});

router.post('/company/:regionId/subregions', validate(createSubregionSchema), async (req, res, next) => {
  try {
    const subregion = await regionService.createCompanySubregion(BigInt(req.params.regionId), req.body, req.auth);
    return res.status(201).json(subregion);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
