ALTER TABLE "Role" ADD COLUMN "company_id" BIGINT;

CREATE INDEX "Role_company_id_idx" ON "Role"("company_id");

ALTER TABLE "Role"
  ADD CONSTRAINT "Role_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
