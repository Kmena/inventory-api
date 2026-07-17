const { verifyAccessToken } = require('../lib/auth');
const userRepository = require('../repositories/user.repository');
const { createHttpError } = require('../lib/errors');
const audit = require('../lib/audit');
const { attachAuthenticatedActor } = require('../lib/request-context');

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

async function authenticate(req, _res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return rejectAuthentication(req, next, 'Token no enviado', 'missing_token', 401, {
      hasAuthorizationHeader: Boolean(header),
    });
  }

  const token = header.slice(7);

  try {
    const claims = verifyAccessToken(token);
    const userId = claims?.sub ? BigInt(claims.sub) : null;
    if (!userId) {
      return rejectAuthentication(req, next, 'Token invalido o expirado', 'invalid_token', 401);
    }

    const user = await userRepository.findAuthenticatedUserById(userId);
    if (!user) {
      return rejectAuthentication(req, next, 'Usuario no encontrado para este token', 'token_user_not_found', 401, {
        tokenSubject: claims?.sub || null,
      });
    }
    if (user.status !== 'ACTIVE') {
      return rejectAuthentication(req, next, 'Usuario inactivo o bloqueado', 'user_inactive', 403, {
        userId: user.id,
        username: user.username,
      });
    }
    if (user.role?.isActive === false) {
      return rejectAuthentication(req, next, 'Rol inactivo', 'role_inactive', 403, {
        userId: user.id,
        username: user.username,
        roleCode: user.role?.code || null,
      });
    }
    if (user.company && user.company.isActive === false) {
      return rejectAuthentication(req, next, 'Empresa inactiva', 'company_inactive', 403, {
        userId: user.id,
        username: user.username,
        companyId: user.companyId,
      });
    }

    req.auth = {
      sub: user.id.toString(),
      username: user.username,
      role: user.role?.code || null,
      permissions: mapPermissions(user.role),
      companyId: user.companyId ? user.companyId.toString() : null,
    };
    attachAuthenticatedActor(req, req.auth);
    return next();
  } catch (_error) {
    return rejectAuthentication(req, next, 'Token invalido o expirado', 'invalid_token', 401);
  }
}

module.exports = authenticate;
