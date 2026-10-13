CREATE TYPE "BillingAssociationStatus" AS ENUM ('ACTIVE', 'HISTORICAL_ONLY');

ALTER TABLE "company_billing_integration_configs"
ADD COLUMN "association_status" "BillingAssociationStatus" NOT NULL DEFAULT 'ACTIVE';

-- An operator must first disable the association selected as historical. This
-- derivation records that explicit choice without deleting or reassigning any
-- company, intent, snapshot, invoice, clave or consecutive.
UPDATE "company_billing_integration_configs" AS historical
SET "association_status" = 'HISTORICAL_ONLY'
WHERE historical."enabled" = FALSE
  AND EXISTS (
    SELECT 1
    FROM "company_billing_integration_configs" AS sibling
    WHERE sibling."id" <> historical."id"
      AND sibling."billing_tenant_id" = historical."billing_tenant_id"
      AND sibling."billing_company_id" = historical."billing_company_id"
      AND sibling."billing_environment" = historical."billing_environment"
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "company_billing_integration_configs"
    WHERE "enabled" = TRUE
      AND "association_status" = 'ACTIVE'
    GROUP BY "billing_tenant_id", "billing_company_id", "billing_environment"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Multiple active Billing fiscal issuer associations must be reconciled by an authorized operator before this migration';
  END IF;
END $$;

ALTER TABLE "company_billing_integration_configs"
ADD CONSTRAINT "company_billing_integration_configs_historical_disabled_check"
CHECK ("association_status" <> 'HISTORICAL_ONLY' OR "enabled" = FALSE);

CREATE UNIQUE INDEX "company_billing_integration_configs_billing_tenant_id_billing_company_id_billing_environment_key"
ON "company_billing_integration_configs"("billing_tenant_id", "billing_company_id", "billing_environment")
WHERE "enabled" = TRUE AND "association_status" = 'ACTIVE';
