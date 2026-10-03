const { z } = require('zod');

const updateFiscalActivitySchema = z.object({
  billingEnabled: z.boolean(),
}).strict();

function hasNoControlCharacters(value) {
  return !Array.from(value).some((character) => {
    const code = character.codePointAt(0);
    return code <= 31 || code === 127;
  });
}

const haciendaCredentialsSchema = z.object({
  username: z.string()
    .max(100)
    .refine(hasNoControlCharacters, 'Usuario Hacienda contiene caracteres no permitidos')
    .transform((value) => value.trim())
    .pipe(z.string().min(1, 'Usuario Hacienda requerido')),
  password: z.string()
    .min(1, 'Contraseña Hacienda requerida')
    .max(200)
    .refine(hasNoControlCharacters, 'Contraseña Hacienda contiene caracteres no permitidos'),
}).strict();

const setDefaultFiscalActivitySchema = z.object({
  code: z.string().trim().min(1),
}).strict();

module.exports = {
  updateFiscalActivitySchema,
  haciendaCredentialsSchema,
  setDefaultFiscalActivitySchema,
};
