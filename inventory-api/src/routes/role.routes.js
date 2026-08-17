const express = require('express');

const authenticate = require('../middlewares/authenticate');
const { authorizeAccessPolicy } = require('../security/access-policies');
const validate = require('../middlewares/validate');
const { parsePaginationQuery } = require('../lib/pagination');
const { createCompanyRoleSchema, updateCompanyRoleSchema } = require('../schemas/role.schema');
const roleService = require('../services/role.service');

const router = express.Router();
router.use(authenticate);

router.get('/permissions', authorizeAccessPolicy('role.permissions.list'), async (req, res, next) => {
  try {
    const permissions = await roleService.listPermissions(req.auth);
    return res.json(permissions);
  } catch (error) {
    return next(error);
  }
});

router.get('/company', authorizeAccessPolicy('role.company.list'), async (req, res, next) => {
  try {
    const roles = await roleService.listAssignableRoles(req.auth, parsePaginationQuery(req.query));
    return res.json(roles);
  } catch (error) {
    return next(error);
  }
});

router.post('/company', authorizeAccessPolicy('role.company.create'), validate(createCompanyRoleSchema), async (req, res, next) => {
  try {
    const role = await roleService.createCompanyRole(req.body, req.auth, req);
    return res.status(201).json(role);
  } catch (error) {
    return next(error);
  }
});

router.put('/company/:roleId', authorizeAccessPolicy('role.company.update'), validate(updateCompanyRoleSchema), async (req, res, next) => {
  try {
    const role = await roleService.updateCompanyRole(req.params.roleId, req.body, req.auth, req);
    return res.json(role);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
