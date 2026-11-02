\set ON_ERROR_STOP on

DO $target_guard$
begin
  if current_database() <> 'suwad_engine_test' then
    raise exception 'Refusing to run room-engine test bootstrap outside suwad_engine_test.';
  end if;
  if not exists (select 1 from pg_roles where rolname=session_user and rolsuper) then
    raise exception 'Room-engine test bootstrap requires the isolated CI superuser session.';
  end if;
end
$target_guard$;
-- Minimal Supabase Auth/PostgREST surface for isolated PostgreSQL migration tests.
-- This is a disposable CI database only; it never connects to the production project.
do $roles$
begin
  if not exists (select 1 from pg_roles where rolname='anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then
    create role service_role nologin bypassrls;
  end if;
  alter role service_role bypassrls;
end
$roles$;

grant usage on schema public to anon, authenticated, service_role;

-- Match Supabase's administrative service_role table/sequence access for
-- objects created by the PostgreSQL migration owner during this CI run.
alter default privileges for role postgres in schema public
  grant all on tables to service_role;
alter default privileges for role postgres in schema public
  grant usage, select on sequences to service_role;

create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key,
  aud text not null default 'authenticated',
  role text not null default 'authenticated',
  email text unique,
  encrypted_password text,
  email_confirmed_at timestamptz,
  raw_app_meta_data jsonb not null default '{}'::jsonb,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  is_super_admin boolean not null default false,
  is_anonymous boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function auth.uid()
returns uuid
language sql stable
as $function$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub',true),''),
    nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub'
  )::uuid;
$function$;

create or replace function auth.role()
returns text
language sql stable
as $function$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role',true),''),
    nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role'
  );
$function$;

create or replace function auth.jwt()
returns jsonb
language sql stable
as $function$
  select coalesce(
    nullif(current_setting('request.jwt.claims',true),'')::jsonb,
    jsonb_build_object(
      'sub',nullif(current_setting('request.jwt.claim.sub',true),''),
      'role',auth.role()
    )
  );
$function$;

grant usage on schema auth to anon,authenticated,service_role;
grant select on auth.users to anon,authenticated,service_role;
grant execute on function auth.uid(),auth.role(),auth.jwt() to anon,authenticated,service_role;

do $publication$
begin
  if not exists (select 1 from pg_publication where pubname='supabase_realtime') then
    create publication supabase_realtime;
  end if;
end
$publication$;

DO $role_switch_probe$
declare
  v_session_user name := session_user;
begin
  execute 'set local role authenticated';
  if current_user <> 'authenticated' then
    raise exception 'PostgreSQL did not switch the session to authenticated.';
  end if;
  execute 'reset role';
  execute 'set local role service_role';
  if current_user <> 'service_role' then
    raise exception 'PostgreSQL did not switch the session to service_role.';
  end if;
  if not exists (select 1 from pg_roles where rolname='service_role' and rolbypassrls) then
    raise exception 'The test service_role must have BYPASSRLS.';
  end if;
  execute 'reset role';
  if current_user <> v_session_user then
    raise exception 'PostgreSQL did not restore the CI session role.';
  end if;
end
$role_switch_probe$;

select 'PASS: isolated Supabase-compatible PostgreSQL bootstrap' as test_result;
