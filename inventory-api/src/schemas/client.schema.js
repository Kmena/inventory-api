const { z } = require('zod');

const createClientSchema = z.object({
  companyId: z.coerce.bigint(),
  regionId: z.coerce.bigint().optional().nullable(),
  code: z.string().max(50).optional(),
  name: z.string().min(2).max(255),
  legalId: z.string().max(100).optional(),
  documentType: z.string().max(50).optional(),
  emailBilling: z.string().email().optional(),
  emailCourtesy: z.string().email().optional(),
  phone: z.string().max(50).optional(),
  address: z.string().max(1000).optional(),
  province: z.string().max(120).optional(),
  canton: z.string().max(120).optional(),
  district: z.string().max(120).optional(),
  paymentType: z.enum(['CASH', 'CREDIT', 'TRANSFER', 'CARD']).optional(),
  paymentDays: z.number().int().min(0).optional(),
  creditLimit: z.number().min(0).optional(),
  creditBalance: z.number().min(0).optional(),
});

const updateClientSchema = createClientSchema.partial();

module.exports = { createClientSchema, updateClientSchema };
