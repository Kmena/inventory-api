const express = require('express');

const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const validate = require('../middlewares/validate');
const { createCompanySchema } = require('../schemas/company.schema');
const companyService = require('../services/company.service');

const router = express.Router();
router.use(authenticate);

router.get('/', authorize('admin'), async (_req, res, next) => {
  try {
    const companies = await companyService.listCompanies();
    return res.json(companies);
  } catch (error) {
    return next(error);
  }
});

router.post('/', authorize('admin'), validate(createCompanySchema), async (req, res, next) => {
  try {
    const company = await companyService.registerCompany(req.body);
    return res.status(201).json(company);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
