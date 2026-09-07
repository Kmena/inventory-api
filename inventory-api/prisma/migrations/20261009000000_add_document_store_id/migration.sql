-- Migration: add_document_store_id
-- Adds a nullable store_id FK to client_documents so a document can
-- optionally belong to a specific store while remaining scoped to its client.
-- store_id = NULL means client-owned document (backward compatible).

ALTER TABLE "client_documents"
  ADD COLUMN "store_id" BIGINT NULL
  REFERENCES "client_stores"("id") ON DELETE SET NULL;

CREATE INDEX "client_documents_store_id_idx" ON "client_documents"("store_id");
