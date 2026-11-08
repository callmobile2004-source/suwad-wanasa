-- PostgreSQL integration test for profile column-level grants.
-- Verifies that authenticated users can read only public profile fields and
-- update only the allowed profile fields; no data is inserted or modified.
BEGIN;

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  username text,
  display_name text,
  friend_code text,
  created_at timestamptz,
  avatar_url text,
  equipped_title_id uuid,
  last_seen_at timestamptz,
  email text,
  phone text,
  private_notes text
);

GRANT ALL ON TABLE public.profiles TO anon, authenticated, service_role;

\i supabase/migrations/20261107165746_restrict_profile_discovery_columns.sql

DO $test$
BEGIN
  IF has_table_privilege('authenticated','public.profiles','SELECT')
     OR has_table_privilege('authenticated','public.profiles','INSERT')
     OR has_table_privilege('authenticated','public.profiles','UPDATE')
     OR has_table_privilege('authenticated','public.profiles','DELETE') THEN
    RAISE EXCEPTION 'SMOKE_FAIL: authenticated retains table-wide profile access';
  END IF;
  IF has_column_privilege('authenticated','public.profiles','id','SELECT')=false
     OR has_column_privilege('authenticated','public.profiles','username','SELECT')=false
     OR has_column_privilege('authenticated','public.profiles','display_name','SELECT')=false
     OR has_column_privilege('authenticated','public.profiles','friend_code','SELECT')=false
     OR has_column_privilege('authenticated','public.profiles','created_at','SELECT')=false
     OR has_column_privilege('authenticated','public.profiles','avatar_url','SELECT')=false
     OR has_column_privilege('authenticated','public.profiles','equipped_title_id','SELECT')=false THEN
    RAISE EXCEPTION 'SMOKE_FAIL: an approved public profile column is not readable';
  END IF;
  IF has_column_privilege('authenticated','public.profiles','email','SELECT')
     OR has_column_privilege('authenticated','public.profiles','phone','SELECT')
     OR has_column_privilege('authenticated','public.profiles','private_notes','SELECT')
     OR has_column_privilege('authenticated','public.profiles','last_seen_at','SELECT') THEN
    RAISE EXCEPTION 'SMOKE_FAIL: a private profile column is readable';
  END IF;
  IF has_column_privilege('authenticated','public.profiles','username','UPDATE')=false
     OR has_column_privilege('authenticated','public.profiles','display_name','UPDATE')=false
     OR has_column_privilege('authenticated','public.profiles','avatar_url','UPDATE')=false
     OR has_column_privilege('authenticated','public.profiles','equipped_title_id','UPDATE')=false
     OR has_column_privilege('authenticated','public.profiles','last_seen_at','UPDATE')=false
     OR has_column_privilege('authenticated','public.profiles','friend_code','UPDATE')
     OR has_column_privilege('authenticated','public.profiles','id','UPDATE') THEN
    RAISE EXCEPTION 'SMOKE_FAIL: profile update column grants are not restricted as expected';
  END IF;
  IF has_table_privilege('anon','public.profiles','SELECT')
     OR has_column_privilege('anon','public.profiles','id','SELECT')
     OR has_table_privilege('service_role','public.profiles','SELECT') THEN
    RAISE EXCEPTION 'SMOKE_FAIL: anonymous or service-role profile read access changed';
  END IF;
END;
$test$;

ROLLBACK;
