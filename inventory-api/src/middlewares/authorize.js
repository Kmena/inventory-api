const { createHttpError } = require('../lib/errors');
const audit = require('../lib/audit');

function authorize(...allowedRoles) {
  return async (req, _res, next) => {
    const userRole = req.auth?.role;
    if (!userRole) {
      await audit.recordAuditEventSafelyIfAvailable({
        req,
        action: 'security.authorization.role',
        resourceType: 'request',
        outcome: 'REJECTED',
        reasonCode: 'missing_role',
        metadata: { allowedRoles },
      });
      return next(createHttpError(403, 'Rol no disponible en el token', 'forbidden'));
    }

    if (!allowedRoles.includes(userRole)) {
      await audit.recordAuditEventSafelyIfAvailable({
        req,
        action: 'security.authorization.role',
        resourceType: 'request',
        outcome: 'REJECTED',
        reasonCode: 'role_denied',
        metadata: {
          allowedRoles,
          role: userRole,
        },
      });
      return next(createHttpError(403, 'No tiene permisos para esta acción', 'forbidden'));
    }

    return next();
  };
}

module.exports = authorize;
