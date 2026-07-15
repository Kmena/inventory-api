const { createHttpError } = require('../lib/errors');

function authorizePermission(...allowedPermissions) {
  return (req, _res, next) => {
    const userPermissions = req.auth?.permissions || [];
    const hasPermission = allowedPermissions.some((permission) => userPermissions.includes(permission));

    if (!hasPermission) {
      return next(createHttpError(403, 'No tiene permisos para esta accion', 'forbidden'));
    }

    return next();
  };
}

module.exports = authorizePermission;
