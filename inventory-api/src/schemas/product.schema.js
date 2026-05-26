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

module.exports = { createProductSchema, updateProductSchema };
