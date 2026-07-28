const bcrypt = require('bcrypt');

const userRepository = require('../repositories/user.repository');
const { signAccessToken } = require('../lib/auth');
const { createHttpError } = require('../lib/errors');
const audit = require('../lib/audit');
const { attachAuthenticatedActor } = require('../lib/request-context');
const browserSessionService = require('./browser-session.service');

function mapPermissions(role) {
  return role?.rolePermissions
    ?.filter((item) => item.isEnabled && item.permission?.isActive)
    .map((item) => item.permission.code) || [];
}

async function login(payload, req = null, options = {}) {
  const loginMetadata = {
    username: payload.username,
  };

  const user = await userRepository.findUserByUsernameWithRelations(payload.username);
  if (!user) {
    await audit.recordAuditEventIfAvailable({
      req,
      action: 'auth.login',
      resourceType: 'session',
      outcome: 'REJECTED',
      reasonCode: 'invalid_credentials',
      metadata: loginMetadata,
    });
    throw createHttpError(401, 'Usuario o contraseña inválidos', 'unauthorized');
  }

  const isValidPassword = await bcrypt.compare(payload.password, user.passwordHash);
  if (!isValidPassword) {
    await audit.recordAuditEventIfAvailable({
      req,
      action: 'auth.login',
      resourceType: 'session',
      resourceId: user.id,
      outcome: 'REJECTED',
      reasonCode: 'invalid_credentials',
      metadata: loginMetadata,
    });
    throw createHttpError(401, 'Usuario o contraseña inválidos', 'unauthorized');
  }

  if (user.status !== 'ACTIVE') {
    await audit.recordAuditEventIfAvailable({
      req,
      action: 'auth.login',
      resourceType: 'session',
      resourceId: user.id,
      outcome: 'REJECTED',
      reasonCode: 'user_inactive',
      metadata: loginMetadata,
    });
    throw createHttpError(403, 'Usuario inactivo o bloqueado', 'forbidden');
  }

  if (user.role && user.role.isActive === false) {
    await audit.recordAuditEventIfAvailable({
      req,
      action: 'auth.login',
      resourceType: 'session',
      resourceId: user.id,
      outcome: 'REJECTED',
      reasonCode: 'role_inactive',
      metadata: loginMetadata,
    });
    throw createHttpError(403, 'Rol inactivo', 'forbidden');
  }

  if (user.company && user.company.isActive === false) {
    await audit.recordAuditEventIfAvailable({
      req,
      action: 'auth.login',
      resourceType: 'session',
      resourceId: user.id,
      outcome: 'REJECTED',
      reasonCode: 'company_inactive',
      metadata: loginMetadata,
    });
    throw createHttpError(403, 'Empresa inactiva', 'forbidden');
  }

  const token = signAccessToken(user);
  const { passwordHash: _passwordHash, ...safeUser } = user;
  if (req) {
    attachAuthenticatedActor(req, {
      sub: user.id.toString(),
      username: user.username,
      role: user.role?.code || null,
      companyId: user.companyId ? user.companyId.toString() : null,
    });
  }

  await audit.recordAuditEventIfAvailable({
    req,
    action: 'auth.login',
    resourceType: 'session',
    resourceId: user.id,
    outcome: 'SUCCESS',
    metadata: loginMetadata,
    afterState: {
      userId: user.id,
      username: user.username,
      companyId: user.companyId,
      roleCode: user.role?.code || null,
      status: user.status,
    },
  });

  const serializedUser = {
    ...safeUser,
    permissions: mapPermissions(user.role),
  };

  if (options.issueBrowserSession === true) {
    const browserSession = await browserSessionService.createBrowserSession(user.id, { req });
    return {
      user: serializedUser,
      browserSession,
    };
  }

  return {
    token,
    user: serializedUser,
  };
}

module.exports = {
  login,
};
