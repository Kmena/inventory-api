CREATE TABLE "client_documents" (
    "id" BIGSERIAL NOT NULL,
    "client_id" BIGINT NOT NULL,
    "document_type" VARCHAR(50) NOT NULL,
    "document_number" VARCHAR(120),
    "file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(120),
    "file_url" VARCHAR(1000) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    "notes" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "client_documents_client_id_idx" ON "client_documents"("client_id");

ALTER TABLE "client_documents"
ADD CONSTRAINT "client_documents_client_id_fkey"
FOREIGN KEY ("client_id") REFERENCES "clients"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
