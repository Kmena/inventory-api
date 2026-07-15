const { verifyAccessToken } = require('../lib/auth');
const userRepository = require('../repositories/user.repository');
const { createHttpError } = require('../lib/errors');

function mapPermissions(role) {
  return role?.rolePermissions
    ?.filter((item) => item.isEnabled && item.permission?.isActive)
    .map((item) => item.permission.code) || [];
}

async function authenticate(req, _res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(createHttpError(401, 'Token no enviado', 'unauthorized'));
  }

  const token = header.slice(7);

  try {
    const claims = verifyAccessToken(token);
    const userId = claims?.sub ? BigInt(claims.sub) : null;
    if (!userId) {
      return next(createHttpError(401, 'Token invalido o expirado', 'unauthorized'));
    }

    const user = await userRepository.findAuthenticatedUserById(userId);
    if (!user) {
      return next(createHttpError(401, 'Usuario no encontrado para este token', 'unauthorized'));
    }
    if (user.status !== 'ACTIVE') {
      return next(createHttpError(403, 'Usuario inactivo o bloqueado', 'forbidden'));
    }
    if (user.role?.isActive === false) {
      return next(createHttpError(403, 'Rol inactivo', 'forbidden'));
    }
    if (user.company && user.company.isActive === false) {
      return next(createHttpError(403, 'Empresa inactiva', 'forbidden'));
    }

    req.auth = {
      sub: user.id.toString(),
      username: user.username,
      role: user.role?.code || null,
      permissions: mapPermissions(user.role),
      companyId: user.companyId ? user.companyId.toString() : null,
    };
    return next();
  } catch (_error) {
    return next(createHttpError(401, 'Token invalido o expirado', 'unauthorized'));
  }
}

module.exports = authenticate;
