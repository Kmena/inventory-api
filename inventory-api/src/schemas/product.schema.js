const { z } = require('zod');

const createProductSchema = z.object({
  companyId: z.coerce.bigint(),
  categoryId: z.coerce.bigint().optional().nullable(),
  recipeId: z.coerce.bigint().optional().nullable(),
  code: z.string().max(50).optional(),
  name: z.string().min(2).max(255),
  description: z.string().max(2000).optional(),
  unit: z.string().max(30).optional(),
  currency: z.string().max(10).optional(),
  price: z.number().min(0).optional(),
  quantity: z.number().min(0).optional(),
  reservedQuantity: z.number().min(0).optional(),
  taxExempt: z.boolean().optional(),
  inCatalog: z.boolean().optional(),
  netContent: z.number().min(0).optional(),
  conversionFactor: z.number().min(0).optional(),
  minStock: z.number().min(0).optional(),
  maxStock: z.number().min(0).optional(),
  standbyStock: z.number().min(0).optional(),
});

const updateProductSchema = createProductSchema.partial();

const importProductRowSchema = z.object({
  id: z.coerce.bigint(),
  code: z.string().max(50).optional().nullable(),
  name: z.string().min(2).max(255),
  description: z.string().max(2000).optional().nullable(),
  unit: z.string().max(30).optional().nullable(),
  currency: z.string().max(10).optional().nullable(),
  price: z.coerce.number().min(0).optional().nullable(),
  quantity: z.coerce.number().min(0).optional().nullable(),
  reservedQuantity: z.coerce.number().min(0).optional().nullable(),
  taxExempt: z.boolean().optional(),
  inCatalog: z.boolean().optional(),
  netContent: z.coerce.number().min(0).optional().nullable(),
  conversionFactor: z.coerce.number().min(0).optional().nullable(),
  minStock: z.coerce.number().min(0).optional().nullable(),
  maxStock: z.coerce.number().min(0).optional().nullable(),
  standbyStock: z.coerce.number().min(0).optional().nullable(),
  categoryName: z.string().max(255).optional().nullable(),
  overwrite: z.boolean().optional(),
}).strict();

const importProductsSchema = z.object({
  rows: z.array(importProductRowSchema).min(1),
});

module.exports = { createProductSchema, updateProductSchema, importProductsSchema };
