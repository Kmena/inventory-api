const { z } = require('zod');

const billingIntegrationConfigSchema = z.object({
  billingTenantId: z.string().trim().min(1),
  billingCompanyId: z.string().trim().min(1),
  billingEnvironment: z.enum(['SANDBOX', 'PRODUCTION']).default('SANDBOX'),
  billingCredentialSecretRef: z.string().trim().min(1),
  enabled: z.boolean().default(false),
});

module.exports = {
  billingIntegrationConfigSchema,
};
