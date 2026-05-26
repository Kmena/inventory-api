const companyRepository = require('../repositories/company.repository');

async function listCompanies() {
  return companyRepository.findAllCompanies();
}

async function registerCompany(payload) {
  return companyRepository.createCompany(payload);
}

module.exports = {
  listCompanies,
  registerCompany,
};
