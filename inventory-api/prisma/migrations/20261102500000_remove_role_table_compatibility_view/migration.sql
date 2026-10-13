-- The compatibility relation is needed only while the historical backfill runs.
-- Never drop a real table or another relation an existing installation may own.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'roles' AND c.relkind = 'v'
  ) THEN
    EXECUTE 'DROP VIEW public.roles';
  END IF;
END $$;