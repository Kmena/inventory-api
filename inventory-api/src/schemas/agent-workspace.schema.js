const { z } = require('zod');

const listAgentStoresQuerySchema = z.object({
  zone: z.string().trim().max(120).optional(),
  name: z.string().trim().max(120).optional(),
});

const createAgentVisitSchema = z.object({
  clientStoreId: z.coerce.bigint(),
  motive: z.enum(['VENTA', 'COBRO', 'SEGUIMIENTO']),
  result: z.enum(['EXITOSA', 'PENDIENTE', 'SIN_CONTACTO', 'REPROGRAMADA']),
  comment: z.string().trim().max(2000).optional().nullable(),
  suggestedNextVisitAt: z.string().datetime().optional().nullable(),
  visitedAt: z.string().datetime().optional().nullable(),
});

const createAgentOrderItemSchema = z.object({
  productId: z.coerce.bigint(),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().min(0),
  discountPercent: z.coerce.number().min(0).optional().default(0),
  discountAmount: z.coerce.number().min(0).optional().default(0),
  totalDiscount: z.coerce.number().min(0).optional().default(0),
});

const createAgentOrderSchema = z.object({
  notes: z.string().trim().max(2000).optional().nullable(),
  responsible: z.string().trim().max(255).optional().nullable(),
  items: z.array(createAgentOrderItemSchema).min(1).max(100),
  paymentCondition: z.enum(['CASH', 'TRANSFER', 'CREDIT']).optional(),
  transferMetadata: z.object({
    bank: z.string().trim().min(1).max(100),
    reference: z.string().trim().min(1).max(255),
    amount: z.number().positive(),
    date: z.string().datetime(),
  }).optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.paymentCondition === 'TRANSFER' && !data.transferMetadata) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['transferMetadata'],
      message: 'Los datos de la transferencia son obligatorios cuando la condición de pago es TRANSFER',
    });
  }
});

module.exports = {
  listAgentStoresQuerySchema,
  createAgentVisitSchema,
  createAgentOrderSchema,
};



