const { z } = require('zod');

const createRegionSchema = z.object({
  name: z.string().trim().min(2).max(120),
  routeCode: z.string().trim().max(50).optional(),
});

const createSubregionSchema = z.object({
  name: z.string().trim().min(2).max(120),
  routeCode: z.string().trim().max(50).optional(),
});

module.exports = {
  createRegionSchema,
  createSubregionSchema,
};
