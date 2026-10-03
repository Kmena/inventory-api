-- Migration: add bank_name and card_type to payments
-- Captures extra context per payment method:
--   TRANSFER → bank_name (originating bank, free text)
--   CARD     → card_type (network: VISA | MASTERCARD | AMEX | DINERS | OTHER)
--   CASH     → no extra fields required

ALTER TABLE "payments" ADD COLUMN "bank_name" TEXT;
ALTER TABLE "payments" ADD COLUMN "card_type" TEXT;
