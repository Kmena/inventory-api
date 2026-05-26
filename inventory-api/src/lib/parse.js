const { createHttpError } = require('./errors');

function parseBigIntId(value, fieldName = 'id') {
  try {
    return BigInt(value);
  } catch (_error) {
    throw createHttpError(400, `${fieldName} inválido`, 'validation_error');
  }
}

module.exports = {
  parseBigIntId,
};
