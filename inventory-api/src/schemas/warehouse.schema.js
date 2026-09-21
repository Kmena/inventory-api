// @ts-nocheck -- Zod enum tuple typing for dynamic arrays is deferred from this initial P0 type-check gate.
const { z } = require('zod');

const warehouseTypeValues = [
  'GENERAL',
  'RAW_MATERIAL',
  'FINISHED_GOODS',
  'PACKAGING',
  'QUARANTINE',
  'RETURNS',
  'PRODUCTION',
  'ADMIN_VIRTUAL',
  'COURSES_VIRTUAL',
  'AFFILIATIONS_VIRTUAL',
];

const locationTypeValues = ['BODEGA', 'ALMACEN', 'CEDI', 'OTHER'];
const locationNatureValues = ['PHYSICAL', 'VIRTUAL'];

const createWarehouseSchema = z.object({
  code: z.string().trim().min(2).max(40),
  name: z.string().trim().min(2).max(120),
  warehouseType: z.enum(warehouseTypeValues),
  locationType: z.enum(locationTypeValues).optional(),
  locationNature: z.enum(locationNatureValues).optional(),
  isSellableSource: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

const updateWarehouseSchema = createWarehouseSchema.partial().refine((payload) => Object.keys(payload).length > 0, {
  message: 'Debe enviar al menos un campo para actualizar',
});

const updateWarehouseStatusSchema = z.object({
  isActive: z.boolean(),
  reason: z.string().trim().min(3).max(500).optional(),
});

module.exports = {
  createWarehouseSchema,
  updateWarehouseSchema,
  updateWarehouseStatusSchema,
};
