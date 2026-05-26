const express = require('express');

const validate = require('../middlewares/validate');
const authenticate = require('../middlewares/authenticate');
const { loginSchema } = require('../schemas/auth.schema');
const authService = require('../services/auth.service');

const router = express.Router();

router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

router.get('/me', authenticate, (req, res) => {
  return res.json(req.auth);
});

module.exports = router;
