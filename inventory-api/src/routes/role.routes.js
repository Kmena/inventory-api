const express = require('express');

const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const validate = require('../middlewares/validate');
const { parsePaginationQuery } = require('../lib/pagination');
const { createCompanyRoleSchema } = require('../schemas/role.schema');
const roleService = require('../services/role.service');

const router = express.Router();
router.use(authenticate);
router.use(authorize('admin'));

router.get('/permissions', async (req, res, next) => {
  try {
    const permissions = await roleService.listPermissions(req.auth);
    return res.json(permissions);
  } catch (error) {
    return next(error);
  }
});

router.get('/company', async (req, res, next) => {
  try {
    const roles = await roleService.listAssignableRoles(req.auth, parsePaginationQuery(req.query));
    return res.json(roles);
  } catch (error) {
    return next(error);
  }
});

router.post('/company', validate(createCompanyRoleSchema), async (req, res, next) => {
  try {
    const role = await roleService.createCompanyRole(req.body, req.auth, req);
    return res.status(201).json(role);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
