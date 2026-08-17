const { z } = require('zod');

const procurementItemSchema = z.object({
  productId: z.coerce.bigint(),
  quantity: z.coerce.number().positive(),
  notes: z.string().trim().max(500).optional().nullable(),
}).strict();

const createPurchaseRequestSchema = z.object({
  title: z.string().trim().min(3).max(200),
  notes: z.string().trim().max(2000).optional().nullable(),
  items: z.array(procurementItemSchema).min(1),
}).strict();

const createSupplierQuotationItemSchema = z.object({
  productId: z.coerce.bigint(),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().positive(),
  leadTimeDays: z.coerce.number().int().min(0).optional().nullable(),
  availabilityNotes: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
}).strict();

const createSupplierQuotationSchema = z.object({
  supplierId: z.coerce.bigint(),
  reference: z.string().trim().min(1).max(120).optional().nullable(),
  currency: z.string().trim().min(1).max(10).optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
  evidence: z.array(z.object({
    type: z.string().trim().min(1).max(80),
    reference: z.string().trim().min(1).max(500),
  }).strict()).optional().nullable(),
  items: z.array(createSupplierQuotationItemSchema).min(1),
}).strict();

const selectSupplierQuotationSchema = z.object({
  quotationId: z.coerce.bigint(),
  justification: z.string().trim().max(2000).optional().nullable(),
}).strict();

const approveSupplierSelectionSchema = z.object({
  justification: z.string().trim().max(2000).optional().nullable(),
}).strict();

const assistedQuotationSupplierSchema = z.object({
  supplierId: z.coerce.bigint(),
  unitPrice: z.coerce.number().positive(),
  currency: z.string().trim().min(1).max(10).optional().nullable(),
  leadTimeDays: z.coerce.number().int().min(0).optional().nullable(),
  availabilityNotes: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
}).strict();

const assistedQuotationProductSchema = z.object({
  productId: z.coerce.bigint(),
  quantity: z.coerce.number().positive(),
  notes: z.string().trim().max(500).optional().nullable(),
  suppliers: z.array(assistedQuotationSupplierSchema).min(1),
}).strict();

const createAssistedQuotationRequestSchema = z.object({
  title: z.string().trim().min(3).max(200).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  products: z.array(assistedQuotationProductSchema).min(1),
}).strict();

const createPurchaseOrderSchema = z.object({
  selectionId: z.coerce.bigint(),
  notes: z.string().trim().max(2000).optional().nullable(),
}).strict();

module.exports = {
  createPurchaseRequestSchema,
  createSupplierQuotationSchema,
  createAssistedQuotationRequestSchema,
  selectSupplierQuotationSchema,
  approveSupplierSelectionSchema,
  createPurchaseOrderSchema,
};
