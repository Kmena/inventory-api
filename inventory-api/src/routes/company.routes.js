const express = require('express');

const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const validate = require('../middlewares/validate');
const { parseBigIntId } = require('../lib/parse');
const {
  createCompanySchema,
  createRootCompanySchema,
  updateRootCompanyStatusSchema,
} = require('../schemas/company.schema');
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

router.get('/root/companies', authorize('root'), async (req, res, next) => {
  try {
    const companies = await companyService.listCompaniesForRoot(req.auth);
    return res.json(companies);
  } catch (error) {
    return next(error);
  }
});

router.get('/root/dashboard', authorize('admin'), async (req, res, next) => {
  try {
    const dashboard = await companyService.getExecutiveDashboard(req.auth);
    return res.json(dashboard);
  } catch (error) {
    return next(error);
  }
});

router.patch(
  '/root/companies/:companyId/status',
  authorize('root'),
  validate(updateRootCompanyStatusSchema),
  async (req, res, next) => {
    try {
      const companyId = parseBigIntId(req.params.companyId, 'companyId');
      const company = await companyService.updateRootCompanyStatus(companyId, req.body, req.auth, req);
      return res.json(company);
    } catch (error) {
      return next(error);
    }
  }
);

router.post('/', authorize('admin'), validate(createCompanySchema), async (req, res, next) => {
  try {
    const company = await companyService.registerCompany(req.body, req);
    return res.status(201).json(company);
  } catch (error) {
    return next(error);
  }
});

router.post('/root/companies', authorize('root'), validate(createRootCompanySchema), async (req, res, next) => {
  try {
    const company = await companyService.registerRootCompany(req.body, req.auth, req);
    return res.status(201).json(company);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
