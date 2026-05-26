const { createHttpError } = require('../lib/errors');

function authorize(...allowedRoles) {
  return (req, _res, next) => {
    const userRole = req.auth?.role;
    if (!userRole) {
      return next(createHttpError(403, 'Rol no disponible en el token', 'forbidden'));
    }

    if (!allowedRoles.includes(userRole)) {
      return next(createHttpError(403, 'No tiene permisos para esta acción', 'forbidden'));
    }

    return next();
  };
}

module.exports = authorize;
