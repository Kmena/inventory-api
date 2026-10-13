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

const fiscalIssuerSchema = z.object({
  legalName: z.string().trim().min(2).max(255).optional(),
  tradeName: z.string().trim().min(1).max(255).nullable().optional(),
  identificationType: z.enum(['FISICA', 'JURIDICA', 'DIMEX', 'NITE']).optional(),
  identificationNumber: z.string().trim().min(9).max(20).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'Indica al menos un dato del emisor');

const fiscalProfileSchema = z.object({
  economicActivityCode: z.string().trim().min(1).max(20),
  proveedorSistemas: z.string().trim().min(1).max(20).optional(),
  province: z.string().regex(/^\d$/),
  canton: z.string().regex(/^\d{2}$/),
  district: z.string().regex(/^\d{2}$/),
  barrio: z.string().trim().min(1).max(50).optional(),
  otrasSenas: z.string().trim().min(5).max(250),
  email: z.string().email().min(3).max(160),
  phoneCountryCode: z.string().regex(/^\d{1,3}$/).optional(),
  phoneNumber: z.string().regex(/^\d{4,20}$/).optional(),
}).strict();

const fiscalAdministrationUpdateSchema = z.object({
  issuer: fiscalIssuerSchema.optional(),
  profile: fiscalProfileSchema.optional(),
}).strict().refine((value) => value.issuer || value.profile, 'No hay cambios fiscales para guardar');

const fiscalAdministrationProvisionSchema = z.object({}).strict();

const fiscalBranchUpsertSchema = z.object({
  code: z.string().regex(/^\d{3}$/, 'El código de sucursal debe tener 3 dígitos'),
  name: z.string().trim().min(1).max(120).refine(hasNoControlCharacters, 'Nombre contiene caracteres no permitidos'),
}).strict();

const fiscalTerminalUpsertSchema = z.object({
  code: z.string().regex(/^\d{5}$/, 'El código de terminal debe tener 5 dígitos'),
  name: z.string().trim().min(1).max(120).refine(hasNoControlCharacters, 'Nombre contiene caracteres no permitidos'),
}).strict();

const fiscalActiveStateSchema = z.object({ active: z.boolean() }).strict();
const fiscalDefaultPointSchema = z.object({ terminalId: z.string().uuid() }).strict();
const fiscalSequenceReadSchema = z.object({
  terminalId: z.string().uuid(),
  documentType: z.enum(['INVOICE', 'TICKET']),
}).strict();
const fiscalInitialSequenceSchema = fiscalSequenceReadSchema.extend({
  nextValue: z.number().int().min(1).max(9_999_999_999),
  confirmed: z.literal(true),
}).strict();

const fiscalTestInvoiceSchema = z.object({
  idempotencyKey: z.string().uuid(),
  confirmed: z.literal(true),
  receiver: z.object({
    name: z.string().trim().min(2).max(160),
    identificationType: z.enum(['FISICA', 'JURIDICA', 'DIMEX', 'NITE']),
    identificationNumber: z.string().trim().min(9).max(20),
    email: z.string().email().max(160),
  }).strict(),
  currency: z.enum(['CRC', 'USD']),
  exchangeRate: z.string().regex(/^\d+(\.\d{1,5})?$/).optional(),
  saleCondition: z.string().regex(/^\d{2}$/),
  creditTermDays: z.number().int().min(1).max(99999).optional(),
  paymentMethod: z.string().regex(/^\d{2}$/).optional(),
  lines: z.array(z.object({
    lineNumber: z.number().int().min(1),
    cabysCode: z.string().regex(/^\d{13}$/),
    description: z.string().trim().min(1).max(200),
    unitMeasure: z.string().trim().min(1).max(20),
    quantity: z.string().regex(/^\d+(\.\d{1,5})?$/),
    unitPrice: z.string().regex(/^\d+(\.\d{1,5})?$/),
    taxAmount: z.string().regex(/^\d+(\.\d{1,5})?$/).optional(),
    taxCode: z.string().regex(/^\d{2}$/).optional(),
    taxRateCode: z.string().regex(/^\d{2}$/).optional(),
    taxRate: z.string().regex(/^\d+(\.\d{1,5})?$/).optional(),
  }).strict()).min(1).max(100),
}).strict();

module.exports = {
  updateFiscalActivitySchema,
  haciendaCredentialsSchema,
  setDefaultFiscalActivitySchema,
  fiscalAdministrationProvisionSchema,
  fiscalAdministrationUpdateSchema,
  fiscalBranchUpsertSchema,
  fiscalTerminalUpsertSchema,
  fiscalActiveStateSchema,
  fiscalDefaultPointSchema,
  fiscalSequenceReadSchema,
  fiscalInitialSequenceSchema,
  fiscalTestInvoiceSchema,
};
