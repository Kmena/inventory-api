const { z } = require('zod');

const optionalDateSchema = z.union([z.coerce.date(), z.null()]).optional();

const createProductionOrderSchema = z.object({
  productId: z.coerce.bigint(),
  recipeVersionId: z.coerce.bigint(),
  quantity: z.coerce.number().positive(),
  originWarehouseId: z.coerce.bigint(),
  destinationWarehouseId: z.coerce.bigint(),
  responsibleUserId: z.coerce.bigint(),
  priority: z.coerce.number().int().min(0).max(999).optional(),
  productionLotCode: z.string().trim().min(1).max(100),
  plannedDate: optionalDateSchema,
  productionDate: optionalDateSchema,
  expirationDate: optionalDateSchema,
  overrideJustification: z.string().trim().min(10).max(1000).optional().nullable(),
}).strict().superRefine((payload, context) => {
  if (payload.originWarehouseId === payload.destinationWarehouseId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['destinationWarehouseId'],
      message: 'La bodega destino debe ser distinta de la bodega origen',
    });
  }

  if (payload.productionDate && payload.expirationDate && payload.expirationDate < payload.productionDate) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['expirationDate'],
      message: 'La fecha de vencimiento no puede ser anterior a la fecha de producción',
    });
  }

  if (payload.plannedDate && payload.expirationDate && payload.expirationDate < payload.plannedDate) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['expirationDate'],
      message: 'La fecha de vencimiento no puede ser anterior a la fecha planificada',
    });
  }
});

const productionApprovalSchema = z.object({
  overrideJustification: z.string().trim().min(10).max(1000).optional().nullable(),
}).strict();

const productionStageMaterialSchema = z.object({
  productId: z.coerce.bigint(),
  lotId: z.coerce.bigint(),
  quantity: z.coerce.number().positive(),
  note: z.string().trim().max(500).optional().nullable(),
}).strict();

const productionStageParameterSchema = z.object({
  name: z.string().trim().min(1).max(120),
  value: z.union([z.string().trim().min(1).max(500), z.coerce.number(), z.boolean(), z.null()]),
  unit: z.string().trim().min(1).max(40).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
}).strict();

const productionStageEvidenceSchema = z.object({
  type: z.string().trim().min(1).max(80),
  reference: z.string().trim().min(1).max(500),
  note: z.string().trim().max(500).optional().nullable(),
}).strict();

const productionStageExecutionSchema = z.object({
  startedAt: z.coerce.date(),
  endedAt: z.coerce.date(),
  actualParameters: z.array(productionStageParameterSchema).optional().default([]),
  evidence: z.array(productionStageEvidenceSchema).optional().default([]),
  consumptions: z.array(productionStageMaterialSchema).optional().default([]),
  waste: z.array(productionStageMaterialSchema).optional().default([]),
  notes: z.string().trim().max(1000).optional().nullable(),
}).strict().superRefine((payload, context) => {
  if (payload.endedAt < payload.startedAt) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endedAt'],
      message: 'La hora de finalización no puede ser anterior a la hora de inicio',
    });
  }
}
);

const productionStageReturnSchema = z.object({
  productId: z.coerce.bigint(),
  lotId: z.coerce.bigint(),
  quantity: z.coerce.number().positive(),
  reasonCode: z.string().trim().min(1).max(80),
  returnedAt: z.coerce.date().optional(),
  note: z.string().trim().max(500).optional().nullable(),
}).strict();

const productionCompletionSchema = z.object({
  producedQuantity: z.coerce.number().positive(),
  lotCode: z.string().trim().min(1).max(100).optional().nullable(),
  expirationDate: optionalDateSchema,
  productionDate: optionalDateSchema,
  note: z.string().trim().max(1000).optional().nullable(),
}).strict();

module.exports = {
  createProductionOrderSchema,
  productionApprovalSchema,
  productionStageExecutionSchema,
  productionStageReturnSchema,
  productionCompletionSchema,
};
