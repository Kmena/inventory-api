-- Align fiscal configuration with MVP ERD: one tax emission config per company.

DROP INDEX IF EXISTS "company_fiscal_configs_company_id_hacienda_environment_key";

ALTER TABLE "company_fiscal_configs" DROP COLUMN IF EXISTS "is_active";

CREATE UNIQUE INDEX "company_fiscal_configs_company_id_key" ON "company_fiscal_configs"("company_id");
