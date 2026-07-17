const { createHttpError } = require('../lib/errors');
const audit = require('../lib/audit');

function authorizePermission(...allowedPermissions) {
  return async (req, _res, next) => {
    const userPermissions = req.auth?.permissions || [];
    const hasPermission = allowedPermissions.some((permission) => userPermissions.includes(permission));

    if (!hasPermission) {
      await audit.recordAuditEventSafelyIfAvailable({
        req,
        action: 'security.authorization.permission',
        resourceType: 'request',
        outcome: 'REJECTED',
        reasonCode: 'permission_denied',
        metadata: {
          allowedPermissions,
          userPermissions,
        },
      });
      return next(createHttpError(403, 'No tiene permisos para esta accion', 'forbidden'));
    }

    return next();
  };
}

module.exports = authorizePermission;
