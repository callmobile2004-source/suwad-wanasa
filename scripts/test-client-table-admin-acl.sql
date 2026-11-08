-- Verify client roles cannot perform administrative table operations,
-- while row-level application permissions and service_role remain unaffected.
-- Run only on a disposable PostgreSQL 17 database; everything rolls back.
BEGIN;

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;

CREATE TABLE public.privilege_acl_fixture_existing (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  body text NOT NULL DEFAULT ''
);

GRANT SELECT, INSERT, UPDATE, DELETE,
      TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
ON TABLE public.privilege_acl_fixture_existing
TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE,
      TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
ON TABLE public.privilege_acl_fixture_existing
TO service_role;

-- Reproduce the unsafe default ACL so the migration must remove it for future tables.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
GRANT TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLES TO anon, authenticated;

\i supabase/migrations/20261108140000_restrict_client_table_admin_privileges.sql

CREATE TABLE public.privilege_acl_fixture_future (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  body text NOT NULL DEFAULT ''
);

DO $acl_assertions$
DECLARE
  v_table text;
  v_role text;
  v_privilege text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'privilege_acl_fixture_existing',
    'privilege_acl_fixture_future'
  ] LOOP
    FOREACH v_role IN ARRAY ARRAY['anon','authenticated'] LOOP
      FOREACH v_privilege IN ARRAY ARRAY['TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] LOOP
        IF has_table_privilege(v_role,format('public.%I',v_table),v_privilege) THEN
          RAISE EXCEPTION 'SMOKE_FAIL: % retained % on %',v_role,v_privilege,v_table;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  -- Existing CRUD grants are not changed by this focused hardening migration.
  FOREACH v_privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
    IF NOT has_table_privilege('authenticated','public.privilege_acl_fixture_existing',v_privilege) THEN
      RAISE EXCEPTION 'SMOKE_FAIL: authenticated lost ordinary % permission',v_privilege;
    END IF;
  END LOOP;

  -- Backend service privileges are deliberately untouched.
  FOREACH v_privilege IN ARRAY ARRAY['TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] LOOP
    IF NOT has_table_privilege('service_role','public.privilege_acl_fixture_existing',v_privilege) THEN
      RAISE EXCEPTION 'SMOKE_FAIL: service_role lost required backend % permission',v_privilege;
    END IF;
  END LOOP;
END;
$acl_assertions$;

ROLLBACK;
