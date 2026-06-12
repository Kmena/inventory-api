const { z } = require('zod');

const createClientSchema = z.object({
  companyId: z.coerce.bigint(),
  regionId: z.coerce.bigint().optional().nullable(),
  code: z.string().max(50).optional(),
  name: z.string().min(2).max(255),
  legalName: z.string().min(2).max(255).optional(),
  commercialName: z.string().max(255).optional(),
  legalId: z.string().max(100).optional(),
  documentType: z.string().max(50).optional(),
  economicActivityCode: z.string().max(20).optional(),
  economicActivityName: z.string().max(255).optional(),
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
const createCompanyClientSchema = createClientSchema.omit({ companyId: true });

const createClientStoreSchema = z.object({
  regionId: z.coerce.bigint().optional().nullable(),
  subregionId: z.coerce.bigint(),
  code: z.string().trim().max(50).optional(),
  name: z.string().trim().min(2).max(255),
  phone: z.string().trim().max(50).optional(),
  address: z.string().trim().max(1000).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  province: z.string().trim().max(120).optional(),
  canton: z.string().trim().max(120).optional(),
  district: z.string().trim().max(120).optional(),
});

module.exports = {
  createClientSchema,
  updateClientSchema,
  createCompanyClientSchema,
  createClientStoreSchema,
};
