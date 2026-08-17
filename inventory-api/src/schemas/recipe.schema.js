const { z } = require('zod');

const optionalDateSchema = z.union([z.coerce.date(), z.null()]).optional();

const recipeStageInputSchema = z.object({
  productId: z.coerce.bigint().optional().nullable(),
  name: z.string().trim().min(1).max(255),
  quantity: z.coerce.number().positive().optional().nullable(),
  unit: z.string().trim().max(30).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
}).strict();

const recipeStageSchema = z.object({
  name: z.string().trim().min(1).max(255),
  instructions: z.string().trim().max(5000).optional().nullable(),
  responsibleRoleCode: z.string().trim().max(100).optional().nullable(),
  expectedParameters: z.array(z.record(z.unknown())).optional().default([]),
  parameterTolerances: z.array(z.record(z.unknown())).optional().default([]),
  requiredEvidence: z.array(z.record(z.unknown())).optional().default([]),
  qaMandatory: z.boolean().optional(),
  stageInputs: z.array(recipeStageInputSchema).optional().default([]),
}).strict();

const recipeFieldsSchema = z.object({
  code: z.string().trim().min(1).max(50).optional().nullable(),
  name: z.string().trim().min(2).max(255),
  recipeType: z.string().trim().max(100).optional().nullable(),
  isActive: z.boolean().optional(),
}).strict();

const createRecipeSchema = recipeFieldsSchema;

const updateRecipeSchema = recipeFieldsSchema.partial().refine(
  (payload) => Object.keys(payload).length > 0,
  { message: 'Debe enviar al menos un campo para actualizar' },
);

const recipeVersionFieldsObjectSchema = z.object({
  effectiveFrom: optionalDateSchema,
  effectiveTo: optionalDateSchema,
  expectedYield: z.coerce.number().positive().optional().nullable(),
  expectedWaste: z.coerce.number().min(0).optional().nullable(),
  yieldTolerancePercent: z.coerce.number().min(0).max(100).optional().nullable(),
  wasteTolerancePercent: z.coerce.number().min(0).max(100).optional().nullable(),
  instructions: z.string().trim().max(5000).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  stages: z.array(recipeStageSchema).min(1),
}).strict();

const recipeVersionFieldsSchema = recipeVersionFieldsObjectSchema.superRefine((payload, context) => {
  if (payload.effectiveFrom && payload.effectiveTo && payload.effectiveTo < payload.effectiveFrom) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['effectiveTo'],
      message: 'La fecha efectiva final no puede ser anterior a la inicial',
    });
  }
});

const createRecipeVersionSchema = recipeVersionFieldsSchema;

const updateRecipeVersionSchema = recipeVersionFieldsObjectSchema.partial().superRefine((payload, context) => {
  if (payload.effectiveFrom && payload.effectiveTo && payload.effectiveTo < payload.effectiveFrom) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['effectiveTo'],
      message: 'La fecha efectiva final no puede ser anterior a la inicial',
    });
  }

  if (Object.keys(payload).length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: [],
      message: 'Debe enviar al menos un campo para actualizar',
    });
  }
});

const approveRecipeVersionSchema = z.object({
  effectiveFrom: optionalDateSchema,
  effectiveTo: optionalDateSchema,
}).strict().superRefine((payload, context) => {
  if (payload.effectiveFrom && payload.effectiveTo && payload.effectiveTo < payload.effectiveFrom) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['effectiveTo'],
      message: 'La fecha efectiva final no puede ser anterior a la inicial',
    });
  }
});

module.exports = {
  createRecipeSchema,
  updateRecipeSchema,
  createRecipeVersionSchema,
  updateRecipeVersionSchema,
  approveRecipeVersionSchema,
};
