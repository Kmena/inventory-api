const { z } = require('zod');
const { optionalLotDateSchema } = require('./lot-date.schema');

const initialLotSchema = z.object({
  warehouseId: z.coerce.bigint(),
  quantity: z.coerce.number().positive(),
  internalLotNumber: z.string().trim().min(1).max(100),
  manufacturerLotNumber: z.string().trim().max(100).optional().nullable(),
  invoiceNumber: z.string().trim().max(100).optional().nullable(),
  productionDate: optionalLotDateSchema,
  expirationDate: optionalLotDateSchema,
  entryDate: optionalLotDateSchema,
  lotStatus: z.enum(['AVAILABLE', 'QUARANTINED', 'EXPIRED', 'BLOCKED', 'CONSUMED']).optional(),
  qaStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'FAILED']).optional(),
  note: z.string().trim().max(500).optional().nullable(),
});

const productFieldsSchema = z.object({
  companyId: z.coerce.bigint().optional(),
  categoryId: z.coerce.bigint().optional().nullable(),
  subcategoryId: z.coerce.bigint().optional().nullable(),
  recipeId: z.coerce.bigint().optional().nullable(),
  createdByUserId: z.coerce.bigint().optional().nullable(),
  code: z.string().max(50).optional(),
  name: z.string().min(2).max(255),
  description: z.string().max(2000).optional(),
  productType: z.string().max(50).optional(),
  sellableKind: z.string().max(50).optional(),
  unit: z.string().max(30).optional(),
  cabysCode: z.string().max(50).optional(),
  currency: z.string().max(10).optional(),
  price: z.number().min(0).optional(),
  quantity: z.number().min(0).optional(),
  reservedQuantity: z.number().min(0).optional(),
  taxExempt: z.boolean().optional(),
  taxCategory: z.string().max(50).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  density: z.number().min(0).optional(),
  densityUnit: z.string().max(30).optional(),
  isActive: z.boolean().optional(),
  lotStrategy: z.literal('TRACKED').optional(),
  inCatalog: z.boolean().optional(),
  netContent: z.number().min(0).optional(),
  conversionFactor: z.number().min(0).optional(),
  kgConversionFactor: z.number().min(0).optional(),
  minStock: z.number().min(0).optional(),
  maxStock: z.number().min(0).optional(),
  standbyStock: z.number().min(0).optional(),
});

const createProductSchema = productFieldsSchema.extend({
  initialLots: z.array(initialLotSchema).default([]),
}).superRefine((payload, context) => {
  const allocatedQuantity = payload.initialLots.reduce((sum, lot) => sum + lot.quantity, 0);
  if ((payload.quantity ?? 0) > 0 && payload.initialLots.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['initialLots'],
      message: 'Las existencias iniciales deben distribuirse en lotes por bodega',
    });
  }
  if (payload.quantity !== undefined && Math.abs(payload.quantity - allocatedQuantity) > 0.000001) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['quantity'],
      message: 'La cantidad total debe coincidir con la suma de los lotes iniciales',
    });
  }
  if ((payload.reservedQuantity ?? 0) > 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['reservedQuantity'],
      message: 'Un producto nuevo no puede iniciar con cantidad reservada',
    });
  }
});

const updateProductSchema = productFieldsSchema.partial().omit({
  quantity: true,
  reservedQuantity: true,
});

const importProductRowSchema = z.object({
  id: z.coerce.bigint(),
  code: z.string().max(50).optional().nullable(),
  name: z.string().min(2).max(255),
  description: z.string().max(2000).optional().nullable(),
  productType: z.string().max(50).optional().nullable(),
  sellableKind: z.string().max(50).optional().nullable(),
  unit: z.string().max(30).optional().nullable(),
  cabysCode: z.string().max(50).optional().nullable(),
  currency: z.string().max(10).optional().nullable(),
  price: z.coerce.number().min(0).optional().nullable(),
  quantity: z.coerce.number().min(0).optional().nullable(),
  taxExempt: z.boolean().optional(),
  taxCategory: z.string().max(50).optional().nullable(),
  taxRate: z.coerce.number().min(0).max(100).optional().nullable(),
  density: z.coerce.number().min(0).optional().nullable(),
  densityUnit: z.string().max(30).optional().nullable(),
  isActive: z.boolean().optional(),
  lotStrategy: z.literal('TRACKED').optional().nullable(),
  inCatalog: z.boolean().optional(),
  netContent: z.coerce.number().min(0).optional().nullable(),
  conversionFactor: z.coerce.number().min(0).optional().nullable(),
  kgConversionFactor: z.coerce.number().min(0).optional().nullable(),
  minStock: z.coerce.number().min(0).optional().nullable(),
  maxStock: z.coerce.number().min(0).optional().nullable(),
  standbyStock: z.coerce.number().min(0).optional().nullable(),
  categoryName: z.string().max(255).optional().nullable(),
  warehouseId: z.coerce.bigint().optional().nullable(),
  internalLotNumber: z.string().trim().max(100).optional().nullable(),
  manufacturerLotNumber: z.string().trim().max(100).optional().nullable(),
  expirationDate: optionalLotDateSchema,
  overwrite: z.boolean().optional(),
}).strict().superRefine((row, context) => {
  if ((row.quantity ?? 0) > 0 && (!row.warehouseId || !row.internalLotNumber)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['warehouseId'],
      message: 'Las filas con existencias requieren bodega y lote interno',
    });
  }
});

const importProductsSchema = z.object({
  rows: z.array(importProductRowSchema).min(1),
});

module.exports = { createProductSchema, updateProductSchema, importProductsSchema };

