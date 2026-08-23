const { z } = require('zod');

const createCompanyRoleSchema = z.object({
  name: z.string().min(2).max(255),
  permissionCodes: z.array(z.string().min(2).max(100)).min(1),
});

const updateCompanyRoleSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  permissionCodes: z.array(z.string().min(2).max(100)).min(1),
});

module.exports = {
  createCompanyRoleSchema,
  updateCompanyRoleSchema,
};
