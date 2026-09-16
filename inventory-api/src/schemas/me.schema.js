const { z } = require('zod');

const changeOwnPasswordSchema = z.object({
  currentPassword: z.string().min(1, 'La contraseña actual es requerida').max(100),
  newPassword: z.string().min(8, 'La nueva contraseña debe tener al menos 8 caracteres').max(100),
});

module.exports = {
  changeOwnPasswordSchema,
};
