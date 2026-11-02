-- Disposable Postgres test bootstrap that emulates the Supabase roles/auth helpers.
-- Runs only inside the ephemeral GitHub Actions PostgreSQL service.
do $$
begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end
$$;
alter role anon nologin;
alter role authenticated nologin;
alter role service_role nologin bypassrls;

create schema if not exists auth;
create table if not exists auth.users(
  id uuid primary key,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  raw_app_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default pg_catalog.now()
);

create or replace function auth.uid()
returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
create or replace function auth.role()
returns text
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.role',true),'');
$$;
create or replace function auth.jwt()
returns jsonb
language sql stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb;
$$;

grant usage on schema auth to anon,authenticated,service_role;
grant select on auth.users to service_role;
grant execute on function auth.uid() to anon,authenticated,service_role;
grant execute on function auth.role() to anon,authenticated,service_role;
grant execute on function auth.jwt() to anon,authenticated,service_role;

create publication supabase_realtime;
