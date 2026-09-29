const { z } = require('zod');

const updateFiscalActivitySchema = z.object({
  billingEnabled: z.boolean(),
}).strict();

const setDefaultFiscalActivitySchema = z.object({
  code: z.string().trim().min(1),
}).strict();

module.exports = {
  updateFiscalActivitySchema,
  setDefaultFiscalActivitySchema,
};
