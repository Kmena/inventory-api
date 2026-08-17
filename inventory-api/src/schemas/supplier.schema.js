const { z } = require('zod');

const createSupplierSchema = z.object({
  name: z.string().trim().min(2).max(255),
  email: z.string().email().max(255).optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  country: z.string().trim().max(120).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
}).strict();

const updateSupplierSchema = createSupplierSchema.partial().strict();

const addProductToSupplierSchema = z.object({
  productId: z.coerce.bigint(),
  isPreferred: z.boolean().optional().default(false),
  supplierSku: z.string().trim().max(100).optional().nullable(),
  unitPrice: z.coerce.number().min(0).optional().nullable(),
  currency: z.string().trim().max(10).optional().nullable(),
  leadTimeDays: z.coerce.number().int().min(0).optional().nullable(),
  minimumOrderQuantity: z.coerce.number().min(0).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
}).strict();

module.exports = {
  createSupplierSchema,
  updateSupplierSchema,
  addProductToSupplierSchema,
};
