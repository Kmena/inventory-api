const express = require('express');

const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const validate = require('../middlewares/validate');
const { createUserSchema } = require('../schemas/user.schema');
const userService = require('../services/user.service');

const router = express.Router();
router.use(authenticate);

router.get('/', authorize('admin'), async (_req, res, next) => {
  try {
    const users = await userService.listUsers();
    return res.json(users);
  } catch (error) {
    return next(error);
  }
});

router.post('/', authorize('admin'), validate(createUserSchema), async (req, res, next) => {
  try {
    const user = await userService.registerUser(req.body);
    return res.status(201).json(user);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
