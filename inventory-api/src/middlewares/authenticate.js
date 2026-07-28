const { verifyAccessToken } = require('../lib/auth');
const userRepository = require('../repositories/user.repository');
const { createHttpError } = require('../lib/errors');
const audit = require('../lib/audit');
const { attachAuthenticatedActor } = require('../lib/request-context');
const browserSessionService = require('../services/browser-session.service');
const { readBrowserSessionIdFromRequest } = require('../lib/browser-session');

function mapPermissions(role) {
  return role?.rolePermissions
    ?.filter((item) => item.isEnabled && item.permission?.isActive)
    .map((item) => item.permission.code) || [];
}

async function rejectAuthentication(req, next, message, reasonCode, statusCode = 401, metadata = null) {
  await audit.recordAuditEventSafelyIfAvailable({
    req,
    action: 'security.authentication',
    resourceType: 'request',
    outcome: 'REJECTED',
    reasonCode,
    metadata,
  });
  return next(createHttpError(statusCode, message, statusCode === 401 ? 'unauthorized' : 'forbidden'));
}

function buildAuthenticatedContext(user) {
  return {
    sub: user.id.toString(),
    username: user.username,
    role: user.role?.code || null,
    permissions: mapPermissions(user.role),
    companyId: user.companyId ? user.companyId.toString() : null,
  };
}

function buildBrowserSessionUser(user) {
  return {
    id: user.id.toString(),
    fullName: user.fullName,
    username: user.username,
    companyId: user.companyId ? user.companyId.toString() : null,
    role: {
      code: user.role?.code || null,
    },
    permissions: mapPermissions(user.role),
  };
}

async function validateAuthenticatedUser(req, next, user, metadata = {}) {
  if (!user) {
    return rejectAuthentication(req, next, 'Usuario no encontrado para este token', 'token_user_not_found', 401, metadata);
  }
  if (user.status !== 'ACTIVE') {
    return rejectAuthentication(req, next, 'Usuario inactivo o bloqueado', 'user_inactive', 403, {
      userId: user.id,
      username: user.username,
      ...metadata,
    });
  }
  if (user.role?.isActive === false) {
    return rejectAuthentication(req, next, 'Rol inactivo', 'role_inactive', 403, {
      userId: user.id,
      username: user.username,
      roleCode: user.role?.code || null,
      ...metadata,
    });
  }
  if (user.company && user.company.isActive === false) {
    return rejectAuthentication(req, next, 'Empresa inactiva', 'company_inactive', 403, {
      userId: user.id,
      username: user.username,
      companyId: user.companyId,
      ...metadata,
    });
  }

  req.auth = buildAuthenticatedContext(user);
  req.browserSessionUser = buildBrowserSessionUser(user);
  attachAuthenticatedActor(req, req.auth);
  return null;
}

function isStateChangingMethod(method) {
  return !['GET', 'HEAD', 'OPTIONS'].includes(String(method || '').toUpperCase());
}

function isValidCookieOrigin(req) {
  const origin = String(req.headers.origin || '').trim();
  if (!origin) {
    return false;
  }

  const requestOrigin = `${req.protocol}://${req.get('host')}`;
  return origin === requestOrigin;
}

async function authenticate(req, _res, next) {
  const header = req.headers.authorization;
  const browserSessionId = readBrowserSessionIdFromRequest(req);

  if (header && header.startsWith('Bearer ')) {
    const token = header.slice(7);

    try {
      const claims = verifyAccessToken(token);
      const userId = claims?.sub ? BigInt(claims.sub) : null;
      if (!userId) {
        return rejectAuthentication(req, next, 'Token invalido o expirado', 'invalid_token', 401);
      }

      const user = await userRepository.findAuthenticatedUserById(userId);
      const validationError = await validateAuthenticatedUser(req, next, user, {
        tokenSubject: claims?.sub || null,
      });
      if (validationError) {
        return validationError;
      }
      req.authMethod = 'bearer';
      return next();
    } catch (_error) {
      return rejectAuthentication(req, next, 'Token invalido o expirado', 'invalid_token', 401);
    }
  }

  if (!browserSessionId) {
    return rejectAuthentication(req, next, 'Token no enviado', 'missing_token', 401, {
      hasAuthorizationHeader: Boolean(header),
    });
  }

  const browserSession = await browserSessionService.getBrowserSession(browserSessionId, { req });
  if (!browserSession) {
    return rejectAuthentication(req, next, 'Sesion invalida o expirada', 'invalid_browser_session', 401);
  }

  const user = await userRepository.findAuthenticatedUserById(BigInt(browserSession.userId));
  const validationError = await validateAuthenticatedUser(req, next, user, {
    browserSessionId,
  });
  if (validationError) {
    return validationError;
  }

  req.authMethod = 'cookie-session';
  req.browserSessionId = browserSessionId;
  req.browserSessionExpiresAt = browserSession.expiresAt;
  if (isStateChangingMethod(req.method) && !isValidCookieOrigin(req)) {
    return rejectAuthentication(req, next, 'Origen no permitido para sesion browser', 'invalid_origin', 403, {
      origin: req.headers.origin || null,
    });
  }
  return next();
}

module.exports = authenticate;
