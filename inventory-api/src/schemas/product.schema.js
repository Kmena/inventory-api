const { z } = require('zod');
const { optionalLotDateSchema } = require('./lot-date.schema');

const productSourcingMethodSchema = z.enum(['PRODUCTION_ONLY', 'PURCHASE_ONLY', 'PRODUCTION_OR_PURCHASE']);
const productInventoryTypeSchema = z.enum(['RAW_MATERIAL', 'PACKAGING', 'WORK_IN_PROCESS', 'FINISHED_GOOD']);
const productPresentationTypeSchema = z.enum(['VOLUME', 'MASS', 'LENGTH', 'COUNT']);
const productNetContentUnitSchema = z.enum(['ML', 'L', 'G', 'KG', 'M', 'UN']);

/** Units that correspond to the VOLUME presentation type. */
const VOLUME_UNITS = ['ML', 'L'];
/** Units that correspond to the MASS presentation type. */
const MASS_UNITS = ['G', 'KG'];

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

const authorizedSupplierSchema = z.object({
  supplierId: z.coerce.bigint(),
  isPreferred: z.boolean().optional(),
  supplierSku: z.string().trim().max(100).optional().nullable(),
  leadTimeDays: z.coerce.number().int().min(0).optional().nullable(),
  minimumOrderQuantity: z.coerce.number().min(0).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

const productFieldsSchema = z.object({
  companyId: z.coerce.bigint().optional(),
  categoryId: z.coerce.bigint().optional().nullable(),
  subcategoryId: z.coerce.bigint().optional().nullable(),
  recipeId: z.coerce.bigint().optional().nullable(),
  createdByUserId: z.coerce.bigint().optional().nullable(),
  code: z.string().max(50).optional(),
  sku: z.string().trim().max(100).optional().nullable(),
  barcode: z.string().trim().max(100).optional().nullable(),
  name: z.string().min(2).max(255),
  description: z.string().max(2000).optional(),
  sourcingMethod: productSourcingMethodSchema.optional().nullable(),
  inventoryType: productInventoryTypeSchema.optional().nullable(),
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
  presentationType: productPresentationTypeSchema.optional().nullable(),
  netContentUnit: productNetContentUnitSchema.optional().nullable(),
  requiresLot: z.boolean().optional(),
  requiresExpiration: z.boolean().optional(),
  standardCost: z.number().min(0).optional().nullable(),
  realCost: z.number().min(0).optional().nullable(),
  isActive: z.boolean().optional(),
  lotStrategy: z.literal('TRACKED').optional(),
  inCatalog: z.boolean().optional(),
  netContent: z.number().min(0).optional(),
  conversionFactor: z.number().min(0).optional(),
  kgConversionFactor: z.number().min(0).optional(),
  minStock: z.number().min(0).optional(),
  maxStock: z.number().min(0).optional(),
  standbyStock: z.number().min(0).optional(),
  allowedWarehouseIds: z.array(z.coerce.bigint()).optional(),
  authorizedSuppliers: z.array(authorizedSupplierSchema).optional(),
});

/**
 * Validates that the presentation-type fields are internally consistent.
 * Used in both create (strict) and update (soft — only checks fields present in payload).
 *
 * @param {object} payload - The parsed payload object.
 * @param {import('zod').RefinementCtx} context - Zod refinement context.
 * @param {boolean} strict - When true, ALL required conversion fields must be present
 *   in the payload.  When false (update path), a field is only validated when it is
 *   explicitly included in the same payload (i.e. its key exists in the object).
 */
function validatePresentationType(payload, context, strict) {
  const { presentationType } = payload;
  if (!presentationType) return;

  const has = (key) => key in payload;

  if (presentationType === 'VOLUME') {
    if (strict || has('netContentUnit')) {
      if (!payload.netContentUnit || !VOLUME_UNITS.includes(payload.netContentUnit)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['netContentUnit'],
          message: 'La presentación volumétrica requiere unidad ML o L',
        });
      }
    }
    if (strict || has('density')) {
      if (!payload.density || payload.density <= 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['density'],
          message: 'La presentación volumétrica requiere densidad positiva (kg/L)',
        });
      }
    }
    if (strict || has('netContent')) {
      if (!payload.netContent || payload.netContent <= 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['netContent'],
          message: 'La presentación volumétrica requiere contenido neto positivo',
        });
      }
    }
    return;
  }

  if (presentationType === 'MASS') {
    if (strict || has('netContentUnit')) {
      if (!payload.netContentUnit || !MASS_UNITS.includes(payload.netContentUnit)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['netContentUnit'],
          message: 'La presentación másica requiere unidad G o KG',
        });
      }
    }
    if (strict || has('netContent')) {
      if (!payload.netContent || payload.netContent <= 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['netContent'],
          message: 'La presentación másica requiere contenido neto positivo',
        });
      }
    }
    return;
  }

  if (presentationType === 'LENGTH') {
    if (strict || has('netContentUnit')) {
      if (payload.netContentUnit !== 'M') {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['netContentUnit'],
          message: 'La presentación lineal requiere unidad M',
        });
      }
    }
    if (strict || has('netContent')) {
      if (!payload.netContent || payload.netContent <= 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['netContent'],
          message: 'La presentación lineal requiere contenido neto positivo (metros por unidad)',
        });
      }
    }
    if (strict || has('kgConversionFactor')) {
      if (!payload.kgConversionFactor || payload.kgConversionFactor <= 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['kgConversionFactor'],
          message: 'La presentación lineal requiere factor de conversión kg/m positivo',
        });
      }
    }
  }
  // COUNT has no additional field constraints at schema level.
}

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
  if (payload.allowedWarehouseIds && new Set(payload.allowedWarehouseIds.map(String)).size !== payload.allowedWarehouseIds.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['allowedWarehouseIds'],
      message: 'Las bodegas autorizadas no pueden repetirse',
    });
  }
  if (payload.authorizedSuppliers && new Set(payload.authorizedSuppliers.map((supplier) => String(supplier.supplierId))).size !== payload.authorizedSuppliers.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['authorizedSuppliers'],
      message: 'Los proveedores autorizados no pueden repetirse',
    });
  }
  validatePresentationType(payload, context, true);
});

