const { createHttpError } = require('../lib/errors');

function getActorUserId(auth) {
  return auth?.sub ? BigInt(auth.sub) : null;
}

function hasAnyPermission(auth, permissions) {
  const userPermissions = auth?.permissions || [];
  return permissions.some((permission) => userPermissions.includes(permission));
}

function assertHasAnyPermission(auth, permissions, message = 'No tiene permisos para esta accion') {
  if (!hasAnyPermission(auth, permissions)) {
    throw createHttpError(403, message, 'forbidden');
  }
}

function assertLifecycleStatusAllowed(currentStatus, allowedStatuses, message) {
  if (!allowedStatuses.includes(currentStatus)) {
    throw createHttpError(409, message, 'conflict');
  }
}

module.exports = {
  getActorUserId,
  hasAnyPermission,
  assertHasAnyPermission,
  assertLifecycleStatusAllowed,
};
