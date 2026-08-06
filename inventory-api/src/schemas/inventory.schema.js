const { z } = require('zod');
const { optionalLotDateSchema } = require('./lot-date.schema');

const createStockEntrySchema = z.object({
  warehouseId: z.coerce.bigint(),
  productId: z.coerce.bigint(),
  quantity: z.number().positive(),
  reasonCode: z.enum([
    'PURCHASE',
    'PRODUCTION_OUTPUT',
    'INITIAL_LOAD',
    'RETURN_FROM_CLIENT',
    'TRANSFER_IN',
    'MANUAL_ENTRY',
  ]).default('MANUAL_ENTRY'),
  note: z.string().max(500).optional(),
  supplierId: z.coerce.bigint().optional().nullable(),
  invoiceNumber: z.string().max(100).optional(),
  internalLotNumber: z.string().trim().min(1).max(100),
  manufacturerLotNumber: z.string().trim().max(100).optional().nullable(),
  lotNumber: z.string().trim().max(100).optional(),
  productionDate: optionalLotDateSchema,
  expirationDate: optionalLotDateSchema,
  entryDate: optionalLotDateSchema,
  casNumber: z.string().max(100).optional(),
  lotStatus: z.enum(['AVAILABLE', 'QUARANTINED', 'EXPIRED', 'BLOCKED', 'CONSUMED']).optional(),
  qaStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'FAILED']).optional(),
  useLot: z.boolean().optional(),
});

const updateLotQaSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'FAIL', 'BLOCK', 'REACTIVATE']),
  reason: z.string().trim().min(3).max(500),
});

const adjustStockSchema = z.object({
  warehouseId: z.coerce.bigint(),
  productId: z.coerce.bigint(),
  quantity: z.number().positive(),
  direction: z.enum(['IN', 'OUT']),
  reasonCode: z.string().trim().min(2).max(80),
  note: z.string().trim().min(3).max(500),
  lotId: z.coerce.bigint().optional().nullable(),
});

const updateInventoryAlertStatusSchema = z.object({
  status: z.enum(['ACKNOWLEDGED', 'RESOLVED']),
  note: z.string().trim().min(3).max(500).optional(),
});

module.exports = {
  createStockEntrySchema,
  updateLotQaSchema,
  adjustStockSchema,
  updateInventoryAlertStatusSchema,
};

