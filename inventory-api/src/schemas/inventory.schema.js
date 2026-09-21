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
  internalLotNumber: z.string().trim().min(1).max(100).optional(),
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
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});

const transferInventorySchema = z.object({
  sourceWarehouseId: z.coerce.bigint(),
  destinationWarehouseId: z.coerce.bigint(),
  productId: z.coerce.bigint(),
  quantity: z.number().positive(),
  reasonCode: z.string().trim().min(2).max(80),
  note: z.string().trim().min(3).max(500).optional(),
  lotId: z.coerce.bigint().optional().nullable(),
  idempotencyKey: z.string().trim().min(8).max(120),
});

const initialInventoryRowSchema = z.object({
  warehouseId: z.coerce.bigint(),
  quantity: z.number().positive(),
  lotNumber: z.string().trim().min(1).max(100).optional(),
  internalLotNumber: z.string().trim().min(1).max(100).optional(),
  manufacturerLotNumber: z.string().trim().max(100).optional().nullable(),
  productionDate: optionalLotDateSchema,
  expirationDate: optionalLotDateSchema,
});

const createInitialInventorySchema = z.object({
  productId: z.coerce.bigint(),
  idempotencyKey: z.string().trim().min(8).max(120),
  rows: z.array(initialInventoryRowSchema).min(1).max(100),
  note: z.string().trim().max(500).optional(),
});

const updateInventoryAlertStatusSchema = z.object({
  status: z.enum(['ACKNOWLEDGED', 'RESOLVED']),
  note: z.string().trim().min(3).max(500).optional(),
});

const INVENTORY_REQUEST_TYPES = /** @type {['ADJUSTMENT', 'TRANSFER']} */ (['ADJUSTMENT', 'TRANSFER']);

const createInventoryRequestSchema = z.object({
  type: z.enum(INVENTORY_REQUEST_TYPES),
  lotId: z.coerce.bigint(),
  productId: z.coerce.bigint(),
  sourceWarehouseId: z.coerce.bigint(),
  destinationWarehouseId: z.coerce.bigint().optional().nullable(),
  quantity: z.number().positive().optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.type === 'TRANSFER') {
    if (!data.destinationWarehouseId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'destinationWarehouseId es obligatorio para TRANSFER', path: ['destinationWarehouseId'] });
    }
    if (!data.quantity) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'quantity es obligatorio para TRANSFER', path: ['quantity'] });
    }
    if (data.destinationWarehouseId && data.sourceWarehouseId === data.destinationWarehouseId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'sourceWarehouseId y destinationWarehouseId no pueden ser iguales', path: ['destinationWarehouseId'] });
    }
  }
});

const executeAdjustmentRequestSchema = z.object({
  actualQuantity: z.number().positive(),
  direction: z.enum(['IN', 'OUT']),
  reasonCode: z.string().trim().min(2).max(80),
  operatorNote: z.string().trim().max(500).optional(),
});

const executeTransferRequestSchema = z.object({
  operatorNote: z.string().trim().max(500).optional(),
});

const pickupTransferRequestSchema = z.object({
  operatorNote: z.string().trim().max(500).optional(),
});

const cancelInventoryRequestSchema = z.object({
  cancelledReason: z.string().trim().max(500).optional(),
});

const confirmDeliveryRequestSchema = z.object({
  operatorNote: z.string().trim().max(500).optional(),
});

/**
 * Combined schema for POST /requests/:id/execute.
 * The request type (ADJUSTMENT or TRANSFER) is only known after loading from DB,
 * so type-specific semantic validation is delegated to the service.
 * This schema provides basic route-level sanitization.
 */
const executeInventoryRequestSchema = z.object({
  actualQuantity: z.number().positive().optional(),
  direction: z.enum(['IN', 'OUT']).optional(),
  reasonCode: z.string().trim().min(2).max(80).optional(),
  operatorNote: z.string().trim().max(500).optional(),
});

module.exports = {
  createStockEntrySchema,
  updateLotQaSchema,
  adjustStockSchema,
  transferInventorySchema,
  createInitialInventorySchema,
  updateInventoryAlertStatusSchema,
  createInventoryRequestSchema,
  executeAdjustmentRequestSchema,
  executeTransferRequestSchema,
  pickupTransferRequestSchema,
  cancelInventoryRequestSchema,
  confirmDeliveryRequestSchema,
  executeInventoryRequestSchema,
};

