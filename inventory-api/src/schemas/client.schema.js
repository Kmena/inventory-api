// @ts-nocheck -- Zod enum tuple typing for dynamic arrays is deferred from this initial P0 type-check gate.
const { z } = require('zod');
const { CLIENT_DOCUMENT_TYPES } = require('../lib/client-document-types');
const {
  CLIENT_DOCUMENT_MAX_FILE_SIZE_BYTES,
  CLIENT_DOCUMENT_ALLOWED_MIME_TYPES,
  CLIENT_DOCUMENT_EXTENSION_MIME_MAP,
  GovernedFileValidationError,
  validateGovernedBase64FilePayload,
} = require('../lib/sensitive-file-governance');

function requireBillingIdentityFields(value, ctx, options = {}) {
  const labelByField = {
    legalName: 'razón social',
    legalId: 'identificación',
    documentType: 'tipo de identificación',
    emailBilling: 'correo electrónico para facturas',
  };
  const requiredFields = options.allowNameAsLegalName
    ? ['legalId', 'documentType', 'emailBilling']
    : ['legalName', 'legalId', 'documentType', 'emailBilling'];

  for (const fieldName of requiredFields) {
    if (!String(value?.[fieldName] || '').trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [fieldName],
        message: `El cliente requiere ${labelByField[fieldName]} para facturar`,
      });
    }
  }
}

const clientBaseSchema = z.object({
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
});

const createClientSchema = clientBaseSchema
  .superRefine((value, ctx) => requireBillingIdentityFields(value, ctx, { allowNameAsLegalName: true }));
const createCompanyClientSchema = clientBaseSchema.omit({ companyId: true })
  .superRefine((value, ctx) => requireBillingIdentityFields(value, ctx, { allowNameAsLegalName: true }));
const updateClientSchema = clientBaseSchema.omit({ companyId: true }).partial();

// Per-store credit limit — creditBalance is system-managed, not user-editable
const updateClientStoreCreditLimitSchema = z.object({
  creditLimit: z.number().min(0),
});

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

const storeBillingModeSchema = z.enum(['inherit', 'override']).optional();

const clientStoreBaseSchema = z.object({
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
  currency: z.enum(['CRC', 'USD', 'EUR']).optional(),
  legalName: z.string().trim().min(2).max(255).optional(),
  commercialName: z.string().trim().max(255).optional(),
  legalId: z.string().trim().max(100).optional(),
  documentType: z.string().trim().max(50).optional(),
  emailBilling: z.string().trim().email().optional(),
  economicActivityCode: z.string().trim().max(20).optional(),
  economicActivityName: z.string().trim().max(255).optional(),
  creditLimit: z.coerce.number().min(0).optional(),
  billingMode: storeBillingModeSchema,
  representatives: z.array(createClientStoreRepresentativeSchema).max(20).optional(),
});

function requireStoreOverrideBillingIdentity(value, ctx) {
  const hasFiscalOverride = ['legalName', 'legalId', 'documentType', 'emailBilling', 'economicActivityCode', 'economicActivityName']
    .some((fieldName) => String(value?.[fieldName] || '').trim().length > 0);
  if ((value.billingMode || (hasFiscalOverride ? 'override' : 'inherit')) === 'override') {
    requireBillingIdentityFields(value, ctx);
  }
}

const createClientStoreSchema = clientStoreBaseSchema.superRefine(requireStoreOverrideBillingIdentity);
const updateClientStoreSchema = clientStoreBaseSchema.partial().superRefine(requireStoreOverrideBillingIdentity);

const uploadClientDocumentSchema = z.object({
  documentType: z.enum(CLIENT_DOCUMENT_TYPES.map((type) => type.value)),
  documentNumber: z.string().trim().max(120).optional(),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.enum(CLIENT_DOCUMENT_ALLOWED_MIME_TYPES).optional(),
  fileContentBase64: z.string().trim().min(1),
  notes: z.string().trim().max(1000).optional(),
}).superRefine((value, ctx) => {
  try {
    validateGovernedBase64FilePayload({
      fileName: value.fileName,
      mimeType: value.mimeType,
      fileContentBase64: value.fileContentBase64,
      maxFileSizeBytes: CLIENT_DOCUMENT_MAX_FILE_SIZE_BYTES,
      allowedMimeTypes: CLIENT_DOCUMENT_ALLOWED_MIME_TYPES,
      extensionMimeMap: CLIENT_DOCUMENT_EXTENSION_MIME_MAP,
      allowMimeTypeInference: true,
      invalidMimeTypeMessage: 'El documento debe ser PDF, imagen o archivo Word compatible',
      mimeExtensionMismatchMessage: 'El tipo MIME del documento no coincide con la extension del archivo',
      maxFileSizeMessage: 'Cada documento debe pesar 5 MB o menos',
    });
  } catch (error) {
    if (!(error instanceof GovernedFileValidationError)) {
      throw error;
    }

    const normalizedMessage = String(error.message || '').toLowerCase();
    const path = normalizedMessage.includes('mime') || normalizedMessage.includes('extension')
      ? ['mimeType']
      : ['fileContentBase64'];

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path,
      message: error.message,
    });
  }
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

// Store-scoped document upload — same validation as client-level; storeId comes from route param
const uploadClientStoreDocumentSchema = uploadClientDocumentSchema;

module.exports = {
  createClientSchema,
  updateClientSchema,
  createCompanyClientSchema,
  createClientStoreSchema,
  updateClientStoreSchema,
  uploadClientDocumentSchema,
  uploadClientStoreDocumentSchema,
  createClientReferenceSchema,
  updateClientStoreCreditLimitSchema,
};
