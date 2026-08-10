const { z } = require('zod');

const transferMetadataSchema = z.object({
  bank: z.string().trim().min(1).max(100),
  reference: z.string().trim().min(1).max(255),
  amount: z.number().positive(),
  date: z.string().datetime(),
});

const orderItemSchema = z.object({
  productId: z.coerce.bigint(),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0).optional(),
  discountPercent: z.number().min(0).optional(),
  discountAmount: z.number().min(0).optional(),
  totalDiscount: z.number().min(0).optional(),
  approved: z.boolean().optional(),
});

const baseOrderShape = z.object({
  warehouseId: z.coerce.bigint().optional().nullable(),
  companyId: z.coerce.bigint().optional(),
  clientId: z.coerce.bigint().optional().nullable(),
  clientStoreId: z.coerce.bigint().optional().nullable(),
  userId: z.coerce.bigint().optional().nullable(),
  approvedById: z.coerce.bigint().optional().nullable(),
  receiptNumber: z.string().max(80).optional(),
  invoiceNumber: z.string().max(80).optional(),
  notes: z.string().max(2000).optional(),
  responsible: z.string().max(255).optional(),
  approved: z.boolean().optional(),
  isCash: z.boolean().optional(),
  downPayment: z.number().min(0).optional(),
  total: z.number().min(0).optional(),
  otherCosts: z.number().min(0).optional(),
  transport: z.string().max(255).optional(),
  status: z.enum(['DRAFT', 'APPROVED', 'IN_PRODUCTION', 'DELIVERED', 'CANCELLED']).optional(),
  paymentCondition: z.enum(['CASH', 'TRANSFER', 'CREDIT']).optional(),
  transferMetadata: transferMetadataSchema.optional().nullable(),
  items: z.array(orderItemSchema).min(1),
});

const createOrderSchema = baseOrderShape.superRefine((data, ctx) => {
  if (data.paymentCondition === 'TRANSFER' && !data.transferMetadata) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['transferMetadata'],
      message: 'Los datos de la transferencia son obligatorios cuando la condición de pago es TRANSFER',
    });
  }
});

const updateOrderSchema = baseOrderShape.partial();

module.exports = { createOrderSchema, updateOrderSchema, transferMetadataSchema };
