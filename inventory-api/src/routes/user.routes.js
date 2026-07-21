const express = require('express');

const authenticate = require('../middlewares/authenticate');
const { authorizeAccessPolicy } = require('../security/access-policies');
const validate = require('../middlewares/validate');
const { parsePaginationQuery } = require('../lib/pagination');
const { createUserSchema, createCompanyUserSchema } = require('../schemas/user.schema');
const userService = require('../services/user.service');

const router = express.Router();
router.use(authenticate);

router.get('/', authorizeAccessPolicy('user.list-global'), async (req, res, next) => {
  try {
    const users = await userService.listUsers(parsePaginationQuery(req.query));
    return res.json(users);
  } catch (error) {
    return next(error);
  }
});

router.get('/company', authorizeAccessPolicy('user.list-company'), async (req, res, next) => {
  try {
    const users = await userService.listCompanyUsers(req.auth, parsePaginationQuery(req.query));
    return res.json(users);
  } catch (error) {
    return next(error);
  }
});

router.post('/company', authorizeAccessPolicy('user.create-company'), validate(createCompanyUserSchema), async (req, res, next) => {
  try {
    const user = await userService.registerCompanyUser(req.body, req.auth, req);
    return res.status(201).json(user);
  } catch (error) {
    return next(error);
  }
});

router.post('/', authorizeAccessPolicy('user.create-global'), validate(createUserSchema), async (req, res, next) => {
  try {
    const user = await userService.registerUser(req.body, req);
    return res.status(201).json(user);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
