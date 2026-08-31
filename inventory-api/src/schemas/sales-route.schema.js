const { z } = require('zod');

const salesGoalSchema = z.object({
  title: z.string().trim().min(2).max(120),
  periodLabel: z.string().trim().max(80).optional().nullable(),
  targetAmount: z.coerce.number().min(0).max(9999999999),
  currentAmount: z.coerce.number().min(0).max(9999999999).optional().default(0),
  notes: z.string().trim().max(500).optional().nullable(),
  isActive: z.coerce.boolean().optional().default(true),
});

// nearLimitDays is a system constant (5 days) — not accepted from client.
const saveSalesRouteSchema = z.object({
  code: z.string().trim().min(2).max(40),
  name: z.string().trim().min(2).max(120),
  visitFrequencyDays: z.coerce.number().int().min(5).max(365),
  isActive: z.coerce.boolean().optional().default(true),
});

const saveSalesRouteSubzonesSchema = z.object({
  subregionIds: z.array(z.coerce.bigint()).max(500).default([]),
});

const saveSalesRouteAssignmentsSchema = z.object({
  userIds: z.array(z.coerce.bigint()).max(200).default([]),
});

const saveSalesRouteGoalsSchema = z.object({
  goals: z.array(salesGoalSchema).max(50).default([]),
});

module.exports = {
  saveSalesRouteSchema,
  saveSalesRouteSubzonesSchema,
  saveSalesRouteAssignmentsSchema,
  saveSalesRouteGoalsSchema,
};
