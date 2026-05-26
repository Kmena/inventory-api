const { z } = require('zod');

const createUserSchema = z.object({
  companyId: z.coerce.bigint().optional(),
  roleId: z.coerce.bigint().optional(),
  fullName: z.string().min(2).max(255),
  email: z.string().email().optional(),
  username: z.string().min(3).max(100),
  password: z.string().min(8).max(100),
  phone: z.string().max(50).optional(),
  status: z.number().int().min(0).max(9).optional(),
});

module.exports = {
  createUserSchema,
};
