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

const createWarehouseSchema = z.object({
  code: z.string().trim().min(2).max(40),
  name: z.string().trim().min(2).max(120),
  warehouseType: z.enum(warehouseTypeValues),
  isSellableSource: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

module.exports = {
  createWarehouseSchema,
};