const updateProductSchema = productFieldsSchema.partial().omit({
  quantity: true,
  reservedQuantity: true,
}).superRefine((payload, context) => {
  if (payload.allowedWarehouseIds && new Set(payload.allowedWarehouseIds.map(String)).size !== payload.allowedWarehouseIds.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['allowedWarehouseIds'],
      message: 'Las bodegas autorizadas no pueden repetirse',
    });
  }
  if (payload.authorizedSuppliers && new Set(payload.authorizedSuppliers.map((supplier) => String(supplier.supplierId))).size !== payload.authorizedSuppliers.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['authorizedSuppliers'],
      message: 'Los proveedores autorizados no pueden repetirse',
    });
  }
  // Soft validation: only checks cross-field consistency for fields explicitly provided in the payload.
  validatePresentationType(payload, context, false);
});

const createCategorySchema = z.object({
  name: z.string().trim().min(2).max(255),
  categoryType: z.enum(['PT', 'MP', 'EM']).default('PT'),
  sortOrder: z.coerce.number().int().min(0).optional(),
}).strict();

/**
 * Schema for creating a ProductSubcategory (user-managed sub-grouping within a system Category).
 * Example: "Shampoo" inside the "Producto Terminado" (PT) category.
 */
const createSubcategorySchema = z.object({
  categoryId: z.coerce.bigint({ required_error: 'La categoria padre es obligatoria' }),
  name: z.string().trim().min(2).max(255),
  code: z.string().trim().min(1).max(50).optional(),
}).strict();

const importProductRowSchema = z.object({
  id: z.coerce.bigint(),
  code: z.string().max(50).optional().nullable(),
  sku: z.string().trim().max(100).optional().nullable(),
  barcode: z.string().trim().max(100).optional().nullable(),
  name: z.string().min(2).max(255),
  description: z.string().max(2000).optional().nullable(),
  sourcingMethod: productSourcingMethodSchema.optional().nullable(),
  inventoryType: productInventoryTypeSchema.optional().nullable(),
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
  presentationType: productPresentationTypeSchema.optional().nullable(),
  netContentUnit: productNetContentUnitSchema.optional().nullable(),
  requiresLot: z.boolean().optional().nullable(),
  requiresExpiration: z.boolean().optional().nullable(),
  standardCost: z.coerce.number().min(0).optional().nullable(),
  realCost: z.coerce.number().min(0).optional().nullable(),
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

module.exports = {
  createProductSchema,
  updateProductSchema,
  createCategorySchema,
  createSubcategorySchema,
  importProductsSchema,
  productPresentationTypeSchema,
  productNetContentUnitSchema,
};

