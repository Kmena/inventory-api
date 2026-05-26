const dotenv = require('dotenv');

dotenv.config();

function getNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

module.exports = {
  port: getNumber(process.env.PORT, 2500),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:2500',
  bcryptRounds: getNumber(process.env.BCRYPT_ROUNDS, 12),
  jwtSecret: process.env.JWT_SECRET || 'change_this_super_secret_key',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
};
