DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "invoice_fiscal_intents"
    WHERE "billing_fiscal_document_id" IS NOT NULL
    GROUP BY "billing_integration_config_id", "billing_fiscal_document_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add fiscal identity uniqueness: duplicate Billing document associations exist';
  END IF;
END $$;

CREATE UNIQUE INDEX "invoice_fiscal_intents_config_document_unique"
  ON "invoice_fiscal_intents"("billing_integration_config_id", "billing_fiscal_document_id");
