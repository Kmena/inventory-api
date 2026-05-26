const { z } = require('zod');

const orderItemSchema = z.object({
  productId: z.coerce.bigint(),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0).optional(),
  discountPercent: z.number().min(0).optional(),
  discountAmount: z.number().min(0).optional(),
  totalDiscount: z.number().min(0).optional(),
  approved: z.boolean().optional(),
});

const createOrderSchema = z.object({
  companyId: z.coerce.bigint(),
  clientId: z.coerce.bigint().optional().nullable(),
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
  items: z.array(orderItemSchema).min(1),
});

const updateOrderSchema = createOrderSchema.partial();

module.exports = { createOrderSchema, updateOrderSchema };
