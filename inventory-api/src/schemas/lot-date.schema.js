const { z } = require('zod');

const LOT_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const LOT_DATE_MESSAGE = 'La fecha debe usar el formato YYYY-MM-DD o un datetime ISO valido.';

const optionalLotDateSchema = z.union([
  z.string().regex(LOT_DATE_PATTERN, LOT_DATE_MESSAGE),
  z.string().datetime(),
]).optional().nullable();

module.exports = {
  LOT_DATE_PATTERN,
  LOT_DATE_MESSAGE,
  optionalLotDateSchema,
};
