const express = require('express');

const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
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
router.use(authorize('admin', 'sales_supervisor'));

router.get('/company', async (req, res, next) => {
  try {
    const data = await salesRouteService.listCompanyRoutes(req.auth);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
});

router.post('/company', validate(saveSalesRouteSchema), async (req, res, next) => {
  try {
    const data = await salesRouteService.createCompanyRoute(req.body, req.auth);
    return res.status(201).json(data);
  } catch (error) {
    return next(error);
  }
});

router.get('/company/:routeId', async (req, res, next) => {
  try {
    const data = await salesRouteService.getCompanyRouteDetail(parseBigIntId(req.params.routeId, 'routeId'), req.auth);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
});

router.put('/company/:routeId', validate(saveSalesRouteSchema), async (req, res, next) => {
  try {
    const data = await salesRouteService.updateCompanyRoute(parseBigIntId(req.params.routeId, 'routeId'), req.body, req.auth);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
});

router.put('/company/:routeId/subzones', validate(saveSalesRouteSubzonesSchema), async (req, res, next) => {
  try {
    const data = await salesRouteService.saveCompanyRouteSubzones(parseBigIntId(req.params.routeId, 'routeId'), req.body, req.auth);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
});

router.delete('/company/:routeId/subzones/:subzoneId', async (req, res, next) => {
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

router.put('/company/:routeId/assignments', validate(saveSalesRouteAssignmentsSchema), async (req, res, next) => {
  try {
    const data = await salesRouteService.saveCompanyRouteAssignments(parseBigIntId(req.params.routeId, 'routeId'), req.body, req.auth);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
});

router.put('/company/agents/:userId/goals', validate(saveSalesRouteGoalsSchema), async (req, res, next) => {
  try {
    const data = await salesRouteService.saveCompanyRouteAgentGoals(parseBigIntId(req.params.userId, 'userId'), req.body, req.auth);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

