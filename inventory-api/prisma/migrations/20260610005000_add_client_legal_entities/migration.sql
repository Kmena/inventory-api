CREATE TABLE "client_legal_entities" (
    "id" BIGSERIAL NOT NULL,
    "company_id" BIGINT NOT NULL,
    "legal_name" TEXT NOT NULL,
    "commercial_name" TEXT,
    "identification_type" TEXT,
    "identification_number" TEXT,
    "economic_activity_code" TEXT,
    "economic_activity_name" TEXT,
    "province" TEXT,
    "canton" TEXT,
    "district" TEXT,
    "neighborhood" TEXT,
    "address" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_legal_entities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "client_legal_entities_company_id_identification_number_key" ON "client_legal_entities"("company_id", "identification_number");

ALTER TABLE "client_legal_entities" ADD CONSTRAINT "client_legal_entities_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "clients" ADD COLUMN "legal_entity_id" BIGINT;
ALTER TABLE "client_stores" ADD COLUMN "legal_entity_id" BIGINT;

INSERT INTO "client_legal_entities" (
    "company_id",
    "legal_name",
    "commercial_name",
    "identification_type",
    "identification_number",
    "economic_activity_code",
    "economic_activity_name",
    "address",
    "email",
    "phone",
    "created_at",
    "updated_at"
)
SELECT
    "company_id",
    "name",
    "name",
    "document_type",
    COALESCE("legal_id", CONCAT('CLIENT-', "id"::TEXT)),
    "economic_activity_code",
    "economic_activity_name",
    "address",
    "email_billing",
    "phone",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "clients"
ON CONFLICT ("company_id", "identification_number") DO NOTHING;

UPDATE "clients"
SET "legal_entity_id" = "client_legal_entities"."id"
FROM "client_legal_entities"
WHERE "client_legal_entities"."company_id" = "clients"."company_id"
  AND "client_legal_entities"."identification_number" = COALESCE("clients"."legal_id", CONCAT('CLIENT-', "clients"."id"::TEXT));

UPDATE "client_stores"
SET "legal_entity_id" = "clients"."legal_entity_id"
FROM "clients"
WHERE "clients"."id" = "client_stores"."client_id";

CREATE INDEX "clients_legal_entity_id_idx" ON "clients"("legal_entity_id");
CREATE INDEX "client_stores_legal_entity_id_idx" ON "client_stores"("legal_entity_id");

ALTER TABLE "clients" ADD CONSTRAINT "clients_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "client_legal_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "client_stores" ADD CONSTRAINT "client_stores_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "client_legal_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
