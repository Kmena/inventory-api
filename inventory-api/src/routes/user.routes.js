const express = require('express');

const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const validate = require('../middlewares/validate');
const { parsePaginationQuery } = require('../lib/pagination');
const { createUserSchema, createCompanyUserSchema } = require('../schemas/user.schema');
const userService = require('../services/user.service');

const router = express.Router();
router.use(authenticate);

router.get('/', authorize('root'), async (req, res, next) => {
  try {
    const users = await userService.listUsers(parsePaginationQuery(req.query));
    return res.json(users);
  } catch (error) {
    return next(error);
  }
});

router.get('/company', authorize('admin'), async (req, res, next) => {
  try {
    const users = await userService.listCompanyUsers(req.auth, parsePaginationQuery(req.query));
    return res.json(users);
  } catch (error) {
    return next(error);
  }
});

router.post('/company', authorize('admin'), validate(createCompanyUserSchema), async (req, res, next) => {
  try {
    const user = await userService.registerCompanyUser(req.body, req.auth);
    return res.status(201).json(user);
  } catch (error) {
    return next(error);
  }
});

router.post('/', authorize('root'), validate(createUserSchema), async (req, res, next) => {
  try {
    const user = await userService.registerUser(req.body);
    return res.status(201).json(user);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
