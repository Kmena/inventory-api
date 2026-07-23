const express = require('express');

const authenticate = require('../middlewares/authenticate');
const { authorizeAccessPolicy } = require('../security/access-policies');
const validate = require('../middlewares/validate');
const { parseBigIntId } = require('../lib/parse');
const {
  saveSalesRouteSchema,
  saveSalesRouteSubzonesSchema,
  saveSalesRouteAssignmentsSchema,
  saveSalesRouteGoalsSchema,
} = require('../schemas/sales-route.schema');
const salesRouteService = require('../services/sales-route.service');

const router = express.Router();
router.use(authenticate);

router.get('/company', authorizeAccessPolicy('sales-route.company.list'), async (req, res, next) => {
  try {
    const data = await salesRouteService.listCompanyRoutes(req.auth);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
});

router.post('/company', authorizeAccessPolicy('sales-route.company.create'), validate(saveSalesRouteSchema), async (req, res, next) => {
  try {
    const data = await salesRouteService.createCompanyRoute(req.body, req.auth);
    return res.status(201).json(data);
  } catch (error) {
    return next(error);
  }
});

router.get('/company/:routeId', authorizeAccessPolicy('sales-route.company.detail'), async (req, res, next) => {
  try {
    const data = await salesRouteService.getCompanyRouteDetail(parseBigIntId(req.params.routeId, 'routeId'), req.auth);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
});

router.put('/company/:routeId', authorizeAccessPolicy('sales-route.company.update'), validate(saveSalesRouteSchema), async (req, res, next) => {
  try {
    const data = await salesRouteService.updateCompanyRoute(parseBigIntId(req.params.routeId, 'routeId'), req.body, req.auth);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
});

router.put('/company/:routeId/subzones', authorizeAccessPolicy('sales-route.company.subzones.update'), validate(saveSalesRouteSubzonesSchema), async (req, res, next) => {
  try {
    const data = await salesRouteService.saveCompanyRouteSubzones(parseBigIntId(req.params.routeId, 'routeId'), req.body, req.auth);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
});

router.delete('/company/:routeId/subzones/:subzoneId', authorizeAccessPolicy('sales-route.company.subzones.delete'), async (req, res, next) => {
  try {
    const data = await salesRouteService.removeCompanyRouteSubzone(
      parseBigIntId(req.params.routeId, 'routeId'),
      parseBigIntId(req.params.subzoneId, 'subzoneId'),
      req.auth,
    );
    return res.json(data);
  } catch (error) {
    return next(error);
  }
});

router.put('/company/:routeId/assignments', authorizeAccessPolicy('sales-route.company.assignments.update'), validate(saveSalesRouteAssignmentsSchema), async (req, res, next) => {
  try {
    const data = await salesRouteService.saveCompanyRouteAssignments(parseBigIntId(req.params.routeId, 'routeId'), req.body, req.auth);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
});

router.put('/company/agents/:userId/goals', authorizeAccessPolicy('sales-route.company.goals.update'), validate(saveSalesRouteGoalsSchema), async (req, res, next) => {
  try {
    const data = await salesRouteService.saveCompanyRouteAgentGoals(parseBigIntId(req.params.userId, 'userId'), req.body, req.auth);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

