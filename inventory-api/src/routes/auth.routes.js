const express = require('express');

const validate = require('../middlewares/validate');
const authenticate = require('../middlewares/authenticate');
const { enforceLoginThrottle, registerLoginThrottleResult } = require('../middlewares/login-throttle');
const { loginSchema, changePasswordSchema } = require('../schemas/auth.schema');
const authService = require('../services/auth.service');
const browserSessionService = require('../services/browser-session.service');
const {
  clearBrowserSessionCookies,
  setBrowserSessionCookies,
} = require('../lib/browser-session');

const router = express.Router();

function isBrowserSessionRequest(req) {
  return String(req.headers['x-inventory-browser-session'] || '').trim().toLowerCase() === 'cookie';
}

router.post('/login', enforceLoginThrottle, validate(loginSchema), async (req, res, next) => {
  try {
    const useBrowserSession = isBrowserSessionRequest(req);
    const result = await authService.login(req.body, req, {
      issueBrowserSession: useBrowserSession,
    });

    if (useBrowserSession) {
      setBrowserSessionCookies(res, req, result.browserSession.sessionId, result.browserSession.expiresAt, result.user);
      await registerLoginThrottleResult(req, { successful: true });
      return res.json({
        user: result.user,
      });
    }

    await registerLoginThrottleResult(req, { successful: true });
    return res.json(result);
  } catch (error) {
    await registerLoginThrottleResult(req, { successful: false, errorCode: error?.code || null });
    return next(error);
  }
});

router.get('/me', authenticate, (req, res) => {
  if (req.authMethod === 'cookie-session') {
    setBrowserSessionCookies(res, req, req.browserSessionId, req.browserSessionExpiresAt, req.browserSessionUser);
  }
  return res.json(req.browserSessionUser);
});

router.post('/logout', authenticate, async (req, res, next) => {
  try {
    if (req.browserSessionId) {
      await browserSessionService.invalidateBrowserSession(req.browserSessionId, { req });
    }
    clearBrowserSessionCookies(res, req);
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});

/**
 * @deprecated Usar PATCH /api/me/password.
 *
 * Este endpoint está reemplazado por PATCH /api/me/password, que:
 *   - usa el verbo HTTP correcto (PATCH en lugar de POST),
 *   - devuelve 400 CURRENT_PASSWORD_INVALID en lugar de 401 cuando la contraseña actual es incorrecta,
 *   - acepta currentPassword de cualquier longitud (min 1 en lugar de min 8),
 *   - verifica same-as-current con bcrypt en lugar de comparación de texto.
 *
 * Se mantiene temporalmente para compatibilidad con clientes externos.
 * No lo usan los shells embebidos (root, warehouse, agent).
 */
router.post('/change-password', authenticate, validate(changePasswordSchema), async (req, res, next) => {
  try {
    res.setHeader('Deprecation', 'true');
    res.setHeader('Link', '</api/me/password>; rel="successor-version"');
    await authService.changePassword(req.auth.sub, req.body, req);
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
