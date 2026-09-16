/**
 * me.service.js — Operaciones sobre el usuario autenticado.
 *
 * El userId se obtiene exclusivamente de la identidad autenticada (req.auth.sub).
 * Nunca se acepta userId desde el body ni desde parámetros de ruta externos.
 *
 * SECURITY-TODO: Invalidar sesiones secundarias cuando exista soporte de
 * session/token versioning. Actualmente la sesión actual permanece activa
 * tras el cambio de contraseña por diseño (el backend no invalida otras sesiones).
 */

const bcrypt = require('bcrypt');

const { bcryptRounds } = require('../config');
const userRepository = require('../repositories/user.repository');
const { createHttpError } = require('../lib/errors');
const audit = require('../lib/audit');

/**
 * Cambia la contraseña del usuario autenticado.
 *
 * Errores de dominio (400):
 *   CURRENT_PASSWORD_INVALID  — contraseña actual incorrecta
 *   PASSWORD_SAME_AS_CURRENT  — nueva contraseña idéntica a la actual
 *
 * @param {string} userId   ID del usuario autenticado (req.auth.sub)
 * @param {{ currentPassword: string, newPassword: string }} payload
 * @param {import('express').Request | null} req   Para auditoría
 */
async function changeOwnPassword(userId, payload, req = null) {
  const user = await userRepository.findAuthenticatedUserById(BigInt(userId));
  if (!user) {
    throw createHttpError(404, 'Usuario no encontrado', 'not_found');
  }

  const isCurrentValid = await bcrypt.compare(payload.currentPassword, user.passwordHash);
  if (!isCurrentValid) {
    await audit.recordAuditEventIfAvailable({
      req,
      action: 'auth.change_password',
      resourceType: 'user',
      resourceId: user.id,
      outcome: 'REJECTED',
      reasonCode: 'invalid_credentials',
      metadata: { username: user.username },
    });
    throw createHttpError(400, 'La contraseña actual no es correcta.', 'CURRENT_PASSWORD_INVALID');
  }

  // Verificar que la nueva contraseña sea distinta a la actual.
  // Se compara contra el hash para no depender de comparación textual en caso de
  // que el usuario conozca su contraseña pero la haya escrito diferente con mayúsculas, etc.
  const isSameAsCurrentHash = await bcrypt.compare(payload.newPassword, user.passwordHash);
  if (isSameAsCurrentHash) {
    throw createHttpError(400, 'La nueva contraseña debe ser diferente a la actual.', 'PASSWORD_SAME_AS_CURRENT');
  }

  const newPasswordHash = await bcrypt.hash(payload.newPassword, bcryptRounds);
  await userRepository.updateUserPasswordHash(user.id, newPasswordHash);

  await audit.recordAuditEventIfAvailable({
    req,
    action: 'auth.change_password',
    resourceType: 'user',
    resourceId: user.id,
    outcome: 'SUCCESS',
    metadata: { username: user.username },
  });
}

module.exports = {
  changeOwnPassword,
};
