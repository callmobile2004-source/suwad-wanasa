-- Idempotent duplicate application record for the client table ACL hardening.
-- The first application is recorded as 20261109002744; this second recorded
-- application is retained in history rather than deleting an applied version.
-- Ordinary row permissions and application RLS policies remain unchanged.
BEGIN;

REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
ON ALL TABLES IN SCHEMA public
FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
ON TABLES
FROM anon, authenticated;

COMMIT;
