const { z } = require('zod');
const { CLIENT_DOCUMENT_TYPES } = require('../lib/client-document-types');

const createClientSchema = z.object({
  companyId: z.coerce.bigint(),
  clientClassificationId: z.coerce.bigint().optional().nullable(),
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

const createCompanyClientSchema = createClientSchema.omit({ companyId: true });
const updateClientSchema = createCompanyClientSchema.partial();

const optionalDateSchema = z.preprocess(
  (value) => (value === '' || value === undefined || value === null ? undefined : value),
  z.coerce.date().optional(),
);

const createClientStoreRepresentativeSchema = z.object({
  fullName: z.string().trim().min(2).max(255),
  identificationNumber: z.string().trim().max(100).optional(),
  position: z.string().trim().max(120).optional(),
  role: z.string().trim().max(120).optional(),
  email: z.string().trim().email().optional(),
  phonePrimary: z.string().trim().max(50).optional(),
  phoneSecondary: z.string().trim().max(50).optional(),
  birthday: optionalDateSchema,
  importantDate: optionalDateSchema,
  importantDateType: z.string().trim().max(120).optional(),
  comment: z.string().trim().max(1000).optional(),
  isPrimaryContact: z.boolean().optional(),
});

const createClientStoreSchema = z.object({
  subregionId: z.coerce.bigint(),
  code: z.string().trim().max(50).optional(),
  name: z.string().trim().min(2).max(255),
  storeType: z.string().trim().max(120).optional(),
  locationReference: z.string().trim().max(1000).optional(),
  attentionSchedule: z.string().trim().max(500).optional(),
  phone: z.string().trim().max(50).optional(),
  address: z.string().trim().max(1000).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  province: z.string().trim().max(120).optional(),
  canton: z.string().trim().max(120).optional(),
  district: z.string().trim().max(120).optional(),
  representatives: z.array(createClientStoreRepresentativeSchema).max(20).optional(),
});

const uploadClientDocumentSchema = z.object({
  documentType: z.enum(CLIENT_DOCUMENT_TYPES.map((type) => type.value)),
  documentNumber: z.string().trim().max(120).optional(),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().max(120).optional(),
  fileContentBase64: z.string().trim().min(1),
  notes: z.string().trim().max(1000).optional(),
});

const createClientReferenceSchema = z.object({
  name: z.string().trim().min(2).max(255),
  contact: z.string().trim().max(255).optional(),
  phone1: z.string().trim().max(50).optional(),
  phone2: z.string().trim().max(50).optional(),
  termDays: z.coerce.number().int().min(0).optional(),
  amount: z.coerce.number().min(0).optional(),
  approved: z.boolean().optional(),
  approvedBy: z.string().trim().max(255).optional(),
});

module.exports = {
  createClientSchema,
  updateClientSchema,
  createCompanyClientSchema,
  createClientStoreSchema,
  uploadClientDocumentSchema,
  createClientReferenceSchema,
};
