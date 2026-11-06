-- Privacy-aware member presence for Suwad Wanasa.
-- Safe additive migration: existing profile/game data is not modified or deleted.

create table if not exists public.member_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  show_presence boolean not null default true,
  last_active_at timestamptz,
  updated_at timestamptz not null default clock_timestamp()
);

alter table public.member_presence alter column last_active_at drop not null;
alter table public.member_presence enable row level security;
revoke all on table public.member_presence from anon, authenticated;
grant select on table public.member_presence to authenticated;

drop policy if exists "members read own presence settings" on public.member_presence;
create policy "members read own presence settings"
on public.member_presence for select to authenticated
using ((select auth.uid()) = user_id);

insert into public.member_presence(user_id,show_presence,last_active_at,updated_at)
select p.id, true, p.last_seen_at, clock_timestamp()
from public.profiles p
on conflict (user_id) do nothing;

create or replace function public.touch_my_presence()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_last_active timestamptz;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  insert into public.member_presence(user_id, last_active_at, updated_at)
  values (v_user_id, clock_timestamp(), clock_timestamp())
  on conflict (user_id) do update
    set last_active_at = excluded.last_active_at,
        updated_at = excluded.updated_at
  returning last_active_at into v_last_active;
  return date_trunc('second', v_last_active);
end;
$$;

create or replace function public.set_my_presence_visibility(p_visible boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_visible boolean;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  insert into public.member_presence(user_id, show_presence, last_active_at, updated_at)
  values (v_user_id, coalesce(p_visible, true), clock_timestamp(), clock_timestamp())
  on conflict (user_id) do update
    set show_presence = coalesce(p_visible, true),
        updated_at = clock_timestamp()
  returning show_presence into v_visible;
  return v_visible;
end;
$$;

create or replace function public.get_member_presence(p_user_ids uuid[])
returns table(user_id uuid, is_online boolean, last_seen_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select mp.user_id,
         (mp.last_active_at is not null and mp.last_active_at >= now() - interval '90 seconds') as is_online,
         case when mp.last_active_at is null then null else date_trunc('second', mp.last_active_at) end as last_seen_at
  from public.member_presence mp
  where auth.uid() is not null
    and mp.show_presence = true
    and mp.user_id = any(coalesce(p_user_ids, array[]::uuid[]));
$$;

revoke all on function public.touch_my_presence() from public, anon;
revoke all on function public.set_my_presence_visibility(boolean) from public, anon;
revoke all on function public.get_member_presence(uuid[]) from public, anon;
grant execute on function public.touch_my_presence() to authenticated;
grant execute on function public.set_my_presence_visibility(boolean) to authenticated;
grant execute on function public.get_member_presence(uuid[]) to authenticated;
