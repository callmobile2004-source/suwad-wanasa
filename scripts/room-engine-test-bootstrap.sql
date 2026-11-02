\set ON_ERROR_STOP on

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

select 'PASS: isolated Supabase-compatible PostgreSQL bootstrap' as test_result;
