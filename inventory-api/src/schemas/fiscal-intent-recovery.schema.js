'use strict';

const { z } = require('zod');

const recoverFinalFiscalIntentSchema = z.object({
  reason: z.string().trim().min(10).max(500),
});

module.exports = {
  recoverFinalFiscalIntentSchema,
};
