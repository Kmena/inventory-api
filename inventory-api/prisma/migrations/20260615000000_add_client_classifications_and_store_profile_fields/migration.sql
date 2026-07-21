CREATE TABLE "client_classifications" (
    "id" BIGSERIAL NOT NULL,
    "company_id" BIGINT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_classifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "client_classifications_company_id_code_key" ON "client_classifications"("company_id", "code");
CREATE UNIQUE INDEX "client_classifications_company_id_name_key" ON "client_classifications"("company_id", "name");

ALTER TABLE "client_classifications"
ADD CONSTRAINT "client_classifications_company_id_fkey"
FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "client_classifications" ("company_id", "code", "name", "is_active", "created_at", "updated_at")
SELECT company."id", seed."code", seed."name", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "companies" company
CROSS JOIN (
    VALUES
        ('GENERAL', 'General'),
        ('MAYORISTA', 'Mayorista'),
        ('MINORISTA', 'Minorista')
) AS seed("code", "name")
ON CONFLICT ("company_id", "code") DO NOTHING;

ALTER TABLE "clients" ADD COLUMN "client_classification_id" BIGINT;
ALTER TABLE "clients"
ADD CONSTRAINT "clients_client_classification_id_fkey"
FOREIGN KEY ("client_classification_id") REFERENCES "client_classifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "clients_client_classification_id_idx" ON "clients"("client_classification_id");

UPDATE "clients" client
SET "client_classification_id" = classification."id"
FROM "client_classifications" classification
WHERE classification."company_id" = client."company_id"
AND classification."code" = 'GENERAL'
AND client."client_classification_id" IS NULL;

ALTER TABLE "client_stores"
ADD COLUMN "store_type" TEXT,
ADD COLUMN "location_reference" TEXT,
ADD COLUMN "attention_schedule" TEXT,
ADD COLUMN "is_primary" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

WITH ranked_stores AS (
    SELECT "id", ROW_NUMBER() OVER (PARTITION BY "client_id" ORDER BY "id" ASC) AS row_number
    FROM "client_stores"
)
UPDATE "client_stores" store
SET "is_primary" = ranked_stores.row_number = 1
FROM ranked_stores
WHERE ranked_stores."id" = store."id";
