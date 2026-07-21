const express = require('express');

const validate = require('../middlewares/validate');
const authenticate = require('../middlewares/authenticate');
const { enforceLoginThrottle, registerLoginThrottleResult } = require('../middlewares/login-throttle');
const { loginSchema } = require('../schemas/auth.schema');
const authService = require('../services/auth.service');

const router = express.Router();

router.post('/login', enforceLoginThrottle, validate(loginSchema), async (req, res, next) => {
  try {
    const result = await authService.login(req.body, req);
    registerLoginThrottleResult(req, { successful: true });
    return res.json(result);
  } catch (error) {
    registerLoginThrottleResult(req, { successful: false, errorCode: error?.code || null });
    return next(error);
  }
});

router.get('/me', authenticate, (req, res) => {
  return res.json(req.auth);
});

module.exports = router;
