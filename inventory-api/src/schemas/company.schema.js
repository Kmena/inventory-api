const { z } = require('zod');

const createCompanySchema = z.object({
  name: z.string().min(2).max(255),
  legalId: z.string().max(100).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email().optional(),
  address: z.string().max(1000).optional(),
});

module.exports = {
  createCompanySchema,
};
