const { z } = require('zod');

const loginSchema = z.object({
  username: z.string().min(3).max(100),
  password: z.string().min(8).max(100),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(8).max(100),
  newPassword: z.string().min(8).max(100),
}).refine(
  (data) => data.currentPassword !== data.newPassword,
  { message: 'La nueva contraseña debe ser diferente a la actual', path: ['newPassword'] },
);

module.exports = {
  loginSchema,
  changePasswordSchema,
};
