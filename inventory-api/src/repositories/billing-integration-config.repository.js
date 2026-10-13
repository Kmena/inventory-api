'use strict';

const prisma = require('../lib/prisma');

function findByCompanyId(companyId, db = prisma) {
  return /** @type {any} */ (db).companyBillingIntegrationConfig.findUnique({ where: { companyId } });
}

function upsertForCompany(companyId, data, db = prisma) {
  return /** @type {any} */ (db).companyBillingIntegrationConfig.upsert({
    where: { companyId },
    create: { companyId, ...data },
    update: data,
  });
}

function updateReadiness(companyId, data, db = prisma) {
  return /** @type {any} */ (db).companyBillingIntegrationConfig.update({
    where: { companyId },
    data,
  });
}

module.exports = {
  findByCompanyId,
  upsertForCompany,
  updateReadiness,
};
