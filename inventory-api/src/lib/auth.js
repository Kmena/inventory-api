const jwt = require('jsonwebtoken');
const { jwtSecret, jwtExpiresIn } = require('../config');

const ACCESS_TOKEN_ALGORITHM = 'HS256';
const ACCESS_TOKEN_ALGORITHMS = [ACCESS_TOKEN_ALGORITHM];

function signAccessToken(user) {
  const permissions = user.role?.rolePermissions
    ?.filter((item) => item.isEnabled && item.permission?.isActive)
    .map((item) => item.permission.code) || [];

  return jwt.sign(
    {
      sub: user.id.toString(),
      username: user.username,
      role: user.role?.code || null,
      permissions,
      companyId: user.companyId ? user.companyId.toString() : null,
    },
    jwtSecret,
    {
      algorithm: ACCESS_TOKEN_ALGORITHM,
      expiresIn: jwtExpiresIn,
    }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, jwtSecret, { algorithms: ACCESS_TOKEN_ALGORITHMS });
}

module.exports = {
  ACCESS_TOKEN_ALGORITHM,
  ACCESS_TOKEN_ALGORITHMS,
  signAccessToken,
  verifyAccessToken,
};
