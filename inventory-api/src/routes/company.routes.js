const express = require('express');

const authenticate = require('../middlewares/authenticate');
const { authorizeAccessPolicy } = require('../security/access-policies');
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

router.get('/', authorizeAccessPolicy('company.list-global'), async (req, res, next) => {
  try {
    const companies = await companyService.listCompanies(req.auth);
    return res.json(companies);
  } catch (error) {
    return next(error);
  }
});

router.get('/root/companies', authorizeAccessPolicy('company.root-companies.list'), async (req, res, next) => {
  try {
    const companies = await companyService.listCompaniesForRoot(req.auth);
    return res.json(companies);
  } catch (error) {
    return next(error);
  }
});

async function handleExecutiveDashboard(req, res, next) {
  try {
    const dashboard = await companyService.getExecutiveDashboard(req.auth);
    return res.json(dashboard);
  } catch (error) {
    return next(error);
  }
}

router.get('/root/dashboard', authorizeAccessPolicy('company.dashboard'), handleExecutiveDashboard);
router.get('/company/dashboard', authorizeAccessPolicy('company.dashboard'), handleExecutiveDashboard);

router.patch(
  '/root/companies/:companyId/status',
  authorizeAccessPolicy('company.root-companies.update-status'),
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

router.post('/', authorizeAccessPolicy('company.list-global'), validate(createCompanySchema), async (req, res, next) => {
  try {
    const company = await companyService.registerCompany(req.body, req.auth, req);
    return res.status(201).json(company);
  } catch (error) {
    return next(error);
  }
});

router.post('/root/companies', authorizeAccessPolicy('company.root-companies.create'), validate(createRootCompanySchema), async (req, res, next) => {
  try {
    const company = await companyService.registerRootCompany(req.body, req.auth, req);
    return res.status(201).json(company);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
