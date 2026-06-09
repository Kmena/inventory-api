-- Security and company fiscal foundation for MVP 1.

ALTER TABLE "Role" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "companies" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "permissions" (
    "id" BIGSERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "role_permissions" (
    "id" BIGSERIAL NOT NULL,
    "role_id" BIGINT NOT NULL,
    "permission_id" BIGINT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "company_fiscal_configs" (
    "id" BIGSERIAL NOT NULL,
    "company_id" BIGINT NOT NULL,
    "legal_name" TEXT NOT NULL,
    "commercial_name" TEXT,
    "identification_type" TEXT NOT NULL,
    "identification_number" TEXT NOT NULL,
    "economic_activity_code" TEXT,
    "province" TEXT,
    "canton" TEXT,
    "district" TEXT,
    "neighborhood" TEXT,
    "address" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "hacienda_environment" TEXT NOT NULL DEFAULT 'STAGING',
    "certificate_storage_ref" TEXT,
    "certificate_password_secret_ref" TEXT,
    "hacienda_username_secret_ref" TEXT,
    "hacienda_password_secret_ref" TEXT,
    "default_branch_code" TEXT NOT NULL DEFAULT '001',
    "default_terminal_code" TEXT NOT NULL DEFAULT '00001',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_fiscal_configs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fiscal_sequences" (
    "id" BIGSERIAL NOT NULL,
    "company_id" BIGINT NOT NULL,
    "document_type" TEXT NOT NULL,
    "branch_code" TEXT NOT NULL,
    "terminal_code" TEXT NOT NULL,
    "current_number" BIGINT NOT NULL DEFAULT 0,
    "next_number" BIGINT NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_sequences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");
CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key" ON "role_permissions"("role_id", "permission_id");
CREATE UNIQUE INDEX "company_fiscal_configs_company_id_hacienda_environment_key" ON "company_fiscal_configs"("company_id", "hacienda_environment");
CREATE UNIQUE INDEX "fiscal_sequences_company_id_document_type_branch_code_terminal_code_key" ON "fiscal_sequences"("company_id", "document_type", "branch_code", "terminal_code");

ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_fiscal_configs" ADD CONSTRAINT "company_fiscal_configs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fiscal_sequences" ADD CONSTRAINT "fiscal_sequences_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
