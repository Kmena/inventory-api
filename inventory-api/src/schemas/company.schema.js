const { z } = require('zod');

const createCompanySchema = z.object({
  name: z.string().min(2).max(255),
  legalId: z.string().max(100).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email().optional(),
  address: z.string().max(1000).optional(),
});

const createRootCompanySchema = z.object({
  company: z.object({
    name: z.string().min(2).max(255),
    legalId: z.string().max(100).optional(),
    phone: z.string().max(50).optional(),
    email: z.string().email().optional(),
    address: z.string().max(1000).optional(),
  }),
  fiscalConfig: z.object({
    legalName: z.string().min(2).max(255),
    commercialName: z.string().max(255).optional(),
    identificationType: z.string().min(1).max(20),
    identificationNumber: z.string().min(3).max(100),
    economicActivityCode: z.string().max(50).optional(),
    province: z.string().max(100).optional(),
    canton: z.string().max(100).optional(),
    district: z.string().max(100).optional(),
    neighborhood: z.string().max(100).optional(),
    address: z.string().max(1000).optional(),
    email: z.string().email().optional(),
    phone: z.string().max(50).optional(),
    haciendaEnvironment: z.enum(['STAGING', 'PRODUCTION']).default('STAGING'),
    certificateStorageRef: z.string().max(500).optional(),
    certificatePasswordSecretRef: z.string().max(500).optional(),
    haciendaUsernameSecretRef: z.string().max(500).optional(),
    haciendaPasswordSecretRef: z.string().max(500).optional(),
    defaultBranchCode: z.string().min(3).max(3).default('001'),
    defaultTerminalCode: z.string().min(5).max(5).default('00001'),
  }),
  rootUser: z.object({
    fullName: z.string().min(2).max(255),
    email: z.string().email().optional(),
    username: z.string().min(3).max(100),
    password: z.string().min(8).max(100),
    phone: z.string().max(50).optional(),
  }),
});

module.exports = {
  createCompanySchema,
  createRootCompanySchema,
};
