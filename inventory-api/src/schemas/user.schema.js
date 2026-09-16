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

const createCompanyUserSchema = z.object({
  fullName: z.string().min(2).max(255),
  email: z.string().email().optional(),
  username: z.string().min(3).max(100),
  password: z.string().min(8).max(100),
  phone: z.string().max(50).optional(),
  roleId: z.coerce.bigint(),
});

const updateCompanyUserSchema = z.object({
  fullName: z.string().min(2).max(255).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'Debe enviar al menos un campo para actualizar',
});

const assignCompanyUserRoleSchema = z.object({
  roleId: z.coerce.bigint(),
});

module.exports = {
  createUserSchema,
  createCompanyUserSchema,
  updateCompanyUserSchema,
  assignCompanyUserRoleSchema,
};
