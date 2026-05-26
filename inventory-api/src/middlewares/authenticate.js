const { verifyAccessToken } = require('../lib/auth');
const { createHttpError } = require('../lib/errors');

function authenticate(req, _res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(createHttpError(401, 'Token no enviado', 'unauthorized'));
  }

  const token = header.slice(7);

  try {
    req.auth = verifyAccessToken(token);
    return next();
  } catch (_error) {
    return next(createHttpError(401, 'Token inválido o expirado', 'unauthorized'));
  }
}

module.exports = authenticate;
