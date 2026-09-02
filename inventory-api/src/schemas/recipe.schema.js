const { z } = require('zod');

const optionalDateSchema = z.union([z.coerce.date(), z.null()]).optional();

// Approved processCode catalog for PROCESSING stages (FR-007, BR-011).
const RECIPE_STAGE_PROCESS_CODES = [
  // Thermal
  'HEATING', 'COOLING', 'FREEZING', 'DRYING', 'PASTEURIZATION', 'STERILIZATION',
  // Mixing / transformation
  'MIXING', 'BLENDING', 'DISSOLUTION', 'DILUTION', 'EMULSIFICATION',
  // Mechanical
  'MILLING', 'GRINDING', 'CUTTING', 'SIEVING', 'FILTERING',
  // Reaction / maturation
  'FERMENTATION', 'CURING', 'RESTING', 'HYDRATION',
  // Forming / production
  'FORMING', 'COOKING', 'BAKING',
  // Finishing — CAPPING = tapado, SEALING = sellado con plástico/film/sello
  'PACKING_PREP', 'LABELING_PREP', 'CAPPING', 'SEALING',
  // Escape hatch — requires processLabel
  'OTHER',
];

const recipeStageTypeSchema = z.enum(['RECOLLECTION', 'PROCESSING']);

const recipeStageProcessCodeSchema = z.enum(
  /** @type {[string, ...string[]]} */ (RECIPE_STAGE_PROCESS_CODES),
);

const qaParameterSchema = z.object({
  name: z.string().trim().min(1, 'El nombre del parametro QA es obligatorio').max(120),
  unit: z.string().trim().min(1, 'La unidad del parametro QA es obligatoria').max(40),
  expectedValue: z.coerce.number(),
  minTolerance: z.coerce.number().min(0, 'La tolerancia minima no puede ser negativa'),
  maxTolerance: z.coerce.number().min(0, 'La tolerancia maxima no puede ser negativa'),
}).strict();

const recipeStageInputSchema = z.object({
  productId: z.coerce.bigint().optional().nullable(),
  name: z.string().trim().min(1).max(255),
  quantity: z.coerce.number().positive().optional().nullable(),
  unit: z.string().trim().min(1, 'La unidad es obligatoria cuando se selecciona un producto').max(30).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
}).strict().superRefine((stageInput, context) => {
  if (stageInput.productId && !stageInput.unit) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['unit'],
      message: 'La unidad es obligatoria cuando se selecciona un producto',
    });
  }
});

const recipeStageSchema = z.object({
  name: z.string().trim().min(1).max(255),
  instructions: z.string().trim().max(5000).optional().nullable(),
  responsibleRoleCode: z.string().trim().max(100).optional().nullable(),
  expectedParameters: z.array(qaParameterSchema).optional().default([]),
  parameterTolerances: z.array(z.record(z.unknown())).optional().default([]),
  requiredEvidence: z.array(z.record(z.unknown())).optional().default([]),
  qaMandatory: z.boolean().optional().default(false),
  stageInputs: z.array(recipeStageInputSchema).optional().default([]),
  // Stage typing (FR-003, FR-006, BR-009, BR-010)
  stageType: recipeStageTypeSchema.optional().default('PROCESSING'),
  // Required for PROCESSING stages; must be from the approved catalog (FR-006, FR-007, BR-010, BR-011)
  processCode: recipeStageProcessCodeSchema.nullable().optional().default(null),
  // Required only when processCode = OTHER; not required for catalog-backed codes (FR-008, FR-009, BR-014, BR-015)
  processLabel: z.string().trim().min(1).max(255).nullable().optional().default(null),
}).strict().superRefine((stage, context) => {
  if (stage.qaMandatory && stage.expectedParameters.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['expectedParameters'],
      message: 'La etapa QA obligatoria requiere al menos un parametro esperado',
    });
  }

  // PROCESSING stages must declare a processCode (FR-006, BR-010)
  if (stage.stageType === 'PROCESSING' && !stage.processCode) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['processCode'],
      message: 'Las etapas de procesamiento requieren un codigo de proceso (processCode)',
    });
  }

  // When processCode is OTHER, processLabel is required (FR-008, BR-014)
  if (stage.processCode === 'OTHER' && !stage.processLabel) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['processLabel'],
      message: 'El campo processLabel es obligatorio cuando processCode es OTHER',
    });
  }

  // RECOLLECTION stages must not declare a processCode (domain clarity)
  if (stage.stageType === 'RECOLLECTION' && stage.processCode) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['processCode'],
      message: 'Las etapas de recoleccion no deben declarar processCode',
    });
  }
});

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

const recipeQuantityBasisSchema = z.enum(['PER_OUTPUT_KG', 'PER_FINISHED_UNIT']);

const recipeVersionFieldsObjectSchema = z.object({
  effectiveFrom: optionalDateSchema,
  effectiveTo: optionalDateSchema,
  expectedYield: z.coerce.number().positive().optional().nullable(),
  expectedWaste: z.coerce.number().min(0).optional().nullable(),
  yieldTolerancePercent: z.coerce.number().min(0).max(100).optional().nullable(),
  wasteTolerancePercent: z.coerce.number().min(0).max(100).optional().nullable(),
  instructions: z.string().trim().max(5000).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  quantityBasis: recipeQuantityBasisSchema.optional().default('PER_OUTPUT_KG'),
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
  qaParameterSchema,
  recipeQuantityBasisSchema,
  recipeStageTypeSchema,
  recipeStageProcessCodeSchema,
  RECIPE_STAGE_PROCESS_CODES,
  createRecipeSchema,
  updateRecipeSchema,
  createRecipeVersionSchema,
  updateRecipeVersionSchema,
  approveRecipeVersionSchema,
};
