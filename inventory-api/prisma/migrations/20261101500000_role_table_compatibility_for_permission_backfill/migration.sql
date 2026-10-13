-- Compatibility shim for the historical 202611020 permission backfill.
-- The original schema creates the quoted table "Role"; the historical data
-- migration reads unquoted roles. Keep the original migration checksum intact.
DO $$
BEGIN
  IF to_regclass('public."Role"') IS NULL THEN
    RAISE EXCEPTION 'Expected historical table "Role" is missing';
  END IF;
  IF to_regclass('public.roles') IS NULL THEN
    EXECUTE 'CREATE VIEW roles AS SELECT * FROM "Role"';
  END IF;
END $$;