CREATE TABLE "client_store_representatives" (
    "id" BIGSERIAL NOT NULL,
    "client_store_id" BIGINT NOT NULL,
    "full_name" TEXT NOT NULL,
    "identification_number" TEXT,
    "position" TEXT,
    "role" TEXT,
    "email" TEXT,
    "phone_primary" TEXT,
    "phone_secondary" TEXT,
    "birthday" TIMESTAMP(3),
    "important_date" TIMESTAMP(3),
    "important_date_type" TEXT,
    "comment" TEXT,
    "is_primary_contact" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_store_representatives_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "client_store_representatives_client_store_id_idx" ON "client_store_representatives"("client_store_id");

ALTER TABLE "client_store_representatives"
ADD CONSTRAINT "client_store_representatives_client_store_id_fkey"
FOREIGN KEY ("client_store_id") REFERENCES "client_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
