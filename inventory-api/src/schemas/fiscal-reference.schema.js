const { z } = require('zod');

const createFiscalDocumentReferenceSchema = z.object({
  documentType: z.enum(['01', '02', '03', '04', '08', '09', '12', '13'], {
    errorMap: () => ({ message: 'El tipo de documento fiscal debe ser uno de: 01, 02, 03, 04, 08, 09, 12, 13' }),
  }),
  simplifiedRegime: z.boolean().optional().default(false),
  externalReference: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
}).strict();

module.exports = { createFiscalDocumentReferenceSchema };
