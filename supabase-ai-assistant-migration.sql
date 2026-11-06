-- AI assistant storage and abuse controls. Additive only.
begin;

create table if not exists public.public_chat_ai_replies (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null unique references public.public_messages(id) on delete cascade,
  response text not null check (char_length(response) between 1 and 3000),
  model text not null default 'gemini-3.5-flash-lite',
  created_at timestamptz not null default now()
);

alter table public.public_chat_ai_replies enable row level security;
revoke all on public.public_chat_ai_replies from anon, authenticated;
grant select on public.public_chat_ai_replies to authenticated;

drop policy if exists "members read public chat AI replies" on public.public_chat_ai_replies;
create policy "members read public chat AI replies"
on public.public_chat_ai_replies for select to authenticated
using (true);

create table if not exists public.ai_request_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  request_kind text not null check (request_kind in ('public_chat', 'game_help')),
  created_at timestamptz not null default now()
);

create index if not exists ai_request_usage_user_time_idx
  on public.ai_request_usage (user_id, created_at desc);

alter table public.ai_request_usage enable row level security;
revoke all on public.ai_request_usage from anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'public_chat_ai_replies'
  ) then
    alter publication supabase_realtime add table public.public_chat_ai_replies;
  end if;
end
$$;

create or replace function private.enforce_ai_request_limit()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  if (
    select count(*)
    from public.ai_request_usage
    where user_id = new.user_id
      and created_at >= now() - interval '1 hour'
  ) >= 12 then
    raise exception using errcode = 'P0001', message = 'AI_RATE_LIMIT';
  end if;
  return new;
end;
$;

revoke all on function private.enforce_ai_request_limit() from public, anon, authenticated;
drop trigger if exists enforce_ai_request_hourly_limit on public.ai_request_usage;
create trigger enforce_ai_request_hourly_limit
before insert on public.ai_request_usage
for each row execute function private.enforce_ai_request_limit();

commit;