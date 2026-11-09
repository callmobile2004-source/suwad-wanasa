-- Remove administrative table privileges from browser-facing Supabase roles.
-- Ordinary row permissions and all application RLS policies are preserved.
-- Also prevent future postgres-owned public tables from inheriting these grants.
BEGIN;

REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
ON ALL TABLES IN SCHEMA public
FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
ON TABLES
FROM anon, authenticated;

COMMIT;
