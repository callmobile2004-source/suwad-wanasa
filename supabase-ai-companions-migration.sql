begin;

create table if not exists public.ai_companion_token_issuance (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  issued_at timestamptz not null default pg_catalog.clock_timestamp()
);

create index if not exists ai_companion_token_issuance_user_time_idx
  on public.ai_companion_token_issuance(user_id, issued_at desc);

alter table public.ai_companion_token_issuance enable row level security;
revoke all on table public.ai_companion_token_issuance from public, anon, authenticated;
grant all on table public.ai_companion_token_issuance to service_role;

create or replace function public.consume_ai_companion_token_quota(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_count integer;
  v_last timestamptz;
begin
  if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' then
    raise exception 'AI quota gateway only.' using errcode='42501';
  end if;
  if p_user_id is null then
    raise exception 'Invalid AI quota user.' using errcode='22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 0)
  );

  delete from public.ai_companion_token_issuance
  where user_id=p_user_id
    and issued_at < pg_catalog.clock_timestamp() - interval '1 hour';

  select count(*)::integer, max(issued_at)
  into v_count, v_last
  from public.ai_companion_token_issuance
  where user_id=p_user_id;

  if v_count >= 8 or (
    v_last is not null
    and v_last > pg_catalog.clock_timestamp() - interval '30 seconds'
  ) then
    return false;
  end if;

  insert into public.ai_companion_token_issuance(user_id)
  values(p_user_id);
  return true;
end;
$function$;

revoke all on function public.consume_ai_companion_token_quota(uuid)
  from public, anon, authenticated;
grant execute on function public.consume_ai_companion_token_quota(uuid)
  to service_role;

commit;
