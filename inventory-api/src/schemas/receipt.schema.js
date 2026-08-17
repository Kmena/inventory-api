const { z } = require('zod');

const optionalDateSchema = z.union([z.coerce.date(), z.null()]).optional();

const receiptItemSchema = z.object({
  purchaseOrderItemId: z.coerce.bigint().optional().nullable(),
  productId: z.coerce.bigint(),
  substituteProductId: z.coerce.bigint().optional().nullable(),
  requestedQuantity: z.coerce.number().nonnegative(),
  receivedQuantity: z.coerce.number().nonnegative(),
  rejectedQuantity: z.coerce.number().nonnegative().optional().default(0),
  lotNumber: z.string().trim().max(120).optional().nullable(),
  expirationDate: optionalDateSchema,
  unitCost: z.coerce.number().nonnegative().optional().nullable(),
  observations: z.string().trim().max(1000).optional().nullable(),
}).strict();

const createPurchaseReceiptSchema = z.object({
  purchaseOrderId: z.coerce.bigint().optional().nullable(),
  supplierId: z.coerce.bigint(),
  warehouseId: z.coerce.bigint(),
  receivedAt: optionalDateSchema,
  notes: z.string().trim().max(2000).optional().nullable(),
  evidence: z.array(z.object({
    type: z.string().trim().min(1).max(80),
    reference: z.string().trim().min(1).max(500),
  }).strict()).optional().nullable(),
  items: z.array(receiptItemSchema).min(1),
}).strict();

const createReceiptInspectionSchema = z.object({
  result: z.enum(['ACCEPTED', 'PARTIALLY_ACCEPTED', 'REJECTED']),
  quantityAccepted: z.coerce.number().nonnegative(),
  quantityRejected: z.coerce.number().nonnegative().optional().default(0),
  observations: z.string().trim().max(1000).optional().nullable(),
  evidence: z.array(z.object({
    type: z.string().trim().min(1).max(80),
    reference: z.string().trim().min(1).max(500),
  }).strict()).optional().nullable(),
  inspectedAt: optionalDateSchema,
}).strict();

module.exports = {
  createPurchaseReceiptSchema,
  createReceiptInspectionSchema,
};
