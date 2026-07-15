CREATE TABLE "client_stores" (
    "id" BIGSERIAL NOT NULL,
    "client_id" BIGINT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "province" TEXT,
    "canton" TEXT,
    "district" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_stores_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "client_stores_client_id_code_key" ON "client_stores"("client_id", "code");

ALTER TABLE "client_stores" ADD CONSTRAINT "client_stores_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
