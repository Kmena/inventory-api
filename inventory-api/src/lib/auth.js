const jwt = require('jsonwebtoken');
const { jwtSecret, jwtExpiresIn } = require('../config');

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id.toString(),
      username: user.username,
      role: user.role?.code || null,
      companyId: user.companyId ? user.companyId.toString() : null,
    },
    jwtSecret,
    { expiresIn: jwtExpiresIn }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, jwtSecret);
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
};
